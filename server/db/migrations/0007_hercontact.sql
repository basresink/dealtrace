-- P07: hercontactritmes (F13). De startset van vier ritmes staat in shared/hercontact.ts
-- en komt via de startset en na elke migratie in de database.
create table hercontactritmes (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  naam            text not null,
  bron            text not null check (bron in ('koud', 'warm', 'winback')),
  status          text not null default 'actief' check (status in ('actief', 'gearchiveerd')),
  versie          int not null default 1,
  data            jsonb not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table hercontactritmes enable row level security;
alter table hercontactritmes force row level security;
create policy org_isolation on hercontactritmes using (organisation_id = current_org_id()) with check (organisation_id = current_org_id());
create policy platform_alles on hercontactritmes to dealtrace_platform using (true) with check (true);

create index signals_relevantie_idx on signals (organisation_id, status, relevance_score);
create index tasks_signal_idx on tasks (signal_id) where signal_id is not null;
