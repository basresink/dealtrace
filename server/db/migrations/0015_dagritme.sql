-- P32: signaalbesluiten op Vandaag (8.10, 8.13). Het besluit staat op de server, zodat "Gedaan",
-- "Later" en "Weg" op telefoon en laptop gelijk zijn. Eén besluit per gebruiker, signaal en dag.
create table signaal_besluiten (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  gebruiker_id    text not null references users(id) on delete cascade,
  signaal_sleutel text not null,
  besluit         text not null check (besluit in ('gedaan', 'later', 'weg')),
  op              timestamptz not null default now(),
  datum           date not null,
  stil_tot        date not null,
  unique (gebruiker_id, signaal_sleutel, datum)
);
create index signaal_besluiten_gebruiker on signaal_besluiten (gebruiker_id, op desc);
alter table signaal_besluiten enable row level security;
alter table signaal_besluiten force row level security;
create policy org_isolation on signaal_besluiten using (organisation_id = current_org_id()) with check (organisation_id = current_org_id());
