-- P05: doelgroepen, prospectreis, statusmachine en terugkomregels (F05, 7.2, 7.3).
-- De standaardreis zelf staat in shared/reis.ts en wordt na de migratie als echte
-- rij per organisatie gemaakt (migreer.ts en de startset), nooit alleen in code.

create table doelgroepen (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  naam            text not null check (length(trim(naam)) > 0),
  status          text not null default 'concept' check (status in ('concept', 'actief', 'gearchiveerd')),
  prioriteit      int not null default 10,
  versie          int not null default 1,
  data            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index doelgroepen_org_idx on doelgroepen (organisation_id, status, prioriteit);

create table reistemplates (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  naam            text not null,
  doelgroep_id    text references doelgroepen(id) on delete set null,
  versie          int not null default 1,
  status          text not null default 'concept' check (status in ('concept', 'actief', 'gepauzeerd', 'gearchiveerd')),
  is_standaard    boolean not null default false,
  bron            jsonb not null default '{}'::jsonb,
  eigenaar_id     text,
  data            jsonb not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
-- Eén standaardreis per organisatie.
create unique index reistemplates_standaard_uniek on reistemplates (organisation_id) where is_standaard;

create table activiteitstemplates (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  reistemplate_id text not null references reistemplates(id) on delete cascade,
  fase_id         text not null,
  versie          int not null default 1,
  data            jsonb not null
);
create index activiteitstemplates_reis_idx on activiteitstemplates (reistemplate_id, fase_id);

-- Een inschrijving van een account in een reis. Een account zit in hoogstens één
-- actieve reis; heropvolging na een eindfase start een nieuwe inschrijving.
create table prospectreizen (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  reistemplate_id text not null references reistemplates(id),
  template_versie int not null default 1,
  account_id      text not null references accounts(id) on delete cascade,
  fase_id         text not null,
  nb_status       text not null,
  fase_sinds      timestamptz not null default now(),
  gestart_op      timestamptz not null default now(),
  afgerond_op     timestamptz,
  data            jsonb not null default '{}'::jsonb
);
create unique index prospectreizen_een_actief on prospectreizen (account_id) where afgerond_op is null;
create index prospectreizen_org_idx on prospectreizen (organisation_id, reistemplate_id, fase_id);

create table reisgeschiedenis (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  account_id      text not null references accounts(id) on delete cascade,
  prospectreis_id text references prospectreizen(id) on delete set null,
  versie          int not null default 1,
  van_fase_id     text,
  naar_fase_id    text,
  van_status      text,
  naar_status     text,
  gebeurtenis     text not null,
  door            text not null,
  op              timestamptz not null default now(),
  reden           text
);
create index reisgeschiedenis_account_idx on reisgeschiedenis (account_id, op desc);

do $$
declare t text;
begin
  foreach t in array array['doelgroepen', 'reistemplates', 'activiteitstemplates', 'prospectreizen', 'reisgeschiedenis'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy org_isolation on %I using (organisation_id = current_org_id()) with check (organisation_id = current_org_id())', t);
  end loop;
end $$;

create index accounts_reis_idx on accounts (organisation_id, reis_id, fase_id);
create index accounts_terug_idx on accounts (organisation_id, terug_op) where terug_op is not null;

-- Fase, reis en status veranderen alleen via het meldpunt (POST /api/reis/gebeurtenis
-- en de handelingen nee, pauzeer en verplaats), die "dealtrace.meldpunt" zetten.
-- Een rechtstreekse update weigert de database. De eigenaar (migratie, seed) mag wel.
create or replace function dealtrace_alleen_via_meldpunt() returns trigger
  language plpgsql as $$
declare eigenaar text;
begin
  if (new.fase_id is distinct from old.fase_id or new.reis_id is distinct from old.reis_id or new.nb_status is distinct from old.nb_status)
     and coalesce(current_setting('dealtrace.meldpunt', true), '') <> 'aan' then
    select pg_get_userbyid(relowner) into eigenaar from pg_class where oid = 'accounts'::regclass;
    if current_user <> eigenaar then
      raise exception 'Fase en status veranderen alleen via het meldpunt' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger accounts_alleen_via_meldpunt before update of fase_id, reis_id, nb_status on accounts
  for each row execute function dealtrace_alleen_via_meldpunt();

-- De startset (Platformbeheer, P02) maakt de standaardreis als dealtrace_platform.
-- Reistemplates zijn inrichting, geen klantdata.
create policy platform_alles on reistemplates to dealtrace_platform using (true) with check (true);
create policy platform_alles on activiteitstemplates to dealtrace_platform using (true) with check (true);
