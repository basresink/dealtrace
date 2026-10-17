-- Deactiveren in plaats van verwijderen. Niemand verwijdert nog een prospect in de gewone app; een eigenaar,
-- salesmanager of beheerder deactiveert hem met een verplichte reden en kan hem weer heractiveren.
-- De kolom gedeactiveerd_op is de snelle vlag voor lijsten, motor, belblokken, campagnes en zoeken; de
-- details (wie, reden, toelichting) staan in accounts.data.gedeactivering en de eerdere rondes in
-- accounts.data.deactiveringen. accounts heeft al rijbeveiliging op organisation_id (0001); die geldt ook
-- voor deze kolom en wordt hier opnieuw afgedwongen.
--
-- De deterministische motor (regels, droogloop, accountmatrix, hercontactritme, terugkomregels en de
-- prospectplanning) staat voortaan voor elk niveau aan. Wijzigen van organisatiebrede instellingen blijft
-- aan de beheerder (en waar zo geregeld de salesmanager). De functie prospects.verwijderen vervalt.

alter table accounts add column if not exists gedeactiveerd_op timestamptz;
create index if not exists accounts_actief_idx on accounts (organisation_id) where gedeactiveerd_op is null;
create index if not exists accounts_gedeactiveerd_idx on accounts (organisation_id, gedeactiveerd_op) where gedeactiveerd_op is not null;

alter table accounts enable row level security;
alter table accounts force row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'accounts' and policyname = 'org_isolation') then
    create policy org_isolation on accounts using (organisation_id = current_org_id()) with check (organisation_id = current_org_id());
  end if;
end $$;

-- De motor voor iedereen: deze functies gaan aan voor elk niveau (platformstand en eigen stand per organisatie).
update functies_per_niveau set aan = true, gewijzigd_door = 'migratie 0064', gewijzigd_op = now()
 where functie in ('regels.lezen', 'regels.persoonlijk', 'ritme.lezen', 'matrix.klasseZetten', 'matrix.voorstellen', 'prospects.klasseZetten',
                   'nav.planning', 'planning.jaar', 'planning.inplannen', 'terugkomen.lezen', 'terugkomen.koppelenEnOpbrengst')
   and not aan;

-- De nieuwe functie Deactiveren, aan voor elk niveau; verwijderen bestaat niet meer.
insert into functies_per_niveau (functie, niveau, aan, organisation_id, gewijzigd_door) values
  ('prospects.deactiveren', 'beginner', true, null, 'startindeling'),
  ('prospects.deactiveren', 'gevorderd', true, null, 'startindeling'),
  ('prospects.deactiveren', 'expert', true, null, 'startindeling')
on conflict do nothing;
delete from functies_per_niveau where functie = 'prospects.verwijderen';
