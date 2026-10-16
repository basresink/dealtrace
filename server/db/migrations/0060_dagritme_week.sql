-- Dagritme: weekreview (vrijdag), weekstart (maandag) en dagstart (elke werkdag), ook per e-mail.
--
-- 1. tasks.verschoven telt hoe vaak een open taak naar een latere dag is geschoven. Een trigger telt,
--    zodat elk pad meetelt (taakvenster, agenda slepen, sync-wachtrij, motor). Aan een belblok hangen
--    telt niet: dat is plannen, geen uitstel. Een taak met drie of meer verschuivingen is een blijver
--    in de weekreview.
-- 2. voornemens: hooguit drie per week uit de weekreview. Elk voornemen wordt meteen iets concreets in
--    de week erna (belblok, taak of regiodag; de verwijzingen staan in data). Gedeeld met de manager
--    komt het als afspraak in coaching_notities.
-- 3. dagritme_momenten: per gebruiker, soort en datum de stand van een moment: de weekreview (besluiten
--    over blijvers, afgerond, verzet naar maandag) en de dagstart (de indeling zoals hij die eerst zag,
--    om te tonen wat er schoof).
-- De e-mailvoorkeuren staan in persoonlijke_instellingen.data.dagritmeMail; dubbel versturen voorkomt
-- melding_log met de sleutel mail:<soort>:<datum>.

alter table tasks add column if not exists verschoven int not null default 0;

create or replace function dealtrace_tel_verschoven() returns trigger
language plpgsql as $$
begin
  if new.status in ('open', 'bezig') and old.due_date is not null and new.due_date is not null
     and (new.due_date at time zone 'Europe/Amsterdam')::date > (old.due_date at time zone 'Europe/Amsterdam')::date
     and new.belblok_id is not distinct from old.belblok_id then
    new.verschoven := coalesce(old.verschoven, 0) + 1;
  end if;
  return new;
end $$;

drop trigger if exists tasks_tel_verschoven on tasks;
create trigger tasks_tel_verschoven before update of due_date on tasks
  for each row execute function dealtrace_tel_verschoven();

create table voornemens (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  gebruiker_id    text not null references users(id) on delete cascade,
  -- De maandag van de week waarin het voornemen geldt (de week na de review).
  week            date not null,
  tekst           text not null,
  soort           text not null check (soort in ('belblok', 'taak', 'regiodag')),
  status          text not null default 'gepland' check (status in ('gepland', 'gedaan', 'niet_gedaan')),
  gedeeld         boolean not null default false,
  coaching_notitie_id text references coaching_notities(id) on delete set null,
  -- taakIds, sessieIds, regioId, datum, dagen, uur: wat het voornemen concreet werd.
  data            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index voornemens_gebruiker_week on voornemens (gebruiker_id, week desc);

create table dagritme_momenten (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  gebruiker_id    text not null references users(id) on delete cascade,
  soort           text not null check (soort in ('weekreview', 'weekstart', 'dagstart')),
  datum           date not null,
  data            jsonb not null default '{}'::jsonb,
  bijgewerkt_op   timestamptz not null default now(),
  unique (gebruiker_id, soort, datum)
);

do $$
declare t text;
begin
  foreach t in array array['voornemens', 'dagritme_momenten'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy org_isolation on %I using (organisation_id = current_org_id()) with check (organisation_id = current_org_id())', t);
  end loop;
end $$;
