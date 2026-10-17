-- Testronde, Prospects of klanten: Dealtrace is new business. Het onderhoudsritme van klanten hoort in
-- DealDrive, dus de motor maakt geen beltaken voor klanten (shared/regelPatronen.ts sluit ze uit).
-- Deze migratie ruimt de oude inrichting op, zonder iets anders te wijzigen:
-- 1. De rij klant verdwijnt uit de belmatrix van elke organisatie.
-- 2. In de afbakening van regels verdwijnt het accounttype klant. Een regel die alleen voor klanten gold,
--    gaat uit: anders zou een lege afbakening hem stil voor alle prospects laten gelden.
-- De klassen op het tabblad Klanten blijven bewaard: de lijst Bestaande klanten (uit DealDrive) toont ze.

update org_settings set value = value - 'klant'
 where key = 'belmatrix' and jsonb_typeof(value) = 'object' and value ? 'klant';

update activity_rules
   set actief = false, updated_at = now()
 where jsonb_typeof(data->'afbakening'->'accounttypes') = 'array'
   and data->'afbakening'->'accounttypes' ? 'klant'
   and not (data->'afbakening'->'accounttypes' ? 'prospect');

update activity_rules
   set data = jsonb_set(data, '{afbakening,accounttypes}',
         coalesce((select jsonb_agg(t) from jsonb_array_elements(data->'afbakening'->'accounttypes') t where t <> '"klant"'::jsonb), '["prospect"]'::jsonb)),
       updated_at = now()
 where jsonb_typeof(data->'afbakening'->'accounttypes') = 'array'
   and data->'afbakening'->'accounttypes' ? 'klant';
