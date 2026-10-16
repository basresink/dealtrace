-- Documenten op de accountkaart (tabblad Documenten): een bijlage krijgt een naam, en kan nu ook aan
-- een account hangen (record_soort 'account', soort 'document').
alter table bijlagen add column if not exists naam text;
alter table bijlagen drop constraint if exists bijlagen_soort_check;
alter table bijlagen add constraint bijlagen_soort_check check (soort in ('foto', 'opname', 'visitekaartje', 'document'));
