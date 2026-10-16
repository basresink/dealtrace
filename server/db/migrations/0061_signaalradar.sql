-- Signaalradar (F5): elk inzicht krijgt een signaalsoort uit de vaste lijst in shared/signaalradar.ts. De
-- kolom is optioneel: zonder waarde leidt de radar de soort af uit het type en de tekst van het inzicht
-- (signaalsoortVan). Nieuwe inzichten van de agents krijgen de soort bij het opslaan. De radar telt per
-- branche en signaalsoort over de laatste 30 dagen en de zes perioden daarvoor; daarvoor een index op
-- organisatie en datum. signals heeft al rijbeveiliging op organisation_id (0006); die geldt ook voor deze
-- kolom en wordt hier opnieuw afgedwongen.

alter table signals add column if not exists signaalsoort text;
alter table signals drop constraint if exists signals_signaalsoort_check;
alter table signals add constraint signals_signaalsoort_check check (signaalsoort is null or signaalsoort in ('vacatures', 'nieuwe-vestiging', 'nieuwbouw-vergunning', 'directiewissel', 'subsidie-regeling', 'overname', 'overig'));
create index if not exists signals_radar_idx on signals (organisation_id, created_at desc);

alter table signals enable row level security;
alter table signals force row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'signals' and policyname = 'org_isolation') then
    create policy org_isolation on signals using (organisation_id = current_org_id()) with check (organisation_id = current_org_id());
  end if;
end $$;

-- De zijbalkfunctie: aan vanaf Gevorderd (de migratie zet daarna de hele startindeling; dit maakt de
-- migratie ook los toe te passen).
insert into functies_per_niveau (functie, niveau, aan, organisation_id, gewijzigd_door) values
  ('nav.signaalradar', 'beginner', false, null, 'startindeling'),
  ('nav.signaalradar', 'gevorderd', true, null, 'startindeling'),
  ('nav.signaalradar', 'expert', true, null, 'startindeling')
on conflict do nothing;
