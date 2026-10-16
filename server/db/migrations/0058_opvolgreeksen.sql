-- Volgen (F2 en F7): de volgende beste stap per account en opvolgreeksen die vanzelf stoppen.
-- reekssjablonen: de sjablonen van de organisatie (startset uit shared/opvolgreeks.ts: Na informatie, Na voicemail,
-- Na eerste gesprek). reeksen: hooguit één lopende of gepauzeerde reeks per account, met mandaat C (elke stap
-- goedkeuren) of B (binnen kader). reeksstappen: per dag een stap (mail, LinkedIn, bellen of het einde) met status,
-- de taak en het concept van de Schrijver. volgen_keuzes: Doe het nu, Plan in en Niet nu, de leerlus van de weging.
-- De startsjablonen worden vóór het aanzetten van RLS ingevoegd (de migratie draait als eigenaar); nieuwe
-- organisaties krijgen ze bij het eerste gebruik (server/utils/opvolgreeks.ts, zorgVoorSjablonen).

create table reekssjablonen (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  sleutel         text not null,
  naam            text not null,
  omschrijving    text,
  na              text,
  -- stappen: [{dag, kanaal: mail|linkedin|bellen, titel, instructie?}]; einde: {dag, wachtDagen}.
  stappen         jsonb not null,
  einde           jsonb not null,
  actief          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organisation_id, sleutel)
);

create table reeksen (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  account_id      text not null references accounts(id) on delete cascade,
  contact_id      text references contacts(id) on delete set null,
  sjabloon_id     text references reekssjablonen(id) on delete set null,
  naam            text not null,
  owner_id        text not null references users(id),
  mandaat         text not null default 'C' check (mandaat in ('B', 'C')),
  status          text not null default 'loopt' check (status in ('loopt', 'gepauzeerd', 'gestopt', 'klaar')),
  stopreden       text check (stopreden in ('reactie', 'afspraak', 'nee', 'afmelding', 'handmatig')),
  gestart_op      timestamptz not null default now(),
  gepauzeerd_op   timestamptz,
  gestopt_op      timestamptz,
  -- ritmeVoor (de stand van het hercontactritme bij de start), belTerugTaakId, stopToelichting.
  data            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index reeksen_een_lopend on reeksen (account_id) where status in ('loopt', 'gepauzeerd');
create index reeksen_org_status on reeksen (organisation_id, status);

create table reeksstappen (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  reeks_id        text not null references reeksen(id) on delete cascade,
  volgnummer      int not null,
  dag             int not null,
  kanaal          text not null check (kanaal in ('mail', 'linkedin', 'bellen', 'einde')),
  titel           text not null,
  instructie      text,
  status          text not null default 'gepland' check (status in ('gepland', 'open', 'gedaan', 'overgeslagen', 'tegengehouden')),
  gepland_op      timestamptz not null,
  task_id         text references tasks(id) on delete set null,
  concept_id      text references concepten(id) on delete set null,
  reden           text,
  gedaan_op       timestamptz,
  data            jsonb not null default '{}'::jsonb,
  unique (reeks_id, volgnummer)
);
create index reeksstappen_aan_de_beurt on reeksstappen (organisation_id, status, gepland_op);
create index reeksstappen_taak on reeksstappen (task_id) where task_id is not null;

create table volgen_keuzes (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  account_id      text not null references accounts(id) on delete cascade,
  contact_id      text,
  gebruiker_id    text not null references users(id),
  stap_sleutel    text not null,
  soort           text not null,
  keuze           text not null check (keuze in ('nu', 'plan', 'niet-nu', 'alternatief')),
  reden           text check (reden in ('al-gedaan', 'klopt-niet', 'later')),
  tot             date,
  task_id         text,
  op              timestamptz not null default now()
);
create index volgen_keuzes_account on volgen_keuzes (account_id, op desc);
create index volgen_keuzes_leerlus on volgen_keuzes (gebruiker_id, keuze, reden, op);

-- Startsjablonen voor elke bestaande organisatie (zelfde inhoud als STARTSJABLONEN in shared/opvolgreeks.ts).
insert into reekssjablonen (organisation_id, sleutel, naam, omschrijving, na, stappen, einde)
select o.id, s.sleutel, s.naam, s.omschrijving, s.na, s.stappen::jsonb, s.einde::jsonb
from organisations o
cross join (values
  ('na-informatie', 'Na informatie', 'De beloofde informatie met het winpunt, een LinkedIn-connectie, een belmoment en een praktijkvoorbeeld.', 'Stuur maar wat informatie',
   '[{"dag":0,"kanaal":"mail","titel":"Mail: de beloofde informatie met het winpunt"},{"dag":3,"kanaal":"linkedin","titel":"LinkedIn: connectieverzoek met een korte notitie"},{"dag":6,"kanaal":"bellen","titel":"Bellen: heeft u de informatie kunnen bekijken?"},{"dag":10,"kanaal":"mail","titel":"Mail: praktijkvoorbeeld uit dezelfde branche"}]',
   '{"dag":21,"wachtDagen":30}'),
  ('na-voicemail', 'Na voicemail', 'Een korte mail na je voicemail, een tweede belpoging op een ander uur, LinkedIn en een laatste vraag.', 'Voicemail ingesproken',
   '[{"dag":0,"kanaal":"mail","titel":"Mail: kort bericht na je voicemail"},{"dag":2,"kanaal":"bellen","titel":"Bellen: tweede poging op een ander uur"},{"dag":5,"kanaal":"linkedin","titel":"LinkedIn: connectieverzoek met een korte notitie"},{"dag":9,"kanaal":"mail","titel":"Mail: één korte vraag om af te sluiten"}]',
   '{"dag":16,"wachtDagen":30}'),
  ('na-eerste-gesprek', 'Na eerste gesprek', 'De samenvatting van het gesprek, een LinkedIn-connectie, een belmoment om de afspraak te plannen en een praktijkvoorbeeld.', 'Eerste gesprek gevoerd',
   '[{"dag":0,"kanaal":"mail","titel":"Mail: samenvatting en de afgesproken volgende stap"},{"dag":2,"kanaal":"linkedin","titel":"LinkedIn: connectie met een verwijzing naar het gesprek"},{"dag":7,"kanaal":"bellen","titel":"Bellen: stand van zaken en de afspraak plannen"},{"dag":14,"kanaal":"mail","titel":"Mail: praktijkvoorbeeld bij wat jullie vertelden"}]',
   '{"dag":24,"wachtDagen":21}')
) as s(sleutel, naam, omschrijving, na, stappen, einde)
where o.status <> 'systeem'
on conflict (organisation_id, sleutel) do nothing;

do $$
declare t text;
begin
  foreach t in array array['reekssjablonen', 'reeksen', 'reeksstappen', 'volgen_keuzes'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy org_isolation on %I using (organisation_id = current_org_id()) with check (organisation_id = current_org_id())', t);
  end loop;
end $$;
