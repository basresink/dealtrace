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
-- P22: gepubliceerde reisversies alleen toevoegen.
revoke update, delete on reisversies from dealtrace_app;

grant execute on function current_org_id() to dealtrace_app;
grant execute on function dealtrace_sessie_gebruiker(text) to dealtrace_app;
grant execute on function dealtrace_ontwikkel_gebruikers() to dealtrace_app;

-- ---------------------------------------------------------------------------
-- P02: platformtabellen en de rol dealtrace_platform
-- ---------------------------------------------------------------------------
-- De app zelf: geen platformaudit en geen gezondheid; aanvragen alleen indienen
-- en lezen; toegangsverzoeken alleen lezen en beslissen.
revoke all on platform_audit, org_gezondheid from dealtrace_app;
revoke update, delete on gebruikersaanvragen from dealtrace_app;
revoke insert, delete on toegangsverzoeken from dealtrace_app;

-- dealtrace_platform: platformtabellen wel, klantdata niet.
grant usage on schema public to dealtrace_platform;
grant select, insert, update on organisations, users, teams, org_settings, gebruikersaanvragen,
  toegangsverzoeken, org_gezondheid to dealtrace_platform;
grant select, insert on platform_audit to dealtrace_platform;
grant insert on audit_events, notificaties to dealtrace_platform;
grant select on functies_per_niveau to dealtrace_platform;
grant execute on function current_org_id() to dealtrace_platform;

-- De app is lid van dealtrace_platform maar erft niets: alleen na een
-- expliciete "set local role dealtrace_platform" (requireFounder).
alter role dealtrace_app noinherit;
grant dealtrace_platform to dealtrace_app;

revoke execute on function dealtrace_platform_tellingen() from public;
grant execute on function dealtrace_platform_tellingen() to dealtrace_platform;
revoke execute on function dealtrace_meld_founders(text, text, text) from public;
grant execute on function dealtrace_meld_founders(text, text, text) to dealtrace_app;

-- Supabase: de standaardrollen anon en authenticated mogen niets in public.
-- Dealtrace praat alleen via de eigen server met de database, nooit via de
-- automatische REST-API van Supabase. Lokaal bestaan deze rollen niet.
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on all tables in schema public from %I', r);
      execute format('revoke all on all sequences in schema public from %I', r);
      execute format('revoke all on all functions in schema public from %I', r);
      execute format('alter default privileges in schema public revoke all on tables from %I', r);
      execute format('alter default privileges in schema public revoke all on sequences from %I', r);
      execute format('alter default privileges in schema public revoke all on functions from %I', r);
    end if;
  end loop;
end $$;
-- Functies zijn standaard voor iedereen uitvoerbaar; alleen de app-rol mag ze.
revoke execute on function dealtrace_sessie_gebruiker(text) from public;
revoke execute on function dealtrace_ontwikkel_gebruikers() from public;
grant execute on function dealtrace_sessie_gebruiker(text) to dealtrace_app;
grant execute on function dealtrace_ontwikkel_gebruikers() to dealtrace_app;

-- Beheerregel voor de eigenaar van de tabellen. Alle tabellen hebben FORCE ROW
-- LEVEL SECURITY, dus ook de eigenaar valt onder RLS. Lokaal is de eigenaar
-- superuser en merkt dat niet; op Supabase is postgres geen superuser. Deze regel
-- geldt alleen voor de rol die migreert en seedt, nooit voor dealtrace_app.
do $$
declare t text;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'beheer_eigenaar') then
      execute format('create policy beheer_eigenaar on %I to %I using (true) with check (true)', t, current_user);
    end if;
  end loop;
end $$;

-- P03: index voor filterbare eigen velden (alleen de app, alleen via de functie).
revoke execute on function dealtrace_index_eigen_veld(text, text, text, text) from public;
grant execute on function dealtrace_index_eigen_veld(text, text, text, text) to dealtrace_app;

-- P05: de reisgeschiedenis is alleen toevoegen voor de app.
revoke update, delete on reisgeschiedenis from dealtrace_app;
grant select, insert on reistemplates, activiteitstemplates to dealtrace_platform;

-- P06: de platformrol laadt de starterset van regels; runs zijn een log.
grant select, insert, delete on activity_rules to dealtrace_platform;
revoke update, delete on rule_runs from dealtrace_app;
grant update (eind_op, geraakt, taken, inzichten, geschoven, fouten, stappen) on rule_runs to dealtrace_app;
-- P07: de startset van ritmes laadt de platformrol.
grant select, insert on hercontactritmes to dealtrace_platform;
-- P08: agent_runs alleen toevoegen; platformmaxima alleen via de platformrol.
revoke update, delete on agent_runs from dealtrace_app;
revoke insert, update, delete on platform_agentmaxima from dealtrace_app;
grant select, insert, update, delete on platform_agentmaxima to dealtrace_platform;
grant select on agent_runs to dealtrace_platform;
-- P09: features per niveau en platformartikelen schrijft alleen de platformrol.
grant select, insert, update, delete on functies_per_niveau to dealtrace_platform;
grant select, insert, update, delete on help_artikelen to dealtrace_platform;
revoke update, delete on help_feedback, help_zoekopdrachten from dealtrace_app;
grant execute on function dealtrace_zoektekst(text) to dealtrace_app, dealtrace_platform;
-- P10: de startset van belscripts laadt de platformrol; versies zijn een log.
grant select, insert on belscripts, belscript_versies to dealtrace_platform;
revoke update, delete on belscript_versies from dealtrace_app;

-- P28: versies van het verkoopverhaal zijn een log.
revoke update, delete on vv_versies from dealtrace_app;
revoke update, delete on salesdna_sublaag_versies from dealtrace_app;
-- P33: prijs per handeling en credits per pakket alleen via de platformrol.
revoke insert, update, delete on credit_instellingen from dealtrace_app;
grant select, insert, update, delete on credit_instellingen to dealtrace_platform;
grant select, insert, update on ai_credits, credit_aanvragen to dealtrace_platform;
