-- Vouch core schema: private KYD records, public dev profiles, launches, locks, fee claims, AI outputs.
-- Rule: raw identity data lives ONLY in dev_kyc_private. Public reads go through dev_public_profiles.

create type disclosure_level as enum ('private', 'pseudonymous', 'public');
create type launch_stage as enum ('pending_lock', 'bonding', 'graduated', 'flagged');

-- 1. Private KYC record (service role only; never exposed to anon/authenticated)
create table dev_kyc_private (
  dev_id uuid primary key default gen_random_uuid(),
  provider text not null,                 -- e.g. Sumsub / Persona / Veriff
  provider_applicant_id text not null unique,
  legal_name text,
  date_of_birth date,
  country text,
  address text,
  id_document_ref text,                   -- reference into provider vault, never the image
  checks jsonb not null default '{}',     -- {identity, liveness, screening}
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
alter table dev_kyc_private enable row level security;
-- no policies => only service_role can read/write

-- 2. Public profile (what holders see)
create table dev_profiles (
  dev_id uuid primary key references dev_kyc_private(dev_id) on delete cascade,
  auth_user_id uuid unique,               -- Privy/Supabase user
  alias text not null unique,
  wallet text not null unique,
  disclosure disclosure_level not null default 'private',
  wallet_verified boolean not null default false,
  x_handle text, x_verified boolean not null default false,
  github_login text, github_verified boolean not null default false,
  reveal_name boolean not null default false,
  reveal_region boolean not null default false,
  bio text,
  flagged boolean not null default false,
  flagged_reason text,
  created_at timestamptz not null default now()
);
alter table dev_profiles enable row level security;
create policy "devs edit own profile" on dev_profiles for update using (auth.uid() = auth_user_id);

-- Disclosure can only go up (private -> pseudonymous -> public), never down.
create or replace function enforce_disclosure_monotonic() returns trigger language plpgsql as $$
begin
  if new.disclosure < old.disclosure then
    raise exception 'Disclosure can only be increased';
  end if;
  if old.reveal_name and not new.reveal_name then raise exception 'Cannot un-reveal name'; end if;
  return new;
end $$;
create trigger trg_disclosure_monotonic before update on dev_profiles
  for each row execute function enforce_disclosure_monotonic();

-- Public view: joins only the fields the dev chose to reveal.
create view dev_public_profiles with (security_invoker = false) as
select p.dev_id, p.alias, p.wallet, p.disclosure, p.bio, p.flagged, p.flagged_reason,
       case when p.disclosure <> 'private' then p.x_handle end as x_handle,
       case when p.disclosure <> 'private' then p.github_login end as github_login,
       case when p.reveal_name then k.legal_name end as legal_name,
       case when p.reveal_region then k.country end as region,
       jsonb_build_object(
         'identity', coalesce((k.checks->>'identity')::bool, false),
         'liveness', coalesce((k.checks->>'liveness')::bool, false),
         'screening', coalesce((k.checks->>'screening')::bool, false),
         'wallet', p.wallet_verified, 'x', p.x_verified, 'github', p.github_verified
       ) as checks,
       k.verified_at
from dev_profiles p join dev_kyc_private k using (dev_id)
where k.verified_at is not null;
grant select on dev_public_profiles to anon, authenticated;

-- 3. Launches
create table launches (
  mint text primary key,
  dev_id uuid not null references dev_profiles(dev_id),
  launchpad text not null check (launchpad in ('pumpfun','raydium','bonk','meteora','float')),
  name text not null, symbol text not null, description text, image_url text,
  x_url text, website_url text, github_repo text,
  dev_buy_sol numeric,
  stage launch_stage not null default 'pending_lock',
  created_at timestamptz not null default now()
);
alter table launches enable row level security;
create policy "public read listed launches" on launches for select using (stage <> 'pending_lock');

-- 4. Locks (one per launch; policy: 100% of dev wallet balance, >= 12 months)
create table locks (
  mint text primary key references launches(mint) on delete cascade,
  provider text not null default 'streamflow',
  contract text not null unique,
  amount numeric not null,
  pct_of_dev_allocation numeric not null check (pct_of_dev_allocation = 100),
  starts_at timestamptz not null,
  unlocks_at timestamptz not null,
  check (unlocks_at >= starts_at + interval '12 months'),
  verified_onchain_at timestamptz
);
alter table locks enable row level security;
create policy "public read locks" on locks for select using (true);

-- 5. Creator fee claims (filled by Helius indexer — see original dev-fees.server.ts)
create table fee_claims (
  signature text primary key,
  mint text not null references launches(mint) on delete cascade,
  claimed_at timestamptz not null,
  amount_sol numeric, amount_usdc numeric, claimer text
);
create index on fee_claims (mint, claimed_at desc);
alter table fee_claims enable row level security;
create policy "public read fee claims" on fee_claims for select using (true);

-- 6. AI outputs (summary from X + website; repo analysis from GitHub)
create table ai_summaries (
  mint text primary key references launches(mint) on delete cascade,
  tldr text not null, points jsonb not null default '[]', recent jsonb not null default '[]',
  watchouts jsonb not null default '[]', sources jsonb not null default '[]',
  updated_at timestamptz not null default now()
);
create table repo_analyses (
  mint text primary key references launches(mint) on delete cascade,
  repo text not null, score int check (score between 0 and 100), verdict text,
  stats jsonb not null default '{}', languages jsonb not null default '[]', findings jsonb not null default '[]',
  updated_at timestamptz not null default now()
);
alter table ai_summaries enable row level security;
alter table repo_analyses enable row level security;
create policy "public read summaries" on ai_summaries for select using (true);
create policy "public read repo" on repo_analyses for select using (true);
