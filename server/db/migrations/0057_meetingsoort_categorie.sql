-- Type afspraak in twee groepen (opzet van DealDrive): elke meetingsoort krijgt een categorie. "bezoek"
-- is de groep Afspraak (op locatie: Gepland bezoek, Ongepland bezoek, Demo, Event, Beurs) en geeft de
-- vorm bezoek en de route; "meeting" is de groep Meeting (op afstand: Online meeting, Belafspraak,
-- Online demo, Webinar, Accountoverleg) en geeft de vorm online of telefoon.
--
-- Bestaande soorten blijven staan en krijgen de categorie die bij hun vorm past. De soort met slug demo
-- was een online demo: die heet voortaan Online demo (alleen als de beheerder de naam niet wijzigde),
-- zodat de nieuwe Demo op locatie ernaast kan staan. De nieuwe soorten uit de startset
-- (shared/agenda.ts, MEETINGSOORTEN_START) zet de migratiestap zorgVoorMeetingsoorten erbij voor elke
-- organisatie, idempotent op slug.

alter table meetingsoorten add column if not exists categorie text;
update meetingsoorten set categorie = case when vorm = 'bezoek' then 'bezoek' else 'meeting' end where categorie is null;
alter table meetingsoorten alter column categorie set default 'meeting';
alter table meetingsoorten alter column categorie set not null;
alter table meetingsoorten add constraint meetingsoorten_categorie_check check (categorie in ('bezoek', 'meeting'));

update meetingsoorten set naam = 'Online demo', versie = versie + 1 where slug = 'demo' and naam = 'Demo' and vorm = 'online';
