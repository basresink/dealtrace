-- Accountplannen (opzet van DealDrive /accountplannen): een strategisch plan per klant of prospect met een
-- geldigheid, zes blokken tekst (klantinformatie, doelen SMART, kansen, bedreigingen, strategieën, evaluatie)
-- en een actieplan. De acties zijn echte taken op het account (tasks.accountplan_id), zodat ze ook op de
-- accountkaart, op Vandaag en bij Acties staan. "Verlopen" wordt afgeleid uit geldig_tot en wordt nooit
-- opgeslagen (shared/accountplannen.ts).

create table accountplannen (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  account_id      text not null references accounts(id) on delete cascade,
  owner_id        text,
  titel           text not null,
  status          text not null default 'actueel' check (status in ('actueel', 'afgerond')),
  geldig_van      date,
  geldig_tot      date,
  -- secties (de zes tekstblokken) en contactIds (wie meebeslist).
  data            jsonb not null default '{}'::jsonb,
  door            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (geldig_van is null or geldig_tot is null or geldig_tot >= geldig_van)
);
create index accountplannen_org_idx on accountplannen (organisation_id, status, geldig_tot);
create index accountplannen_account_idx on accountplannen (account_id);

-- Een actie uit het plan is een taak met een verwijzing naar het plan. Gaat het plan weg, dan blijft de taak.
alter table tasks add column if not exists accountplan_id text references accountplannen(id) on delete set null;
create index if not exists tasks_accountplan_idx on tasks (accountplan_id) where accountplan_id is not null;

alter table accountplannen enable row level security;
alter table accountplannen force row level security;
create policy org_isolation on accountplannen using (organisation_id = current_org_id()) with check (organisation_id = current_org_id());
