-- P10: belblokken, belmodus en belscripts (F07, F08).
create table belscripts (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  naam            text not null,
  doel            text not null check (doel in ('koud', 'opvolging', 'aanleiding', 'winback', 'bevestigen', 'anders')),
  status          text not null default 'concept' check (status in ('concept', 'actief', 'gearchiveerd')),
  versie          int not null default 0,
  eigenaar_id     text,
  basis_script_id text references belscripts(id) on delete set null,
  is_persoonlijk  boolean not null default false,
  gebruiker_id    text,
  controleren     boolean not null default false,
  startset        text,
  data            jsonb not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (not is_persoonlijk or gebruiker_id is not null)
);
create unique index belscripts_startset on belscripts (organisation_id, startset) where startset is not null;

-- Elke activering is een versie; een gesprek bewaart de versie waarmee het liep.
create table belscript_versies (
  id               text primary key default gen_random_uuid()::text,
  organisation_id  text not null references organisations(id) on delete cascade,
  belscript_id     text not null references belscripts(id) on delete cascade,
  versie           int not null,
  naam             text not null,
  doel             text not null,
  data             jsonb not null,
  geactiveerd_op   timestamptz not null default now(),
  geactiveerd_door text,
  unique (belscript_id, versie)
);

-- Een belblok in de eigen agenda (tot de agendakoppeling van P13) met zijn sessie.
create table belblok_sessies (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  gebruiker_id    text not null references users(id) on delete cascade,
  vast_blok_id    text,
  start_op        timestamptz not null,
  eind_op         timestamptz not null,
  status          text not null default 'gepland' check (status in ('gepland', 'bezig', 'klaar', 'geannuleerd')),
  gestart_op      timestamptz,
  gestopt_op      timestamptz,
  data            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index belblok_sessies_gebruiker on belblok_sessies (organisation_id, gebruiker_id, start_op);
-- Nooit twee blokken op hetzelfde moment voor dezelfde gebruiker (de vuller draait vaker per dag).
create unique index belblok_sessies_uniek on belblok_sessies (gebruiker_id, start_op) where status <> 'geannuleerd';

-- AI-invulling per account en scriptversie, 24 uur geldig.
create table belscript_invullingen (
  organisation_id text not null references organisations(id) on delete cascade,
  belscript_id    text not null references belscripts(id) on delete cascade,
  versie          int not null,
  account_id      text not null,
  contact_id      text not null default '',
  data            jsonb not null,
  op              timestamptz not null default now(),
  primary key (belscript_id, versie, account_id, contact_id)
);

alter table tasks add constraint tasks_belblok_fk foreign key (belblok_id) references belblok_sessies(id) on delete set null;
create index tasks_belblok_idx on tasks (belblok_id) where belblok_id is not null;

do $$
declare t text;
begin
  foreach t in array array['belscripts', 'belscript_versies', 'belblok_sessies', 'belscript_invullingen'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy org_isolation on %I using (organisation_id = current_org_id()) with check (organisation_id = current_org_id())', t);
  end loop;
end $$;
create policy platform_alles on belscripts to dealtrace_platform using (true) with check (true);
create policy platform_alles on belscript_versies to dealtrace_platform using (true) with check (true);
