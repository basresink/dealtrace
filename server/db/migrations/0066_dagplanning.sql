-- Automatische dagplanning (F3 Dagplanner): per gebruiker en werkdag één indeling die de Dagplanner
-- (agent Planner, langs de Bewaker) zelf in de agenda zette. In `data` staan de blokken zoals ze
-- getoond worden, de items die hij schreef (belblokken, voorbereiding, kansen, lunch, focus) met hun
-- sessie- of taak-id en de vorige stand om ongedaan te maken, de vaste punten van dat moment en de
-- wijzigingen bij herplannen ("Wat schoof"). De unieke sleutel op gebruiker en datum maakt de
-- geplande taak idempotent per dag. Status ongedaan: de hele dag is teruggedraaid en wordt die dag
-- niet opnieuw automatisch gepland; voorstel: de Bewaker liet alleen een voorstel toe.
create table dagplanningen (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  gebruiker_id    text not null references users(id) on delete cascade,
  datum           date not null,
  status          text not null default 'gepland' check (status in ('gepland', 'ongedaan', 'voorstel')),
  modus           text not null default 'binnen' check (modus in ('buiten', 'binnen')),
  gepland_op      timestamptz not null default now(),
  herpland_op     timestamptz,
  data            jsonb not null default '{}'::jsonb,
  unique (gebruiker_id, datum)
);
create index dagplanningen_org_datum on dagplanningen (organisation_id, datum);

alter table dagplanningen enable row level security;
alter table dagplanningen force row level security;
create policy org_isolation on dagplanningen using (organisation_id = current_org_id()) with check (organisation_id = current_org_id());
