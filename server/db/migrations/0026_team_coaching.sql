-- P21: coaching per accountmanager en de afgeleide KPI-tabel. coaching_sessies houdt een momentopname
-- van de cijfers, de coachingpunten (met "gedeeld") en de afspraken; coaching_notities zijn afspraken
-- (zichtbaar voor de accountmanager) of privé (alleen managers van het team). nb_kpi_dag is afgeleid uit
-- de activiteitenlog en altijd opnieuw te berekenen.
create table coaching_sessies (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  gebruiker_id    text not null,
  manager_id      text not null,
  datum           date not null,
  data            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index coaching_sessies_gebruiker on coaching_sessies (gebruiker_id, datum desc);

create table coaching_notities (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  gebruiker_id    text not null,
  manager_id      text not null,
  soort           text not null check (soort in ('afspraak', 'prive')),
  tekst           text not null,
  termijn         date,
  status          text not null default 'open' check (status in ('open', 'gehaald', 'niet_gehaald')),
  sessie_id       text references coaching_sessies(id) on delete set null,
  data            jsonb not null default '{}'::jsonb,
  op              timestamptz not null default now()
);
create index coaching_notities_gebruiker on coaching_notities (gebruiker_id, op desc);

create table nb_kpi_dag (
  organisation_id text not null references organisations(id) on delete cascade,
  gebruiker_id    text not null,
  datum           date not null,
  metriek         text not null,
  waarde          numeric not null,
  primary key (organisation_id, gebruiker_id, datum, metriek)
);

do $$
declare t text;
begin
  foreach t in array array['coaching_sessies', 'coaching_notities', 'nb_kpi_dag'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy org_isolation on %I using (organisation_id = current_org_id()) with check (organisation_id = current_org_id())', t);
  end loop;
end $$;

alter table signals drop constraint if exists signals_status_check;
alter table signals add constraint signals_status_check check (status in ('nieuw', 'gelezen', 'omgezet', 'afgewezen', 'tegengehouden', 'geaccepteerd', 'later'));
