-- P31: spraak, visitekaartje en meldingen voor onderweg. Transcripten 12 maanden; concepten van
-- spraakopdrachten die offline zijn ingesproken; een log van onderweg-meldingen (verstuurd,
-- uitgesteld of overgeslagen met reden), waarvan de sleutel dubbel versturen voorkomt.
create table transcripten (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  bijlage_id      text,
  record_soort    text,
  record_id       text,
  tekst           text not null,
  taal            text not null default 'nl',
  dienst          text not null,
  duur_sec        int not null default 0,
  bewaren_tot     date not null default (current_date + interval '12 months'),
  op              timestamptz not null default now()
);
create table spraak_concepten (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  gebruiker_id    text not null references users(id) on delete cascade,
  uitkomst        jsonb not null,
  status          text not null default 'open' check (status in ('open', 'bewaard', 'weg')),
  op              timestamptz not null default now()
);
create table melding_log (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  gebruiker_id    text not null references users(id) on delete cascade,
  soort           text not null,
  sleutel         text not null,
  status          text not null check (status in ('verstuurd', 'uitgesteld', 'overgeslagen')),
  reden           text,
  op              timestamptz not null default now(),
  unique (gebruiker_id, sleutel)
);
create index melding_log_dag on melding_log (gebruiker_id, op);
alter table push_subscriptions add column if not exists laatst_gebruikt timestamptz;
create unique index if not exists push_subscriptions_endpoint on push_subscriptions (endpoint);
do $$
declare t text;
begin
  foreach t in array array['transcripten', 'spraak_concepten', 'melding_log'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy org_isolation on %I using (organisation_id = current_org_id()) with check (organisation_id = current_org_id())', t);
  end loop;
end $$;
