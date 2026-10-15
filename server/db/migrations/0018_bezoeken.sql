-- P14: bezoeken, kansen langs de route en gebieden (F10, F18). Overslaan en klaarzetten per
-- organisatie; de cache van de routedienst bevat alleen punten en reistijden, geen klantgegevens.
create table kans_overslaan (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  gebruiker_id    text not null references users(id) on delete cascade,
  account_id      text not null references accounts(id) on delete cascade,
  tot             date not null,
  reden           text not null,
  op              timestamptz not null default now()
);
create index kans_overslaan_gebruiker on kans_overslaan (gebruiker_id, tot);
create table klaargezet_voor (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  account_id      text not null references accounts(id) on delete cascade,
  van_gebruiker   text not null references users(id),
  voor_gebruiker  text not null references users(id),
  regio_id        text,
  datum           date,
  reden           text not null default '',
  status          text not null default 'open' check (status in ('open', 'ingepland', 'vervallen')),
  op              timestamptz not null default now()
);
create index klaargezet_voor_gebruiker on klaargezet_voor (voor_gebruiker, status);
create table routedienst_cache (
  sleutel   text primary key,
  minuten   int not null,
  km        double precision not null,
  op        timestamptz not null default now()
);
do $$
declare t text;
begin
  foreach t in array array['kans_overslaan', 'klaargezet_voor'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy org_isolation on %I using (organisation_id = current_org_id()) with check (organisation_id = current_org_id())', t);
  end loop;
end $$;
alter table accounts add column if not exists geo_bron text;
