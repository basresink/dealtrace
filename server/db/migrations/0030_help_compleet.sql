-- P25: helpcenter compleet (F21). Controlevragen goed bij gelezen, zoekopdrachten en vragen zonder antwoord
-- (soort zoek of vraag), versies van artikelen (platform en eigen) en de status concept voor eigen artikelen.
alter table help_gelezen add column if not exists vragen_goed int;
alter table help_zoekopdrachten add column if not exists soort text not null default 'zoek' check (soort in ('zoek', 'vraag'));
alter table help_zoekopdrachten add column if not exists beantwoord boolean not null default false;

create table help_artikel_versies (
  id              text primary key default gen_random_uuid()::text,
  artikel_id      text not null references help_artikelen(id) on delete cascade,
  organisation_id text references organisations(id) on delete cascade,
  versie          int not null,
  titel           text not null,
  data            jsonb not null,
  door            text,
  op              timestamptz not null default now()
);
create index help_artikel_versies_artikel on help_artikel_versies (artikel_id, versie desc);
alter table help_artikel_versies enable row level security;
alter table help_artikel_versies force row level security;
create policy lezen on help_artikel_versies for select using (organisation_id is null or organisation_id = current_org_id());
create policy eigen_schrijven on help_artikel_versies for insert with check (organisation_id = current_org_id());
create policy platform_alles on help_artikel_versies to dealtrace_platform using (true) with check (true);
grant select, insert on help_artikel_versies to dealtrace_platform;
grant select, update on help_artikelen to dealtrace_platform;

-- Statistiek voor de founder over alle organisaties: tellingen per artikel en vragen zonder antwoord (zonder namen).
create or replace function dealtrace_platform_help_statistiek()
  returns table (artikel_id text, gelezen bigint, nuttig bigint, niet_nuttig bigint)
  language sql stable security definer set search_path = public
  as $$ select a.id, (select count(*) from help_gelezen g where g.artikel_id = a.id), (select count(*) from help_feedback f where f.artikel_id = a.id and f.nuttig),
          (select count(*) from help_feedback f where f.artikel_id = a.id and not f.nuttig) from help_artikelen a where a.organisation_id is null $$;
create or replace function dealtrace_platform_help_vragen()
  returns table (organisation_id text, naam text, term text, soort text, op timestamptz)
  language sql stable security definer set search_path = public
  as $$ select z.organisation_id, o.name, z.term, z.soort, z.op from help_zoekopdrachten z join organisations o on o.id = z.organisation_id
        where (z.soort = 'vraag' and not z.beantwoord) or (z.soort = 'zoek' and z.resultaten = 0) order by z.op desc limit 200 $$;
revoke execute on function dealtrace_platform_help_statistiek(), dealtrace_platform_help_vragen() from public;
grant execute on function dealtrace_platform_help_statistiek(), dealtrace_platform_help_vragen() to dealtrace_platform;
