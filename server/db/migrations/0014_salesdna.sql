-- P29: koppeling met SalesDNA (F25, ADR-002, ADR-017). Gesigneerde webhooks, een alleen-lezen spiegel
-- van bevestigde sublagen, en de projectie naar het leesmodel vv_* met bron 'salesdna'.
alter table koppelingen drop constraint if exists koppelingen_soort_check;
alter table koppelingen add constraint koppelingen_soort_check check (soort in ('kvk', 'datacollectief', 'hubspot', 'salesforce', 'dynamics', 'pipedrive', 'afas', 'salesdna'));

-- Logboek en wachtrij: elk ontvangen bericht, ook dubbele en geweigerde (zonder payload).
create table salesdna_events (
  id              bigint generated always as identity primary key,
  organisation_id text not null references organisations(id) on delete cascade,
  event_id        text,
  soort           text not null,
  onderwerp_id    text,
  versie          int,
  ontvangen_op    timestamptz not null default now(),
  verwerkt_op     timestamptz,
  resultaat       text not null default 'wacht' check (resultaat in ('wacht', 'verwerkt', 'dubbel', 'oud', 'geweigerd', 'fout', 'synchronisatie')),
  fout            text,
  payload_hash    text,
  payload         jsonb
);
create unique index salesdna_events_uniek on salesdna_events (organisation_id, event_id) where resultaat in ('wacht', 'verwerkt', 'oud', 'synchronisatie', 'fout');
create index salesdna_events_org on salesdna_events (organisation_id, ontvangen_op desc);

-- De spiegel: per sublaag de laatst ontvangen bevestigde inhoud, ongewijzigd.
create table salesdna_sublagen (
  organisation_id text not null references organisations(id) on delete cascade,
  onderwerp_id    text not null,
  status          text not null default 'bevestigd' check (status in ('bevestigd', 'leeg', 'overgeslagen')),
  versie          int not null default 0,
  bevestigd_op    timestamptz,
  bijgewerkt_op   timestamptz,
  verouderd       boolean not null default false,
  verouderd_door  jsonb,
  inhoud          jsonb not null default '{}'::jsonb,
  context         jsonb not null default '{}'::jsonb,
  ontvangen_op    timestamptz not null default now(),
  primary key (organisation_id, onderwerp_id)
);
create table salesdna_sublaag_versies (
  organisation_id text not null references organisations(id) on delete cascade,
  onderwerp_id    text not null,
  versie          int not null,
  inhoud          jsonb not null,
  context         jsonb not null default '{}'::jsonb,
  bevestigd_op    timestamptz,
  bijgewerkt_op   timestamptz,
  ontvangen_op    timestamptz not null default now(),
  primary key (organisation_id, onderwerp_id, versie)
);

-- Herkomst bij overstappen: archief van de eigen inhoud en de kopie bij ontkoppelen.
alter table vv_versies add column status text not null default 'bevestigd' check (status in ('bevestigd', 'gearchiveerd'));
alter table vv_versies add column herkomst text not null default 'eigen';
alter table vv_sublagen add column herkomst text not null default 'eigen';

do $$
declare t text;
begin
  foreach t in array array['salesdna_events', 'salesdna_sublagen', 'salesdna_sublaag_versies'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy org_isolation on %I using (organisation_id = current_org_id()) with check (organisation_id = current_org_id())', t);
  end loop;
end $$;
revoke update, delete on salesdna_sublaag_versies from dealtrace_app;

-- De webhook heeft geen sessie: de organisatie komt uit de koppeling (nooit uit de payload).
-- Geeft alleen organisatie, status en het versleutelde geheim van één SalesDNA-koppeling.
create or replace function dealtrace_salesdna_koppeling(p_id text)
  returns table (organisation_id text, status text, geheimen text)
  language sql stable security definer set search_path = public
  as $$ select k.organisation_id, k.status, k.geheimen from koppelingen k where k.id = p_id and k.soort = 'salesdna' $$;
grant execute on function dealtrace_salesdna_koppeling(text) to dealtrace_app;
