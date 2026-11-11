-- Builder API: per-dev keys into the platform's OpenRouter account, metered per request.
create table if not exists builder_keys (
  id uuid primary key default gen_random_uuid(),
  dev_id uuid not null references dev_profiles(dev_id) on delete cascade,
  name text not null,
  prefix text not null,                 -- first chars, for display only
  key_hash text not null unique,        -- sha256 of the full key; the key itself is never stored
  monthly_limit_usd numeric,            -- optional per-key cap (inside the dev's credit)
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index if not exists builder_keys_dev_idx on builder_keys (dev_id) where revoked_at is null;

create table if not exists builder_usage (
  id bigserial primary key,
  key_id uuid not null references builder_keys(id) on delete cascade,
  dev_id uuid not null,
  at timestamptz not null default now(),
  model text,
  prompt_tokens int,
  completion_tokens int,
  cost_usd numeric not null default 0,
  status int,
  latency_ms int,
  stream boolean not null default false,
  generation_id text
);
create index if not exists builder_usage_dev_at on builder_usage (dev_id, at desc);
create index if not exists builder_usage_key_at on builder_usage (key_id, at desc);

-- Per-dev monthly credit override (null = platform default).
alter table dev_profiles add column if not exists builder_credit_usd numeric;
