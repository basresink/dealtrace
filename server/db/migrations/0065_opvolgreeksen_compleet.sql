-- Opvolgreeksen compleet (F7): sjablonenbeheer per organisatie en reacties herkennen in de mailbox.
-- reekssjablonen krijgt de uitkomsten waarbij Rond af en de belmodus het sjabloon voorstellen (informatie, voicemail,
-- later), de stopregels per sjabloon (reactie, afspraak en nee; een afmelding stopt altijd) en wie het laatst wijzigde.
-- De stappen (jsonb) kennen nu ook een onderwerp en een instructie voor de Schrijver; dat vraagt geen kolom.
-- inkomende_mails: elke mail die via de webhook of de mock-adapter binnenkomt, één keer per bericht-id, met wat
-- ermee gebeurde (reeks gestopt, automatisch antwoord, geen lopende reeks, onbekende afzender). Alleen een fragment
-- van de tekst wordt bewaard. RLS (FORCE) op organisation_id, zoals de andere tabellen van de reeksen.

alter table reekssjablonen add column if not exists uitkomsten text[] not null default '{}';
alter table reekssjablonen add column if not exists stopregels jsonb not null default '{"reactie": true, "afspraak": true, "nee": true}'::jsonb;
alter table reekssjablonen add column if not exists gewijzigd_door text references users(id) on delete set null;

-- De startsjablonen krijgen hun uitkomst (alleen als er nog niets is gekozen).
update reekssjablonen set uitkomsten = array['informatie'] where sleutel = 'na-informatie' and uitkomsten = '{}';
update reekssjablonen set uitkomsten = array['voicemail'] where sleutel = 'na-voicemail' and uitkomsten = '{}';
update reekssjablonen set uitkomsten = array['later'] where sleutel = 'na-eerste-gesprek' and uitkomsten = '{}';

create index if not exists reeksen_eigenaar on reeksen (organisation_id, owner_id, status);

create table if not exists inkomende_mails (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  bericht_id      text not null,
  van             text not null,
  onderwerp       text,
  fragment        text,
  ontvangen_op    timestamptz not null default now(),
  bron            text not null default 'webhook' check (bron in ('webhook', 'mock', 'poll')),
  account_id      text references accounts(id) on delete set null,
  contact_id      text references contacts(id) on delete set null,
  reeks_id        text references reeksen(id) on delete set null,
  verwerking      text not null check (verwerking in ('gestopt', 'auto-antwoord', 'geen-reeks', 'onbekend')),
  created_at      timestamptz not null default now(),
  unique (organisation_id, bericht_id)
);
create index if not exists inkomende_mails_account on inkomende_mails (organisation_id, account_id, ontvangen_op desc);

alter table inkomende_mails enable row level security;
alter table inkomende_mails force row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'inkomende_mails' and policyname = 'org_isolation') then
    create policy org_isolation on inkomende_mails using (organisation_id = current_org_id()) with check (organisation_id = current_org_id());
  end if;
  if exists (select 1 from pg_roles where rolname = 'dealtrace_app') then
    grant select, insert, update, delete on inkomende_mails to dealtrace_app;
  end if;
end $$;
