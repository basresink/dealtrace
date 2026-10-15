-- P03: accounts, contacten, eigen velden (F03, F04, F19, 10.2).
-- Een account is een bedrijf; prospect of klant is een eigenschap (account_kind).
-- Dealtrace maakt zelf geen klant van een prospect (B17): er is geen schrijfpad.

create table accounts (
  id                     text primary key default gen_random_uuid()::text,
  organisation_id        text not null references organisations(id) on delete cascade,
  name                   text not null,
  account_kind           text not null default 'prospect' check (account_kind in ('prospect', 'klant')),
  klasse                 text,
  owner_id               text references users(id) on delete set null,
  nb_status              text not null default 'nieuw'
                         check (nb_status in ('nieuw', 'in reis', 'wachtend', 'nee', 'gescoord', 'klant', 'overgedragen')),
  reis_id                text,
  fase_id                text,
  fase_sinds             timestamptz,
  doelgroep_id           text,
  gebied_id              text,
  score                  int not null default 0 check (score between 0 and 100),
  laatste_contact_op     timestamptz,
  city                   text,
  postcode               text,
  kvk                    text,
  domein                 text,
  lat                    double precision,
  lng                    double precision,
  nb_bron                text,
  vv_branche_id          text,
  huidige_leverancier_id text,
  terug_op               date,
  terug_regel_id         text,
  data                   jsonb not null default '{}'::jsonb,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index accounts_org_idx on accounts (organisation_id, account_kind);
create index accounts_owner_idx on accounts (organisation_id, owner_id);
create index accounts_kvk_idx on accounts (organisation_id, kvk) where kvk is not null;
create index accounts_domein_idx on accounts (organisation_id, domein) where domein is not null;
create index accounts_naam_idx on accounts (organisation_id, lower(name));

-- Een contact zonder account kan niet bestaan (account_id not null, cascade bij verwijderen).
create table contacts (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  account_id      text not null references accounts(id) on delete cascade,
  first_name      text,
  last_name       text not null,
  email           text,
  rol             text not null default 'onbekend'
                  check (rol in ('beslisser', 'beinvloeder', 'champion', 'gebruiker', 'blokkeerder', 'poortwachter', 'onbekend')),
  status          text not null default 'actief' check (status in ('actief', 'vertrokken')),
  data            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index contacts_account_idx on contacts (account_id);
create index contacts_org_idx on contacts (organisation_id);
create index contacts_email_idx on contacts (organisation_id, lower(email)) where email is not null;

create table eigen_velden (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  object          text not null check (object in ('account', 'contact', 'campagne', 'afspraak')),
  sleutel         text not null check (sleutel ~ '^[a-z][a-z0-9_]{0,62}$'),
  naam            text not null,
  type            text not null check (type in ('tekst', 'langeTekst', 'getal', 'bedrag', 'datum', 'janee', 'keuzelijst',
                                                 'meerkeuze', 'telefoon', 'email', 'link', 'gebruiker')),
  sectie          text not null default 'Stamgegevens',
  volgorde        int not null default 0,
  data            jsonb not null default '{}'::jsonb,
  gearchiveerd    boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organisation_id, object, sleutel)
);

create table bel_me_niet (
  organisation_id text not null references organisations(id) on delete cascade,
  telefoon_e164   text not null,
  door            text,
  op              timestamptz not null default now(),
  primary key (organisation_id, telefoon_e164)
);

create table opgeslagen_filters (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  gebruiker_id    text not null references users(id) on delete cascade,
  lijst           text not null default 'prospects',
  naam            text not null,
  query           jsonb not null,
  created_at      timestamptz not null default now()
);

create table eigen_veld_voorstellen (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  door            text not null,
  data            jsonb not null,
  status          text not null default 'open' check (status in ('open', 'overgenomen', 'afgewezen')),
  op              timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['accounts', 'contacts', 'eigen_velden', 'bel_me_niet', 'opgeslagen_filters', 'eigen_veld_voorstellen'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy org_isolation on %I using (organisation_id = current_org_id()) with check (organisation_id = current_org_id())', t);
  end loop;
end $$;

-- Een contact hoort bij een account van dezelfde organisatie.
create or replace function dealtrace_contact_zelfde_org() returns trigger
  language plpgsql as $$
begin
  if not exists (select 1 from accounts a where a.id = new.account_id and a.organisation_id = new.organisation_id) then
    raise exception 'Account hoort niet bij deze organisatie' using errcode = '23503';
  end if;
  return new;
end $$;
create trigger contacts_zelfde_org before insert or update of account_id, organisation_id on contacts
  for each row execute function dealtrace_contact_zelfde_org();

-- Expressie-index voor een filterbaar eigen veld (F19). Wordt aangeroepen bij
-- "Filterbaar aan"; idempotent. Getal en datum krijgen een getypeerde index.
create or replace function dealtrace_index_eigen_veld(p_org text, p_object text, p_sleutel text, p_type text)
  returns text
  language plpgsql security definer set search_path = public
  as $$
declare
  tabel text := case p_object when 'account' then 'accounts' when 'contact' then 'contacts' else null end;
  naam  text := left('cf_' || md5(p_org || p_object || p_sleutel), 40);
  expr  text;
begin
  if tabel is null then return null; end if;
  if p_sleutel !~ '^[a-z][a-z0-9_]{0,62}$' then raise exception 'Ongeldige sleutel'; end if;
  expr := case p_type
    when 'getal' then format('(dealtrace_als_getal(data->''customFields''->>%L))', p_sleutel)
    when 'bedrag' then format('(dealtrace_als_getal(data->''customFields''->>%L))', p_sleutel)
    else format('((data->''customFields''->>%L))', p_sleutel)
  end;
  execute format('create index if not exists %I on %I (organisation_id, %s) where organisation_id = %L', naam, tabel, expr, p_org);
  return naam;
end $$;

create or replace function dealtrace_als_getal(t text) returns numeric
  language plpgsql immutable as $$
begin
  return t::numeric;
exception when others then
  return null;
end $$;
