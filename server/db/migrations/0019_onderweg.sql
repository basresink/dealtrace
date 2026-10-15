-- P30: onderweg. Bijlagen (foto, opname, visitekaartje) bij een record, met de inhoud in de database
-- tot Supabase Storage is ingericht; de versies van het dagpakket per gebruiker. De locatie van de
-- gebruiker wordt nergens opgeslagen.
create table bijlagen (
  id              text primary key,
  organisation_id text not null references organisations(id) on delete cascade,
  eigenaar_id     text not null references users(id),
  record_soort    text not null,
  record_id       text not null,
  soort           text not null check (soort in ('foto', 'opname', 'visitekaartje')),
  mime            text not null,
  grootte         int not null check (grootte <= 8000000),
  inhoud          bytea,
  status          text not null default 'verstuurd' check (status in ('lokaal', 'verstuurd', 'verwerkt')),
  bewaren_tot     date not null default (current_date + interval '12 months'),
  op              timestamptz not null default now()
);
create index bijlagen_record on bijlagen (record_soort, record_id);
create table dagpakket_versies (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  gebruiker_id    text not null references users(id) on delete cascade,
  datum           date not null,
  versie          text not null,
  grootte         int not null,
  accounts        int not null,
  gemaakt_op      timestamptz not null default now(),
  unique (gebruiker_id, datum)
);
do $$
declare t text;
begin
  foreach t in array array['bijlagen', 'dagpakket_versies'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy org_isolation on %I using (organisation_id = current_org_id()) with check (organisation_id = current_org_id())', t);
  end loop;
end $$;
-- De tegels heten zoals in 8.5.3: "Later terugkomen" en "Geen interesse" (codes blijven later en geen-vervolg).
update meetingsoorten set data = replace(replace(data::text, '"Later opnieuw"', '"Later terugkomen"'), '"Geen vervolg"', '"Geen interesse"')::jsonb
  where slug in ('kennismaking', 'inventarisatie', 'demo');
