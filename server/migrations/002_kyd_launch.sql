-- Verification (Didit) + in-app launches.

alter table dev_kyc_private
  add column if not exists session_id text,
  add column if not exists session_url text,
  add column if not exists doc_hash text,           -- HMAC(document number + issuing state): duplicate-ID guard, never reversible
  add column if not exists doc_type text,
  add column if not exists signals jsonb not null default '{}',   -- scores + warnings summary (no images, no document numbers)
  add column if not exists ai_review jsonb,         -- AI risk check output
  add column if not exists decided_by text,         -- 'auto' | 'ai+auto' | admin wallet
  add column if not exists decided_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

-- status: pending -> in_progress -> approved | rejected | review
create unique index if not exists kyc_doc_hash_approved
  on dev_kyc_private (doc_hash) where status = 'approved' and doc_hash is not null;
create index if not exists kyc_status_idx on dev_kyc_private (status);

create table if not exists kyd_webhook_events (
  event_id text primary key,
  received_at timestamptz not null default now()
);

alter table launches
  add column if not exists metadata_uri text,
  add column if not exists create_signature text,
  add column if not exists lock_signature text,
  add column if not exists lock_contract text;

-- Profiles can exist before verification finishes; alias uniqueness still applies.
