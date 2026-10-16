-- Openstaande inrichtingspunten na de bouw op de roadmap van Dealtrace zelf (org-dealtrace, /platform/roadmap). Idempotent op titel.
insert into feature_requests (organisation_id, titel, omschrijving, status, prioriteit, door)
select 'org-dealtrace', 'Netlify-token intrekken',
  'Het tijdelijke Netlify-token dat tijdens de bouw voor deploy-polling en de functions-regio is gebruikt, intrekken in Netlify (User settings, Applications, Personal access tokens).',
  'ingediend', 'hoog', 'systeem'
where not exists (select 1 from feature_requests where organisation_id = 'org-dealtrace' and titel = 'Netlify-token intrekken');

insert into feature_requests (organisation_id, titel, omschrijving, status, prioriteit, door)
select 'org-dealtrace', 'Supabase-wachtwoord resetten',
  'Het databasewachtwoord van Supabase resetten, omdat het tijdens de bouw is gedeeld. Daarna DATABASE_URL en de beheer-URL in Netlify bijwerken.',
  'ingediend', 'hoog', 'systeem'
where not exists (select 1 from feature_requests where organisation_id = 'org-dealtrace' and titel = 'Supabase-wachtwoord resetten');

insert into feature_requests (organisation_id, titel, omschrijving, status, prioriteit, door)
select 'org-dealtrace', 'Netlify-sleutels: VAPID, EU-transcriptiedienst en HubSpot',
  'In Netlify zetten: de VAPID-sleutels voor pushmeldingen, de sleutel en regio van de EU-transcriptiedienst, en de HubSpot-variabelen (o.a. HUBSPOT_PORTAAL).',
  'ingediend', 'hoog', 'systeem'
where not exists (select 1 from feature_requests where organisation_id = 'org-dealtrace' and titel = 'Netlify-sleutels: VAPID, EU-transcriptiedienst en HubSpot');

insert into feature_requests (organisation_id, titel, omschrijving, status, prioriteit, door)
select 'org-dealtrace', 'Netlify-sleutels: AI',
  'In Netlify zetten: AI_PROVIDER en LLM_KEY_SECRET. Daarna een AI-sleutel invoeren via /platform/ai.',
  'ingediend', 'hoog', 'systeem'
where not exists (select 1 from feature_requests where organisation_id = 'org-dealtrace' and titel = 'Netlify-sleutels: AI');

insert into feature_requests (organisation_id, titel, omschrijving, status, prioriteit, door)
select 'org-dealtrace', 'Netlify-sleutels: Stripe, GitHub, Moneybird en Resend',
  'In Netlify zetten: STRIPE_WEBHOOK_SECRET, GITHUB_TOKEN en GITHUB_REPO, MONEYBIRD_TOKEN en RESEND_API_KEY.',
  'ingediend', 'middel', 'systeem'
where not exists (select 1 from feature_requests where organisation_id = 'org-dealtrace' and titel = 'Netlify-sleutels: Stripe, GitHub, Moneybird en Resend');

insert into feature_requests (organisation_id, titel, omschrijving, status, prioriteit, door)
select 'org-dealtrace', 'DealDrive-koppeling per organisatie inrichten',
  'Per klantorganisatie de DealDrive-koppeling inrichten (url, geheim en test) via Instellingen, Koppelingen, DealDrive.',
  'ingediend', 'middel', 'systeem'
where not exists (select 1 from feature_requests where organisation_id = 'org-dealtrace' and titel = 'DealDrive-koppeling per organisatie inrichten');

insert into feature_requests (organisation_id, titel, omschrijving, status, prioriteit, door)
select 'org-dealtrace', 'WhatsApp-provider kiezen',
  'Een WhatsApp Business-provider kiezen (open vraag 11) en de koppeling van mock naar productie zetten.',
  'ingediend', 'middel', 'systeem'
where not exists (select 1 from feature_requests where organisation_id = 'org-dealtrace' and titel = 'WhatsApp-provider kiezen');
