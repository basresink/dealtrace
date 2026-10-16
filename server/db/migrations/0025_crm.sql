-- P20: CRM-koppeling. De OAuth-state hangt aan de sessie en de organisatie (vervangt de state in het
-- geheugen uit DealDrive) en vervalt na 10 minuten. crm_records is de gelezen kopie van het CRM voor
-- ontdubbelen, het klantprofiel en de bron CRM in de leadgenerator; account_id en contact_id koppelen
-- een record aan Dealtrace, zodat schrijven idempotent is.
create table koppeling_states (
  state           text primary key,
  organisation_id text not null references organisations(id) on delete cascade,
  gebruiker_id    text not null,
  soort           text not null,
  verloopt_op     timestamptz not null
);

create table crm_records (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  soort           text not null,
  object          text not null check (object in ('bedrijf', 'contact', 'activiteit')),
  extern_id       text not null,
  bedrijf_extern  text,
  data            jsonb not null default '{}'::jsonb,
  account_id      text references accounts(id) on delete set null,
  contact_id      text references contacts(id) on delete set null,
  -- activiteiten is alleen-toevoegen: wat al in het CRM staat, staat hier.
  activiteit_id   text,
  eigenaar_email  text,
  bijgewerkt_op   timestamptz not null default now(),
  unique (organisation_id, soort, object, extern_id)
);
create index crm_records_account on crm_records (account_id);
create unique index crm_records_activiteit on crm_records (organisation_id, soort, activiteit_id) where activiteit_id is not null;

do $$
declare t text;
begin
  foreach t in array array['koppeling_states', 'crm_records'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy org_isolation on %I using (organisation_id = current_org_id()) with check (organisation_id = current_org_id())', t);
  end loop;
end $$;

-- De webhook van het CRM komt zonder sessie binnen: alleen organisatie en status van één koppeling.
create or replace function dealtrace_crm_koppeling(p_id text)
  returns table (organisation_id text, soort text, status text)
  language sql stable security definer set search_path = public
  as $$ select k.organisation_id, k.soort, k.status from koppelingen k where k.id = p_id and k.soort in ('hubspot', 'salesforce', 'dynamics', 'pipedrive', 'afas') $$;
grant execute on function dealtrace_crm_koppeling(text) to dealtrace_app;
