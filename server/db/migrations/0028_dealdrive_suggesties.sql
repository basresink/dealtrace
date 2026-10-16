-- P23: de DealDrive-koppeling (terugmeldingen, ontdubbelcache) en de wekelijkse suggesties naar SalesDNA.
-- Contract: docs/api/dealdrive-koppeling.md hoofdstuk 7. Logs bewaren geen body, alleen ids en een hash;
-- de gegevens van een terugmelding blijven alleen staan tot de job hem verwerkt.

create table dealdrive_gebeurtenissen (
  id               text primary key default gen_random_uuid()::text,
  organisation_id  text not null references organisations(id) on delete cascade,
  gebeurtenis_id   text not null,
  soort            text not null,
  account_id       text,
  hash             text,
  gegevens         jsonb,
  ontvangen_op     timestamptz not null default now(),
  verwerkt_op      timestamptz,
  resultaat        text not null default 'wacht' check (resultaat in ('wacht', 'verwerkt', 'fout')),
  fout             text,
  unique (organisation_id, gebeurtenis_id)
);
create index dealdrive_gebeurtenissen_wacht on dealdrive_gebeurtenissen (organisation_id, resultaat);

create table dealdrive_zoekcache (
  organisation_id  text not null references organisations(id) on delete cascade,
  sleutel          text not null,
  antwoord         jsonb not null,
  verloopt_op      timestamptz not null,
  primary key (organisation_id, sleutel)
);

create table salesdna_suggesties (
  id                text primary key default gen_random_uuid()::text,
  organisation_id   text not null references organisations(id) on delete cascade,
  week              text not null,
  onderwerp_id      text not null,
  veld              text not null,
  regel_extern_id   text,
  soort             text not null,
  tekst             text not null,
  bewijs            jsonb not null default '{}'::jsonb,
  kracht            numeric not null default 0,
  status            text not null default 'concept' check (status in ('concept', 'vrijgegeven', 'verstuurd', 'overgenomen', 'afgewezen_salesdna', 'afgewezen', 'mislukt')),
  bron              text not null default 'dealtrace' check (bron in ('dealtrace', 'expert', 'gewonnen')),
  team_id           text,
  door              text,
  sleutel           text not null,
  vrijgegeven_door  text,
  vrijgegeven_op    timestamptz,
  verstuurd_op      timestamptz,
  extern_status_op  timestamptz,
  fout              text,
  op                timestamptz not null default now(),
  unique (organisation_id, sleutel)
);
create index salesdna_suggesties_week on salesdna_suggesties (organisation_id, week, status);

do $$
declare t text;
begin
  foreach t in array array['dealdrive_gebeurtenissen', 'dealdrive_zoekcache', 'salesdna_suggesties'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy org_isolation on %I using (organisation_id = current_org_id()) with check (organisation_id = current_org_id())', t);
  end loop;
end $$;

-- De webhook van DealDrive heeft geen sessie: de organisatie komt uit X-Koppeling-Organisatie en wordt
-- pas vertrouwd als de handtekening met het geheim van juist die koppeling klopt (nooit uit de body).
create or replace function dealtrace_dealdrive_koppeling(p_org text)
  returns table (organisation_id text, status text, geheimen text, stand text)
  language sql stable security definer set search_path = public
  as $$ select k.organisation_id, k.status, k.geheimen, k.instellingen->>'stand' from koppelingen k where k.organisation_id = p_org and k.soort = 'dealdrive' $$;
revoke execute on function dealtrace_dealdrive_koppeling(text) from public;
grant execute on function dealtrace_dealdrive_koppeling(text) to dealtrace_app;

-- De founder richt de DealDrive-koppeling in vanuit Platformbeheer. De platformrol leest geen klantdata en
-- geen andere koppelingen; deze drie functies geven en zetten alleen de DealDrive-rij van één organisatie.
create or replace function dealtrace_platform_dealdrive(p_org text)
  returns table (status text, geheimen text, instellingen jsonb, getest_op timestamptz)
  language sql stable security definer set search_path = public
  as $$ select k.status, k.geheimen, k.instellingen, k.getest_op from koppelingen k where k.organisation_id = p_org and k.soort = 'dealdrive' $$;
create or replace function dealtrace_platform_dealdrive_zet(p_org text, p_status text, p_geheimen text, p_instellingen jsonb)
  returns void language sql volatile security definer set search_path = public
  as $$ insert into koppelingen (organisation_id, soort, status, geheimen, instellingen) values (p_org, 'dealdrive', p_status, p_geheimen, p_instellingen)
    on conflict (organisation_id, soort) do update set status = excluded.status, geheimen = excluded.geheimen, instellingen = excluded.instellingen, updated_at = now() $$;
create or replace function dealtrace_platform_dealdrive_runs(p_org text)
  returns table (handeling text, start timestamptz, fouten jsonb)
  language sql stable security definer set search_path = public
  as $$ select r.handeling, r.start, r.fouten from koppeling_runs r where r.organisation_id = p_org and r.soort = 'dealdrive' order by r.start desc limit 5 $$;
revoke execute on function dealtrace_platform_dealdrive(text), dealtrace_platform_dealdrive_zet(text, text, text, jsonb), dealtrace_platform_dealdrive_runs(text) from public;
grant execute on function dealtrace_platform_dealdrive(text), dealtrace_platform_dealdrive_zet(text, text, text, jsonb), dealtrace_platform_dealdrive_runs(text) to dealtrace_platform;
