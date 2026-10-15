-- P13: agenda, afspraken en meetingsoorten (F09). Een afspraak heeft altijd een meetingsoort; na
-- afloop zet één uitkomst de reis, de status en de volgende stap. De agendakoppeling per gebruiker
-- (Microsoft 365, Google) bewaart tokens versleuteld.
create table meetingsoorten (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  slug            text not null,
  naam            text not null,
  type            text not null check (type in ('klant', 'intern')),
  duur_min        int not null check (duur_min between 5 and 480),
  vorm            text not null check (vorm in ('bezoek', 'online', 'telefoon')),
  versie          int not null default 1,
  actief          boolean not null default true,
  data            jsonb not null default '{}'::jsonb,
  unique (organisation_id, slug)
);
create table appointments (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  owner_id        text not null references users(id),
  gepland_door    text references users(id),
  account_id      text references accounts(id) on delete set null,
  contact_id      text references contacts(id) on delete set null,
  meetingsoort_id text not null references meetingsoorten(id),
  vorm            text not null check (vorm in ('bezoek', 'online', 'telefoon')),
  status          text not null default 'gepland' check (status in ('gepland', 'afgerond', 'niet_verschenen', 'geannuleerd')),
  start_at        timestamptz not null,
  end_at          timestamptz not null,
  uitkomst_code   text,
  uitkomst_op     timestamptz,
  task_id         text references tasks(id) on delete set null,
  versie          int not null default 1,
  data            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (end_at > start_at)
);
create index appointments_owner_start on appointments (organisation_id, owner_id, start_at);
create index appointments_account on appointments (account_id, start_at);
create table agenda_koppelingen (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  gebruiker_id    text not null references users(id) on delete cascade,
  provider        text not null check (provider in ('microsoft', 'google')),
  tokens          text,
  status          text not null default 'actief' check (status in ('actief', 'fout', 'uit')),
  laatste_sync    timestamptz,
  data            jsonb not null default '{}'::jsonb,
  unique (gebruiker_id, provider)
);
do $$
declare t text;
begin
  foreach t in array array['meetingsoorten', 'appointments', 'agenda_koppelingen'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy org_isolation on %I using (organisation_id = current_org_id()) with check (organisation_id = current_org_id())', t);
  end loop;
end $$;
