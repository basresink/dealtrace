-- 1. Gespreksverslag na het afronden van een beltaak (bij de vastgelegde belactiviteit).
-- De activiteitenlog is alleen-toevoegen (rollen.sql: geen update of delete voor dealtrace_app). Een verslag
-- dat na het afronden bij de beltaak wordt bewaard of gewijzigd, komt daarom als nieuwe regel in deze
-- aanvullende tabel, met een verwijzing naar de belactiviteit. Ook deze tabel is alleen-toevoegen: de
-- nieuwste regel per activiteit is het geldende verslag, eerdere regels blijven als geschiedenis staan (een
-- lege tekst betekent dat het verslag is gewist). Bewust geen nieuwe soort in activiteiten: dan zouden
-- tellingen (pogingen, contactmomenten, laatste contact, laatste uitkomst) een verslag als contact zien.
create table activiteit_verslagen (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  activiteit_id   text not null references activiteiten(id) on delete cascade,
  task_id         text references tasks(id) on delete set null,
  tekst           text not null default '' check (length(tekst) <= 50000),
  bron            text not null default 'getypt' check (bron in ('getypt', 'ingesproken')),
  door            text references users(id) on delete set null,
  op              timestamptz not null default clock_timestamp()
);
create index activiteit_verslagen_activiteit_idx on activiteit_verslagen (activiteit_id, op desc);

alter table activiteit_verslagen enable row level security;
alter table activiteit_verslagen force row level security;
create policy org_isolation on activiteit_verslagen using (organisation_id = current_org_id()) with check (organisation_id = current_org_id());

-- 2. Kennisbank: PDF en de oude Office-formaten (doc, xls, ppt) worden nu ook uitgelezen. Documenten die
-- eerder als niet-gelezen zijn opgeslagen, worden bij het eerstvolgende openen opnieuw gelezen.
update documenten set tekst_status = 'onbekend'
where tekst_status = 'niet-gelezen'
  and mime in ('application/pdf', 'application/msword', 'application/vnd.ms-excel', 'application/vnd.ms-powerpoint');
