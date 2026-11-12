-- Doxxed Dev core schema.
-- Rule: raw identity data lives ONLY in dev_kyc_private and is never selected by public routes.
-- Public reads go through the dev_public_profiles view, which applies the dev's disclosure choices.

create extension if not exists pgcrypto;

do $$ begin
  create type disclosure_level as enum ('private', 'pseudonymous', 'public');
exception when duplicate_object then null; end $$;

do $$ begin
  create type launch_stage as enum ('draft', 'pending_lock', 'bonding', 'graduated', 'flagged');
exception when duplicate_object then null; end $$;

-- Wallet sign-in nonces (single use, short-lived)
create table if not exists auth_nonces (
  nonce text primary key,
  wallet text not null,
  created_at timestamptz not null default now()
);

-- 1. Private KYC record. Never exposed.
create table if not exists dev_kyc_private (
  dev_id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_applicant_id text not null unique,
  status text not null default 'pending',            -- pending | approved | rejected
  legal_name text,
  date_of_birth date,
  country text,
  checks jsonb not null default '{}',                -- {identity, liveness, screening}
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

-- 2. Public profile
create table if not exists dev_profiles (
  dev_id uuid primary key references dev_kyc_private(dev_id) on delete cascade,
  alias text not null unique,
  wallet text not null unique,
  disclosure disclosure_level not null default 'private',
  x_handle text,
  x_verified boolean not null default false,
  github_login text,
  github_verified boolean not null default false,
  reveal_name boolean not null default false,
  reveal_region boolean not null default false,
  bio text,
  flagged boolean not null default false,
  flagged_reason text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

-- Disclosure can only go up (private -> pseudonymous -> public), never down.
create or replace function enforce_disclosure_monotonic() returns trigger language plpgsql as $$
begin
  if new.disclosure < old.disclosure then raise exception 'Disclosure can only be increased'; end if;
  if old.reveal_name and not new.reveal_name then raise exception 'Cannot un-reveal name'; end if;
  if old.reveal_region and not new.reveal_region then raise exception 'Cannot un-reveal region'; end if;
  return new;
end $$;
drop trigger if exists trg_disclosure_monotonic on dev_profiles;
create trigger trg_disclosure_monotonic before update on dev_profiles
  for each row execute function enforce_disclosure_monotonic();

create or replace view dev_public_profiles as
select p.dev_id, p.alias, p.wallet, p.disclosure, p.bio, p.flagged, p.flagged_reason, p.is_demo,
       case when p.disclosure <> 'private' and p.x_verified then p.x_handle end as x_handle,
       case when p.disclosure <> 'private' and p.github_verified then p.github_login end as github_login,
       case when p.reveal_name and p.disclosure = 'public' then k.legal_name end as legal_name,
       case when p.reveal_region then k.country end as region,
       jsonb_build_object(
         'identity',  coalesce((k.checks->>'identity')::bool, false),
         'liveness',  coalesce((k.checks->>'liveness')::bool, false),
         'screening', coalesce((k.checks->>'screening')::bool, false),
         'wallet', true, 'x', p.x_verified, 'github', p.github_verified
       ) as checks,
       k.verified_at
from dev_profiles p join dev_kyc_private k using (dev_id)
where k.status = 'approved' and k.verified_at is not null;

-- 3. Launches
create table if not exists launches (
  mint text primary key,
  dev_id uuid not null references dev_profiles(dev_id),
  launchpad text not null check (launchpad in ('pumpfun','raydium','bonk','meteora','float')),
  name text not null,
  symbol text not null,
  description text,
  image_url text,
  x_url text,
  website_url text,
  github_repo text,
  dev_buy_sol numeric,
  lock_months int not null default 12 check (lock_months >= 12),
  stage launch_stage not null default 'pending_lock',
  pool_address text,
  graduated_pool text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists launches_stage_idx on launches (stage);

-- 4. Locks (policy: 100% of dev allocation, >= 12 months)
create table if not exists locks (
  mint text primary key references launches(mint) on delete cascade,
  provider text not null default 'streamflow',
  contract text not null,
  amount numeric not null,
  pct_of_supply numeric,
  starts_at timestamptz not null,
  unlocks_at timestamptz not null,
  verified_onchain_at timestamptz,
  check (unlocks_at >= starts_at + interval '12 months' - interval '1 day')
);

-- 5. Latest market data + snapshots for charts
create table if not exists market (
  mint text primary key references launches(mint) on delete cascade,
  mcap numeric, liquidity numeric, volume24h numeric, holders int, total_supply numeric,
  change_5m numeric, change_1h numeric, change_6h numeric, change_24h numeric,
  top_holders_pct numeric, mint_authority_off boolean, freeze_authority_off boolean,
  bonding_pct numeric,
  updated_at timestamptz not null default now()
);
create table if not exists market_snapshots (
  mint text not null references launches(mint) on delete cascade,
  at timestamptz not null default now(),
  price numeric, mcap numeric,
  primary key (mint, at)
);

-- 6. Creator fee claims (Helius indexer)
create table if not exists fee_claims (
  signature text primary key,
  mint text not null references launches(mint) on delete cascade,
  claimed_at timestamptz not null,
  amount_sol numeric, amount_usdc numeric, claimer text
);
create index if not exists fee_claims_mint_idx on fee_claims (mint, claimed_at desc);

-- 7. AI outputs
create table if not exists ai_summaries (
  mint text primary key references launches(mint) on delete cascade,
  tldr text not null,
  points jsonb not null default '[]',
  recent jsonb not null default '[]',
  watchouts jsonb not null default '[]',
  sources jsonb not null default '[]',
  updated_at timestamptz not null default now()
);
create table if not exists repo_analyses (
  mint text primary key references launches(mint) on delete cascade,
  repo text not null,
  score int check (score between 0 and 100),
  verdict text,
  stats jsonb not null default '{}',
  languages jsonb not null default '[]',
  findings jsonb not null default '[]',
  updated_at timestamptz not null default now()
);
