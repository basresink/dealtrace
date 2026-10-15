-- Beperkte applicatierol (bouwplan 10.1). Draait na elke migratie en is idempotent.
-- De eigenaar van de tabellen (postgres) omzeilt RLS voor migraties en seed; de app nooit.
-- :'app_wachtwoord' wordt door migreer.ts ingevuld.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'dealtrace_app') then
    execute format('create role dealtrace_app with login password %L nosuperuser nocreatedb nocreaterole nobypassrls', current_setting('dealtrace.app_wachtwoord'));
  end if;
end $$;

grant usage on schema public to dealtrace_app;
grant select, insert, update, delete on all tables in schema public to dealtrace_app;
grant usage, select on all sequences in schema public to dealtrace_app;

-- Activiteitenlog: alleen toevoegen.
revoke update, delete on activiteiten from dealtrace_app;
-- Features per niveau: alleen de founder schrijft, via de platformlaag (P09).
revoke insert, update, delete on functies_per_niveau from dealtrace_app;
-- Organisaties aanmaken of verwijderen is platformwerk (P02).
revoke insert, delete on organisations from dealtrace_app;

grant execute on function current_org_id() to dealtrace_app;
grant execute on function dealtrace_sessie_gebruiker(text) to dealtrace_app;
grant execute on function dealtrace_ontwikkel_gebruikers() to dealtrace_app;
