-- Twee technische punten uit de eindronde van P12 tot en met P33 op de roadmap van Dealtrace zelf
-- (organisatie org-dealtrace, zichtbaar in /platform/roadmap). Idempotent op titel.
insert into feature_requests (organisation_id, titel, omschrijving, status, prioriteit, door)
select 'org-dealtrace', 'Bewaar Bewaker-blokkade bij mail versturen',
  'Als de Bewaker het versturen van een mailconcept blokkeert, gooit verstuurConcept (server/utils/briefing.ts) een fout binnen de transactie van /api/mail/verstuur. Daardoor wordt ook de logregel in agent_runs teruggedraaid en ontbreekt de blokkade op "Vandaag tegengehouden door de Bewaker". Oplossing: hetzelfde patroon als WhatsApp (server/utils/whatsapp.ts): de blokkade teruggeven, en pas na de transactie 403 met de reden. Plus een db-test dat de regel blijft staan.',
  'ingediend', 'hoog', 'systeem'
where not exists (select 1 from feature_requests where organisation_id = 'org-dealtrace' and titel = 'Bewaar Bewaker-blokkade bij mail versturen');

insert into feature_requests (organisation_id, titel, omschrijving, status, prioriteit, door)
select 'org-dealtrace', 'Migraties draaien op een leeg Postgres-cluster',
  'Op een nieuw, leeg cluster stopt de migratie bij 0011, omdat de rol dealtrace_app daar al nodig is terwijl rollen.sql hem pas na alle migraties aanmaakt. Oplossing: de rol (met het wachtwoord uit de omgeving) aanmaken in migreer.ts vóór de eerste migratie, zoals rollen.sql dat nu achteraf doet. Plus een test die migreert op een database zonder de rol.',
  'ingediend', 'middel', 'systeem'
where not exists (select 1 from feature_requests where organisation_id = 'org-dealtrace' and titel = 'Migraties draaien op een leeg Postgres-cluster');
