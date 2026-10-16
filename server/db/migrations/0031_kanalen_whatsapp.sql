-- P26: kanalen, push, WhatsApp en consent (F24, F16 punt 6, F22, hoofdstuk 12).

-- Meldingen: per kanaal vastleggen wat er verstuurd is; de verzender pakt alleen rijen zonder.
alter table notificaties add column if not exists kanalen_verstuurd jsonb;
create index if not exists notificaties_te_versturen on notificaties (organisation_id, op) where kanalen_verstuurd is null;
-- Bestaande meldingen gelden als verstuurd: geen push of mail met terugwerkende kracht.
update notificaties set kanalen_verstuurd = '{"inApp": true}'::jsonb where kanalen_verstuurd is null;

-- Bel-me-niet: met reden, en wie het weghaalde blijft niet bewaard (de rij gaat weg).
alter table bel_me_niet add column if not exists reden text;

-- WhatsApp Business: koppeling (soort whatsapp) en sjablonen. Alleen een goedgekeurd sjabloon is kiesbaar.
alter table koppelingen drop constraint if exists koppelingen_soort_check;
alter table koppelingen add constraint koppelingen_soort_check check (soort in ('kvk', 'datacollectief', 'hubspot', 'salesforce', 'dynamics', 'pipedrive', 'afas', 'salesdna', 'dealdrive', 'mail', 'whatsapp'));

create table whatsapp_sjablonen (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  naam            text not null,
  taal            text not null default 'nl',
  tekst           text not null,
  status          text not null default 'concept' check (status in ('concept', 'ingediend', 'goedgekeurd', 'afgewezen')),
  extern_id       text,
  reden           text,
  door            text,
  updated_at      timestamptz not null default now(),
  unique (organisation_id, naam, taal)
);

-- Berichten via de provider: status per bericht (verzonden, afgeleverd, gelezen, mislukt).
create table whatsapp_berichten (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  concept_id      text,
  account_id      text references accounts(id) on delete cascade,
  contact_id      text,
  sjabloon_id     text references whatsapp_sjablonen(id),
  extern_id       text,
  status          text not null default 'verzonden' check (status in ('verzonden', 'afgeleverd', 'gelezen', 'mislukt')),
  door            text,
  op              timestamptz not null default now()
);
create index whatsapp_berichten_extern on whatsapp_berichten (extern_id);

do $$
declare t text;
begin
  foreach t in array array['whatsapp_sjablonen', 'whatsapp_berichten'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy org_isolation on %I using (organisation_id = current_org_id()) with check (organisation_id = current_org_id())', t);
  end loop;
end $$;
