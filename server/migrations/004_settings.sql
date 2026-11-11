-- Small key/value store for values the server sets up itself (e.g. the ID-check workflow id).
create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
