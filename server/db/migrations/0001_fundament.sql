-- 0001_fundament: organisaties, gebruikers, teams, instellingen, features per niveau,
-- audit, synchronisatie, activiteitenlog en meldingen (bouwplan 10.1, 10.2, P01).
--
-- Elke tabel heeft id, organisation_id, data jsonb en tijdstempels. Een veld krijgt
-- alleen een kolom als erop gefilterd, geteld of gejoind wordt.
--
-- RLS: de app verbindt als dealtrace_app (zonder bypassrls). Aan het begin van elke
-- transactie zet de server: select set_config('app.organisation_id', '<org>', true).
-- De organisatie komt uit de sessie, nooit uit de payload.

create or replace function current_org_id() returns text
  language sql stable
  as $$ select nullif(current_setting('app.organisation_id', true), '') $$;

create table organisations (
  id                 text primary key default gen_random_uuid()::text,
  name               text not null,
  pakket             text not null default 'starter' check (pakket in ('starter', 'plus', 'compleet')),
  features           jsonb not null default '{}'::jsonb,
  contract           jsonb not null default '{}'::jsonb,
  stripe_customer_id text,
  status             text not null default 'actief',
  data               jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table teams (
  id               text primary key default gen_random_uuid()::text,
  organisation_id  text not null references organisations(id) on delete cascade,
  naam             text not null,
  manager_ids      text[] not null default '{}',
  gekoppelde_teams text[] not null default '{}',
  data             jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index teams_org_idx on teams (organisation_id);

create table users (
  id               text primary key default gen_random_uuid()::text,
  -- null alleen voor de founder (platform, buiten een organisatie).
  organisation_id  text references organisations(id) on delete cascade,
  email            text not null unique,
  name             text not null,
  role             text not null check (role in ('accountmanager', 'salesmanager', 'beheerder', 'founder')),
  niveau           text not null default 'beginner' check (niveau in ('beginner', 'gevorderd', 'expert')),
  team_id          text references teams(id) on delete set null,
  werkplek         text not null default 'binnendienst' check (werkplek in ('binnendienst', 'buitendienst', 'hybride')),
  laatste_inlog    timestamptz,
  status           text not null default 'actief' check (status in ('actief', 'uitgenodigd', 'gearchiveerd')),
  data             jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (role = 'founder' or organisation_id is not null)
);
create index users_org_idx on users (organisation_id);
create index users_team_idx on users (team_id);

create table org_settings (
  organisation_id text not null references organisations(id) on delete cascade,
  key             text not null,
  value           jsonb not null,
  updated_at      timestamptz not null default now(),
  primary key (organisation_id, key)
);

-- Features per niveau (4.2, 4.5). organisation_id null = alle organisaties.
-- Alleen de founder schrijft (P09); de app leest.
create table functies_per_niveau (
  id              text primary key default gen_random_uuid()::text,
  functie         text not null,
  niveau          text not null check (niveau in ('beginner', 'gevorderd', 'expert')),
  aan             boolean not null,
  organisation_id text references organisations(id) on delete cascade,
  gewijzigd_door  text,
  gewijzigd_op    timestamptz not null default now()
);
create unique index functies_per_niveau_uniek on functies_per_niveau (functie, niveau, coalesce(organisation_id, ''));

create table audit_events (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  actor_id        text not null,
  action          text not null,
  resource_type   text not null,
  resource_id     text,
  changes         jsonb,
  metadata        jsonb,
  occurred_at     timestamptz not null default now()
);
create index audit_org_idx on audit_events (organisation_id, occurred_at desc);

-- Conflictgrootboek: per record een versie (bouwplan F24).
create table server_records (
  key             text primary key,
  organisation_id text not null references organisations(id) on delete cascade,
  version         integer not null,
  updated_at      timestamptz not null default now(),
  updated_by      text not null
);
create index server_records_org_idx on server_records (organisation_id);

-- Idempotentie van de synchronisatie: één rij per idempotentiesleutel.
create table mutaties (
  id              text primary key,
  organisation_id text not null references organisations(id) on delete cascade,
  user_id         text not null,
  tabel           text not null,
  op              text not null,
  record_id       text not null,
  resultaat       jsonb not null,
  applied_at      timestamptz not null default now()
);
create index mutaties_org_idx on mutaties (organisation_id);

-- Activiteitenlog: alleen toevoegen (bouwplan 7.4, laag 5).
create table activiteiten (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  account_id      text,
  contact_id      text,
  task_id         text,
  campaign_id     text,
  uitvoerder      text not null default 'mens' check (uitvoerder in ('mens', 'ai')),
  agent           text,
  kanaal          text,
  soort           text not null,
  uitkomst        text,
  script_id       text,
  door            text,
  op              timestamptz not null default now(),
  data            jsonb not null default '{}'::jsonb
);
create index activiteiten_org_idx on activiteiten (organisation_id, op desc);

create table notificaties (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  gebruiker_id    text not null references users(id) on delete cascade,
  soort           text not null check (soort in ('kritiek', 'hot', 'dagstart', 'herinnering', 'inzicht', 'systeem')),
  titel           text not null,
  tekst           text,
  link            text,
  gelezen_op      timestamptz,
  verborgen_op    timestamptz,
  op              timestamptz not null default now(),
  data            jsonb not null default '{}'::jsonb
);
create index notificaties_gebruiker_idx on notificaties (gebruiker_id, op desc);

-- Persoonlijke instellingen (meldingen per soort, stand van de zijbalk), via de sync-wachtrij.
create table persoonlijke_instellingen (
  id              text primary key, -- gelijk aan users.id
  organisation_id text not null references organisations(id) on delete cascade,
  data            jsonb not null default '{}'::jsonb,
  updated_at      timestamptz not null default now()
);

create table push_subscriptions (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  gebruiker_id    text not null references users(id) on delete cascade,
  endpoint        text not null,
  data            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS: org_isolation op elke tabel
-- ---------------------------------------------------------------------------
alter table organisations enable row level security;
alter table organisations force row level security;
create policy org_isolation on organisations using (id = current_org_id()) with check (id = current_org_id());

do $$
declare t text;
begin
  foreach t in array array['teams', 'users', 'org_settings', 'audit_events', 'server_records', 'mutaties',
                           'activiteiten', 'notificaties', 'persoonlijke_instellingen', 'push_subscriptions']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy org_isolation on %I using (organisation_id = current_org_id()) with check (organisation_id = current_org_id())', t);
  end loop;
end $$;

alter table functies_per_niveau enable row level security;
alter table functies_per_niveau force row level security;
create policy lezen on functies_per_niveau for select using (organisation_id is null or organisation_id = current_org_id());

-- ---------------------------------------------------------------------------
-- Sessie: de gebruiker opzoeken voordat de organisatie bekend is
-- ---------------------------------------------------------------------------
-- Security definer: geeft precies één actieve gebruiker terug op id, en niets anders.
create or replace function dealtrace_sessie_gebruiker(p_id text)
  returns table (id text, organisation_id text, email text, name text, role text, niveau text,
                 team_id text, werkplek text, status text, data jsonb)
  language sql stable security definer set search_path = public
  as $$
    select u.id, u.organisation_id, u.email, u.name, u.role, u.niveau, u.team_id, u.werkplek, u.status, u.data
    from users u where u.id = p_id and u.status <> 'gearchiveerd'
  $$;

-- Alleen voor AUTH_MODUS=ontwikkel: de lijst testgebruikers op de inlogpagina.
create or replace function dealtrace_ontwikkel_gebruikers()
  returns table (id text, organisatie text, name text, role text, niveau text, werkplek text)
  language sql stable security definer set search_path = public
  as $$
    select u.id, coalesce(o.name, 'Platform'), u.name, u.role, u.niveau, u.werkplek
    from users u left join organisations o on o.id = u.organisation_id
    where u.status = 'actief'
    order by coalesce(o.name, ''), u.role, u.name
  $$;
