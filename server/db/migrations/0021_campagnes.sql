-- P16: campagnes (F12). Een campagne heeft een soort, een doelgroep, een winpunt, een doel en een
-- looptijd; de items (één per account) staan in een eigen tabel omdat bord, motor en rapportage erop
-- tellen. Taken verwijzen via tasks.campaign_id.
create table campagnesoorten (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  sleutel         text not null,
  groep           text not null,
  naam            text not null,
  actief          boolean not null default true,
  data            jsonb not null default '{}'::jsonb,
  unique (organisation_id, sleutel)
);
create table campagnes (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  naam            text not null,
  soort           text not null,
  status          text not null default 'concept' check (status in ('concept', 'wacht', 'actief', 'gepauzeerd', 'afgerond')),
  reis_id         text,
  doelgroep_id    text,
  eigenaar_id     text references users(id),
  started_at      date,
  ends_at         date,
  versie          int not null default 1,
  data            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create table campagne_items (
  id                  text primary key default gen_random_uuid()::text,
  organisation_id     text not null references organisations(id) on delete cascade,
  campagne_id         text not null references campagnes(id) on delete cascade,
  account_id          text not null references accounts(id) on delete cascade,
  kolom               text not null default 'gespot' check (kolom in ('gespot', 'benaderd', 'in-gesprek', 'afspraak', 'geparkeerd', 'afgewezen')),
  poging              int not null default 0,
  volgende_stap       text,
  volgende_op         timestamptz,
  eigenaar_id         text references users(id),
  winpunt_uitgevoerd  boolean,
  einddoel_gehaald    boolean not null default false,
  data                jsonb not null default '{}'::jsonb,
  updated_at          timestamptz not null default now(),
  unique (campagne_id, account_id)
);
create index campagne_items_account on campagne_items (account_id);
do $$
declare t text;
begin
  foreach t in array array['campagnesoorten', 'campagnes', 'campagne_items'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy org_isolation on %I using (organisation_id = current_org_id()) with check (organisation_id = current_org_id())', t);
  end loop;
end $$;
