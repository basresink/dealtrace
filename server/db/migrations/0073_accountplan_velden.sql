-- Accountplannen compleet: eigen velden kunnen ook bij een accountplan horen (object accountplan, in DealDrive
-- "Extra velden"). De waarden staan in accountplannen.data.velden; notities in accountplannen.data.notities.
-- Verder geen nieuwe kolommen: eigenaar, periode, contactpersonen en acties (taken) bestonden al (0048).
alter table eigen_velden drop constraint if exists eigen_velden_object_check;
alter table eigen_velden add constraint eigen_velden_object_check check (object in ('account', 'contact', 'campagne', 'afspraak', 'accountplan'));
