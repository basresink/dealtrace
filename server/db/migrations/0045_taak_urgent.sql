-- Taken krijgen een vierde prioriteit: urgent (opzet van DealDrive: Laag, Middel, Hoog, Urgent).
-- Regels houden hun drie niveaus; urgent zet een gebruiker zelf bij het maken of bewerken van een taak.
alter table tasks drop constraint if exists tasks_priority_check;
alter table tasks add constraint tasks_priority_check check (priority in ('urgent', 'hoog', 'middel', 'laag'));
