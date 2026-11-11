-- Meteora: one preset pool config per tax tier, plus per-launch tax + unclaimed creator fees.
create table if not exists meteora_presets (
  tax_bps int not null,
  preset_hash text not null,
  config text not null unique,
  created_by text,
  created_at timestamptz not null default now(),
  primary key (tax_bps, preset_hash)
);
alter table launches add column if not exists tax_bps int;
alter table launches add column if not exists fees_unclaimed_sol numeric;
-- Demo data: LetsBonk / Raydium are retired as launch options.
update launches set launchpad = 'pumpfun' where is_demo and launchpad = 'bonk';
update launches set launchpad = 'meteora' where is_demo and launchpad = 'raydium';
update launches set tax_bps = 300 where is_demo and launchpad = 'meteora' and tax_bps is null;
