-- Belscript Studio: een script per prospect. De accountmanager laat de AI de AI-blokken van het
-- standaardscript vullen voor één prospect, beoordeelt elk blok (bevestigen, aanpassen of verwerpen
-- naar de terugvalzin) en bewaart het resultaat als versie bij dat prospect. Een AI-vulling zonder
-- beoordeling staat als concept (versie null); pas bij bewaren krijgt hij een versienummer. De
-- herkomst per blok ("Gebaseerd op") en de gebruikte gegevens worden bij het vullen bevroren.
create table belscript_prospectversies (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  account_id      text not null references accounts(id) on delete cascade,
  contact_id      text,
  gebruiker_id    text not null references users(id) on delete cascade,
  belscript_id    text not null references belscripts(id) on delete cascade,
  script_versie   int not null,
  status          text not null default 'concept' check (status in ('concept', 'bewaard')),
  versie          int,
  -- blokken (per blok tekst, voorstel, terugval, status en herkomst), bezwaren en de gebruikte gegevens.
  data            jsonb not null,
  samenvatting    text,
  created_at      timestamptz not null default now(),
  bewaard_op      timestamptz,
  check ((status = 'bewaard') = (versie is not null))
);
create unique index belscript_prospectversies_versie on belscript_prospectversies (account_id, versie) where versie is not null;
create index belscript_prospectversies_account on belscript_prospectversies (organisation_id, account_id, status, created_at desc);

alter table belscript_prospectversies enable row level security;
alter table belscript_prospectversies force row level security;
create policy org_isolation on belscript_prospectversies using (organisation_id = current_org_id()) with check (organisation_id = current_org_id());

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'dealtrace_app') then
    grant select, insert, update, delete on belscript_prospectversies to dealtrace_app;
  end if;
end $$;
