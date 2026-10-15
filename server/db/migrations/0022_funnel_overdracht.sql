-- P17: de overdracht na een gehouden eerste afspraak (F17, ADR-021) en de afgeleide funnelstand.
-- Een overdracht staat los van het versturen: status klaar ontstaat in dezelfde transactie als de
-- gebeurtenis overgedragen; de job zet hem daarna op verstuurd, bevestigd of mislukt.
create table overdrachten (
  id                  text primary key default gen_random_uuid()::text,
  organisation_id     text not null references organisations(id) on delete cascade,
  account_id          text not null references accounts(id) on delete cascade,
  afspraak_id         text,
  naar                text not null check (naar in ('dealdrive', 'crm', 'collega')),
  naar_gebruiker_id   text references users(id),
  ontvanger           text,
  extern_id           text,
  extern_url          text,
  status              text not null default 'klaar' check (status in ('klaar', 'verstuurd', 'bevestigd', 'mislukt')),
  pakket              jsonb not null default '{}'::jsonb,
  pogingen            int not null default 0,
  laatste_fout        text,
  volgende_poging_op  timestamptz,
  sleutel             text not null,
  op                  timestamptz not null default now(),
  door                text not null,
  data                jsonb not null default '{}'::jsonb,
  unique (organisation_id, sleutel)
);
create index overdrachten_account on overdrachten (account_id);
create index overdrachten_wachtrij on overdrachten (status, volgende_poging_op);

create table nb_funnel_stand (
  organisation_id     text not null references organisations(id) on delete cascade,
  dag                 date not null,
  gebruiker_id        text not null default '',
  reis_id             text not null default '',
  fase_id             text not null,
  binnengekomen       int not null default 0,
  doorgestroomd       int not null default 0,
  uitgevallen         jsonb not null default '{}'::jsonb,
  aanwezig            int not null default 0,
  doorlooptijd_som    numeric not null default 0,
  doorlooptijd_aantal int not null default 0,
  primary key (organisation_id, dag, gebruiker_id, reis_id, fase_id)
);
-- De DealDrive-koppeling per organisatie: status actief met instellingen.stand mock of http; zonder rij of status uit: uit.
alter table koppelingen drop constraint if exists koppelingen_soort_check;
alter table koppelingen add constraint koppelingen_soort_check check (soort in ('kvk', 'datacollectief', 'hubspot', 'salesforce', 'dynamics', 'pipedrive', 'afas', 'salesdna', 'dealdrive'));
create index reisgeschiedenis_op on reisgeschiedenis (organisation_id, op);

do $$
declare t text;
begin
  foreach t in array array['overdrachten', 'nb_funnel_stand'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy org_isolation on %I using (organisation_id = current_org_id()) with check (organisation_id = current_org_id())', t);
  end loop;
end $$;
