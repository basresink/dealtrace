-- P11: leadgenerator met de bronnen AI-zoeker en KvK (F02, ADR-015). Alle waarden van
-- bron en koppelingen.soort staan er meteen in, zodat P15 en P20 geen migratie nodig hebben.
create table lead_rondes (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  gebruiker_id    text not null references users(id) on delete cascade,
  zoekopdracht    jsonb not null,
  hash            text not null,
  bronnen         text[] not null,
  aantal          int not null default 0,
  automatisch     boolean not null default false,
  gestart_op      timestamptz not null default now(),
  kosten          jsonb not null default '{}'::jsonb
);
create index lead_rondes_gebruiker on lead_rondes (organisation_id, gebruiker_id, gestart_op desc);
create index lead_rondes_hash on lead_rondes (organisation_id, hash, gestart_op desc);

create table leads (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  naam            text not null,
  kvk             text,
  domein          text,
  postcode        text,
  plaats          text,
  status          text not null default 'nieuw' check (status in ('nieuw', 'overgenomen', 'afgewezen')),
  bron            text not null check (bron in ('ai', 'kvk', 'datacollectief', 'import', 'crm')),
  bron_ref        text,
  ronde_id        text references lead_rondes(id) on delete set null,
  gevonden_door   text,
  gevonden_op     timestamptz not null default now(),
  dossier_op      timestamptz,
  account_id      text references accounts(id) on delete set null,
  data            jsonb not null default '{}'::jsonb,
  updated_at      timestamptz not null default now()
);
create index leads_ronde on leads (ronde_id);
create index leads_status on leads (organisation_id, status);
create unique index leads_kvk on leads (organisation_id, kvk) where kvk is not null;

create table koppelingen (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  soort           text not null check (soort in ('kvk', 'datacollectief', 'hubspot', 'salesforce', 'dynamics', 'pipedrive', 'afas')),
  status          text not null default 'uit' check (status in ('uit', 'actief', 'fout')),
  -- Versleuteld met AES-256-GCM; gaat nooit naar de client of een log.
  geheimen        text,
  instellingen    jsonb not null default '{}'::jsonb,
  getest_op       timestamptz,
  updated_at      timestamptz not null default now(),
  unique (organisation_id, soort)
);

create table koppeling_runs (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  koppeling_id    text references koppelingen(id) on delete set null,
  soort           text not null,
  handeling       text not null,
  start           timestamptz not null default now(),
  eind            timestamptz,
  gelezen         int not null default 0,
  geschreven      int not null default 0,
  fouten          jsonb not null default '[]'::jsonb
);
create index koppeling_runs_org on koppeling_runs (organisation_id, start desc);

create table lead_verbruik (
  organisation_id text not null references organisations(id) on delete cascade,
  maand           text not null,
  soort           text not null check (soort in ('ronde', 'dossier', 'kvk', 'datacollectief')),
  aantal          int not null default 0,
  kosten_cent     int not null default 0,
  primary key (organisation_id, maand, soort)
);

create table lead_zoekopdrachten (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  gebruiker_id    text not null references users(id) on delete cascade,
  naam            text not null,
  zoekopdracht    jsonb not null,
  bronnen         text[] not null default '{kvk}',
  automatisch     text not null default 'uit' check (automatisch in ('uit', 'wekelijks')),
  doelgroep_id    text,
  laatst_op       timestamptz,
  created_at      timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['lead_rondes', 'leads', 'koppelingen', 'koppeling_runs', 'lead_verbruik', 'lead_zoekopdrachten'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy org_isolation on %I using (organisation_id = current_org_id()) with check (organisation_id = current_org_id())', t);
  end loop;
end $$;

-- KvK-cache: alleen openbare registerdata, geen klantdata; 30 dagen geldig per KvK-nummer.
create table kvk_cache (
  kvk          text primary key,
  profiel      jsonb not null,
  opgehaald_op timestamptz not null default now()
);
