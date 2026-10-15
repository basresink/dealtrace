-- P06: de motor (F15), regels, runs, en de taken en inzichten die hij klaarzet
-- (F06; P07 bouwt de schermen en het afronden erop).

create table activity_rules (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  code            text,
  naam            text not null,
  categorie       text not null default 'Bewerken',
  actief          boolean not null default true,
  motor           text not null default 'regel' check (motor in ('regel', 'ai')),
  scope           text not null default 'organisatie' check (scope in ('organisatie', 'team', 'persoonlijk')),
  team_id         text,
  eigenaar_id     text,
  reis_id         text,
  fase_id         text,
  cadans_dagen    int not null default 7,
  prioriteit      text not null default 'middel' check (prioriteit in ('hoog', 'middel', 'laag')),
  versie          int not null default 1,
  data            jsonb not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (scope <> 'persoonlijk' or eigenaar_id is not null),
  check (scope <> 'team' or team_id is not null)
);
create index activity_rules_org_idx on activity_rules (organisation_id, actief);

create table rule_runs (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  rule_id         text,
  soort           text not null check (soort in ('uur', 'gebeurtenis', 'handmatig')),
  gestart_op      timestamptz not null default now(),
  eind_op         timestamptz,
  geraakt         int not null default 0,
  taken           int not null default 0,
  inzichten       int not null default 0,
  geschoven       int not null default 0,
  fouten          jsonb not null default '[]'::jsonb,
  stappen         jsonb not null default '[]'::jsonb,
  door            text
);
create index rule_runs_org_idx on rule_runs (organisation_id, rule_id, gestart_op desc);

create table signals (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  account_id      text references accounts(id) on delete cascade,
  contact_id      text,
  owner_id        text,
  rule_id         text,
  onderwerp       text,
  agent           text,
  type            text not null,
  title           text not null,
  relevance_score int not null default 50,
  confidence      numeric,
  status          text not null default 'nieuw' check (status in ('nieuw', 'gelezen', 'omgezet', 'afgewezen')),
  bron            text not null default 'intern' check (bron in ('intern', 'extern')),
  data            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index signals_org_idx on signals (organisation_id, owner_id, status);
create index signals_regel_idx on signals (organisation_id, rule_id, onderwerp);

create table tasks (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  owner_id        text,
  account_id      text references accounts(id) on delete cascade,
  contact_id      text,
  signal_id       text references signals(id) on delete set null,
  rule_id         text,
  onderwerp       text,
  campaign_id     text,
  belblok_id      text,
  action_type     text not null default 'taak',
  title           text not null,
  status          text not null default 'open' check (status in ('open', 'bezig', 'klaar', 'geannuleerd')),
  priority        text not null default 'middel' check (priority in ('hoog', 'middel', 'laag')),
  due_date        timestamptz,
  uitkomst        text,
  later_op        date,
  executor        text,
  executor_status text,
  data            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index tasks_org_idx on tasks (organisation_id, owner_id, status, due_date);
create index tasks_regel_idx on tasks (organisation_id, rule_id, onderwerp);
create index tasks_account_idx on tasks (account_id);

do $$
declare t text;
begin
  foreach t in array array['activity_rules', 'rule_runs', 'signals', 'tasks'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy org_isolation on %I using (organisation_id = current_org_id()) with check (organisation_id = current_org_id())', t);
  end loop;
end $$;

-- De startset (Platformbeheer) laadt de 23 regels als dealtrace_platform: regels zijn inrichting.
create policy platform_alles on activity_rules to dealtrace_platform using (true) with check (true);
