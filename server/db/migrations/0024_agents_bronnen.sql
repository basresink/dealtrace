-- P19: Waarnemer-profielen per doelgroep (signaalsoorten met trefwoorden, minimale relevantie, winpunt,
-- cadans) en de status tegengehouden voor inzichten die de bewijsplicht of de Bewaker tegenhield.
create table waarnemer_profielen (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  doelgroep_id    text,
  data            jsonb not null default '{}'::jsonb,
  versie          int not null default 1,
  updated_at      timestamptz not null default now(),
  door            text,
  unique (organisation_id, doelgroep_id)
);
alter table waarnemer_profielen enable row level security;
alter table waarnemer_profielen force row level security;
create policy org_isolation on waarnemer_profielen using (organisation_id = current_org_id()) with check (organisation_id = current_org_id());

alter table signals drop constraint if exists signals_status_check;
alter table signals add constraint signals_status_check check (status in ('nieuw', 'gelezen', 'omgezet', 'afgewezen', 'tegengehouden'));
