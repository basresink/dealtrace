-- P18: briefings, Pitstop, concepten en mail. Een briefing is berekend; alleen eigen tekst per blok
-- wordt bewaard. Concepten staan in een eigen tabel met status en overname. Mailsjablonen per
-- organisatie; de mailkoppeling staat in koppelingen (soort mail, geheimen versleuteld).
create table briefing_teksten (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  onderwerp       text not null check (onderwerp in ('afspraak', 'taak')),
  onderwerp_id    text not null,
  blok            text not null,
  tekst           text not null,
  door            text not null,
  op              timestamptz not null default now(),
  unique (organisation_id, onderwerp, onderwerp_id, blok)
);

-- Concepten (8.5.7): wat agents klaarzetten ter goedkeuring. agent_runs blijft het logboek (alleen
-- toevoegen); een concept heeft een status en de overname (11.2).
create table concepten (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  agent           text not null,
  handeling       text not null,
  run_id          text,
  gebruiker_id    text not null references users(id),
  account_id      text references accounts(id) on delete cascade,
  task_id         text,
  appointment_id  text,
  concept         jsonb not null,
  status          text not null default 'klaar' check (status in ('klaar', 'goedgekeurd', 'verworpen', 'verstuurd', 'mislukt')),
  overname        text check (overname in ('ongewijzigd', 'aangepast', 'verworpen')),
  op              timestamptz not null default now(),
  besloten_op     timestamptz
);
create index concepten_gebruiker on concepten (gebruiker_id, status);

create table mailsjablonen (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  naam            text not null,
  kanaal          text not null default 'mail' check (kanaal in ('mail', 'linkedin', 'whatsapp', 'kaart')),
  versie          int not null default 1,
  actief          boolean not null default true,
  data            jsonb not null default '{}'::jsonb,
  updated_at      timestamptz not null default now()
);

alter table koppelingen drop constraint if exists koppelingen_soort_check;
alter table koppelingen add constraint koppelingen_soort_check check (soort in ('kvk', 'datacollectief', 'hubspot', 'salesforce', 'dynamics', 'pipedrive', 'afas', 'salesdna', 'dealdrive', 'mail'));

do $$
declare t text;
begin
  foreach t in array array['briefing_teksten', 'mailsjablonen', 'concepten'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy org_isolation on %I using (organisation_id = current_org_id()) with check (organisation_id = current_org_id())', t);
  end loop;
end $$;
