-- P28: het verkoopverhaal als leesmodel (F25, ADR-017). Eigen inrichting en spiegel (P29) vullen
-- dezelfde tabellen; elke rij heeft bron en extern_id. Elke functie leest alleen bevestigde inhoud
-- via shared/verkoopverhaal.ts. Het concept van de eigen inrichting staat per onderdeel in
-- vv_sublagen.concept; bevestigen maakt een versie in vv_versies en projecteert naar vv_*.
create table vv_sublagen (
  organisation_id text not null references organisations(id) on delete cascade,
  onderdeel       text not null check (onderdeel in ('golden_circle', 'bedrijfsverhaal', 'ambitie', 'waarde', 'branches', 'concurrenten', 'winpunten', 'terugkomregels')),
  bron            text not null default 'eigen' check (bron in ('eigen', 'salesdna')),
  status          text not null default 'concept' check (status in ('concept', 'bevestigd')),
  versie          int not null default 0,
  bevestigd_op    timestamptz,
  bevestigd_door  text,
  bijgewerkt_op   timestamptz not null default now(),
  verouderd       boolean not null default false,
  controleren     boolean not null default false,
  concept         jsonb not null default '{}'::jsonb,
  primary key (organisation_id, onderdeel)
);
create table vv_versies (
  id              bigint generated always as identity primary key,
  organisation_id text not null references organisations(id) on delete cascade,
  onderdeel       text not null,
  versie          int not null,
  inhoud          jsonb not null,
  bevestigd_op    timestamptz not null default now(),
  door            text,
  unique (organisation_id, onderdeel, versie)
);
create table vv_teksten (
  organisation_id text not null references organisations(id) on delete cascade,
  extern_id       text not null,
  sublaag         text not null,
  sleutel         text not null,
  branche_id      text,
  tekst           text not null,
  kernzin         text,
  versie          int not null default 1,
  bron            text not null default 'eigen',
  primary key (organisation_id, extern_id)
);
create table vv_branches (
  organisation_id text not null references organisations(id) on delete cascade,
  extern_id       text not null,
  naam            text not null,
  focus           text not null check (focus in ('primair', 'secundair')),
  horizon         text check (horizon in ('huidig', 'toekomstig')),
  termijn         text,
  prioriteit      text,
  volgorde        int not null default 0,
  actief          boolean not null default true,
  bron            text not null default 'eigen',
  primary key (organisation_id, extern_id)
);
create table vv_concurrenten (
  organisation_id text not null references organisations(id) on delete cascade,
  extern_id       text not null,
  naam            text not null,
  soort           text not null check (soort in ('direct', 'indirect', 'intern', 'niets')),
  data            jsonb not null default '{}'::jsonb,
  volgorde        int not null default 0,
  actief          boolean not null default true,
  bron            text not null default 'eigen',
  primary key (organisation_id, extern_id)
);
create table vv_fasen (
  organisation_id text not null references organisations(id) on delete cascade,
  extern_id       text not null,
  naam            text not null,
  soort           text,
  volgorde        int not null default 0,
  reis_hoofdfase  text,
  bron            text not null default 'eigen',
  primary key (organisation_id, extern_id)
);
create table vv_winpunten (
  organisation_id text not null references organisations(id) on delete cascade,
  extern_id       text not null,
  fase_id         text,
  titel           text not null,
  omschrijving    text not null,
  waarom          text,
  impact          text not null default 'midden' check (impact in ('hoog', 'midden', 'laag')),
  concurrent_ids  text[] not null default '{}',
  context         jsonb not null default '{}'::jsonb,
  weging          numeric not null default 1,
  volgorde        int not null default 0,
  actief          boolean not null default true,
  bron            text not null default 'eigen',
  primary key (organisation_id, extern_id)
);
create table vv_terugkomregels (
  organisation_id    text not null references organisations(id) on delete cascade,
  extern_id          text not null,
  lijst              text not null check (lijst in ('verloren', 'slapend')),
  reden              text not null,
  termijn            text not null,
  termijn_dagen      int not null,
  kanaal             text not null,
  klassen            text[] not null default '{}',
  rollen             text[] not null default '{}',
  aanpak             text not null,
  hercontactritme_id text,
  volgorde           int not null default 0,
  actief             boolean not null default true,
  bron               text not null default 'eigen',
  primary key (organisation_id, extern_id)
);
-- Eigen aanvullingen: altijd bewerkbaar, ook bij een gespiegeld onderdeel (P29).
create table vv_eigen_opties (organisation_id text not null references organisations(id) on delete cascade, sublaag text not null, veld text not null, waarde text not null, primary key (organisation_id, sublaag, veld, waarde));
create table vv_branche_mapping (organisation_id text not null references organisations(id) on delete cascade, branche_id text not null, sbi_codes text[] not null default '{}', doelgroep_ids text[] not null default '{}', trefwoorden text[] not null default '{}', primary key (organisation_id, branche_id));
create table vv_ambitiedoelen (organisation_id text not null references organisations(id) on delete cascade, extern_id text not null, naam text not null, doel numeric not null, eenheid text not null, jaar int, stand numeric, stand_op date, primary key (organisation_id, extern_id));
create table vv_redenmapping (organisation_id text not null references organisations(id) on delete cascade, bron_soort text not null, reden text not null, terugkomregel_id text, primary key (organisation_id, bron_soort, reden));
create table vv_concurrent_context (organisation_id text not null references organisations(id) on delete cascade, concurrent_id text not null, branche_id text, regio text, tekst text not null, id text primary key default gen_random_uuid()::text);
create table vv_winpunt_branche (organisation_id text not null references organisations(id) on delete cascade, winpunt_id text not null, branche_id text not null, tekst text, primary key (organisation_id, winpunt_id, branche_id));
create table vv_bewijs (id text primary key default gen_random_uuid()::text, organisation_id text not null references organisations(id) on delete cascade, soort text not null, tekst text not null, bij text, bron text);
create table vv_varianten (id text primary key default gen_random_uuid()::text, organisation_id text not null references organisations(id) on delete cascade, onderdeel text not null, sleutel text, kanaal text, gebruiker_id text, tekst text not null, status text not null default 'concept');
create table vv_voorstellen (id text primary key default gen_random_uuid()::text, organisation_id text not null references organisations(id) on delete cascade, onderdeel text not null, ref text, soort text not null, tekst text not null, door text not null, status text not null default 'open' check (status in ('open', 'overgenomen', 'afgewezen')), op timestamptz not null default now());
-- Afgeleid (nachtelijke job): aandeel gesprekken per branche dit kwartaal.
create table nb_branche_stand (organisation_id text not null references organisations(id) on delete cascade, branche_id text not null, kwartaal text not null, accounts int not null default 0, gesprekken int not null default 0, primary key (organisation_id, branche_id, kwartaal));

do $$
declare t text;
begin
  foreach t in array array['vv_sublagen', 'vv_versies', 'vv_teksten', 'vv_branches', 'vv_concurrenten', 'vv_fasen', 'vv_winpunten', 'vv_terugkomregels', 'vv_eigen_opties',
    'vv_branche_mapping', 'vv_ambitiedoelen', 'vv_redenmapping', 'vv_concurrent_context', 'vv_winpunt_branche', 'vv_bewijs', 'vv_varianten', 'vv_voorstellen', 'nb_branche_stand'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy org_isolation on %I using (organisation_id = current_org_id()) with check (organisation_id = current_org_id())', t);
  end loop;
end $$;
-- Versies zijn een log.
revoke update, delete on vv_versies from dealtrace_app;
