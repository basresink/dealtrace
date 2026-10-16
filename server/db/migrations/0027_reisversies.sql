-- P22: elke gepubliceerde reisversie blijft bewaard (alleen toevoegen), zodat "Draai terug" de vorige
-- versie weer actief kan maken. De activiteitstemplates van die versie gaan mee.
create table reisversies (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  reis_id         text not null references reistemplates(id) on delete cascade,
  versie          int not null,
  naam            text not null,
  data            jsonb not null,
  activiteiten    jsonb not null default '[]'::jsonb,
  gepubliceerd_op timestamptz not null default now(),
  door            text,
  unique (reis_id, versie)
);
alter table reisversies enable row level security;
alter table reisversies force row level security;
create policy org_isolation on reisversies using (organisation_id = current_org_id()) with check (organisation_id = current_org_id());
-- Alleen toevoegen: de app mag een versie nooit wijzigen of verwijderen.
revoke update, delete on reisversies from dealtrace_app;
