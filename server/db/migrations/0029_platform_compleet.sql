-- P24: Platformbeheer compleet (F23). Prijzen per pakket en per handeling met geldig-vanaf, facturen uit
-- Stripe (idempotent op event-id), extra credits met reden, roadmap met stemmen, agent-prompts met versies,
-- de AI-koppeling (sleutel versleuteld) en modelprijzen. De platformrol leest over organisaties heen alleen
-- via security-definer-functies die tellingen en platformgegevens geven, nooit klantrecords.

-- Prijs per pakket en per seat, als gegeven met geldig-vanaf (open vraag 10).
create table pakketprijzen (
  id            text primary key default gen_random_uuid()::text,
  pakket        text not null check (pakket in ('starter', 'plus', 'compleet')),
  prijs_cent    int not null check (prijs_cent >= 0),
  seat_cent     int not null check (seat_cent >= 0),
  geldig_vanaf  date not null,
  door          text not null,
  op            timestamptz not null default now()
);

-- Prijs per handeling (11.4) met geldig-vanaf; creditsVoor rekent met de laatste die geldt.
create table credit_prijzen (
  id            text primary key default gen_random_uuid()::text,
  soort         text not null,
  credits       int not null check (credits >= 0),
  geldig_vanaf  date not null,
  door          text not null,
  op            timestamptz not null default now()
);

-- Extra credits met reden; factureren wordt een regel op de volgende factuur. Idempotent per sleutel.
create table extra_credits_log (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  maand           text not null,
  aantal          int not null check (aantal > 0),
  reden           text not null,
  factureren      boolean not null default false,
  gefactureerd    boolean not null default false,
  sleutel         text not null,
  door            text not null,
  op              timestamptz not null default now(),
  unique (organisation_id, sleutel)
);

-- Facturen uit Stripe Billing; Moneybird-id na de synchronisatie.
alter table organisations add column if not exists stripe_customer_id text unique;
create table facturen (
  id                text primary key default gen_random_uuid()::text,
  organisation_id   text not null references organisations(id) on delete cascade,
  stripe_invoice_id text not null unique,
  nummer            text not null,
  bedrag_cent       int not null,
  btw_cent          int not null default 0,
  status            text not null check (status in ('open', 'betaald', 'achterstallig', 'geannuleerd')),
  vervalt_op        date,
  betaald_op        timestamptz,
  pdf_url           text,
  moneybird_id      text,
  regels            jsonb not null default '[]'::jsonb,
  op                timestamptz not null default now()
);
create table stripe_events (
  event_id      text primary key,
  soort         text not null,
  ontvangen_op  timestamptz not null default now()
);

-- Roadmap: wensen per organisatie, stemmen binnen de eigen organisatie.
create table feature_requests (
  id                text primary key default gen_random_uuid()::text,
  organisation_id   text not null references organisations(id) on delete cascade,
  titel             text not null,
  omschrijving      text not null default '',
  status            text not null default 'ingediend' check (status in ('ingediend', 'gestart', 'in_ontwikkeling', 'niet_gedaan', 'opgeleverd')),
  prioriteit        text check (prioriteit in ('hoog', 'middel', 'laag')),
  samengevoegd_met  text references feature_requests(id) on delete set null,
  github_issue_url  text,
  door              text not null,
  op                timestamptz not null default now()
);
create table roadmap_stemmen (
  organisation_id   text not null references organisations(id) on delete cascade,
  wens_id           text not null references feature_requests(id) on delete cascade,
  gebruiker_id      text not null,
  op                timestamptz not null default now(),
  primary key (wens_id, gebruiker_id)
);

-- Agent-prompts per slot: laag platform (organisation_id leeg) of organisatie; hooguit 10 versies per laag.
create table prompt_versies (
  id              text primary key default gen_random_uuid()::text,
  slot            text not null,
  laag            text not null check (laag in ('platform', 'organisatie')),
  organisation_id text references organisations(id) on delete cascade,
  versie          int not null,
  tekst           text not null,
  auteur_id       text not null,
  op              timestamptz not null default now(),
  check ((laag = 'platform') = (organisation_id is null)),
  unique (slot, laag, organisation_id, versie)
);

-- De AI-koppeling: platform (organisation_id leeg) of per klant. De sleutel is versleuteld (LLM_KEY_SECRET).
create table llm_connections (
  id                  text primary key default gen_random_uuid()::text,
  organisation_id     text references organisations(id) on delete cascade,
  provider            text not null default 'claude' check (provider in ('claude', 'mock')),
  sleutel             text,
  modellen            jsonb not null default '{}'::jsonb,
  regio               text not null default 'EU',
  geen_training       boolean not null default true,
  getest_op           timestamptz,
  door                text not null,
  op                  timestamptz not null default now()
);
create unique index llm_connections_org on llm_connections (coalesce(organisation_id, ''));
create table llm_prijzen (
  model             text not null,
  invoer_cent_mtok  int not null,
  uitvoer_cent_mtok int not null,
  peildatum         date not null,
  primary key (model, peildatum)
);
insert into llm_prijzen (model, invoer_cent_mtok, uitvoer_cent_mtok, peildatum) values
  ('claude-sonnet-5-5', 300, 1500, '2026-10-01'), ('claude-haiku-5-5', 100, 500, '2026-10-01'), ('claude-opus-5-5', 1500, 7500, '2026-10-01');

do $$
declare t text;
begin
  foreach t in array array['extra_credits_log', 'facturen', 'feature_requests', 'roadmap_stemmen'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy org_isolation on %I using (organisation_id = current_org_id()) with check (organisation_id = current_org_id())', t);
  end loop;
end $$;
-- Prompts en AI-koppeling: de app leest de platformlaag en de eigen laag, schrijft alleen de eigen laag.
alter table prompt_versies enable row level security;
alter table prompt_versies force row level security;
create policy lezen on prompt_versies for select using (organisation_id is null or organisation_id = current_org_id());
create policy eigen on prompt_versies for insert with check (organisation_id = current_org_id());
create policy eigen_weg on prompt_versies for delete using (organisation_id = current_org_id());
create policy platform_laag on prompt_versies to dealtrace_platform using (organisation_id is null) with check (organisation_id is null);
alter table llm_connections enable row level security;
alter table llm_connections force row level security;
create policy platform_laag on llm_connections to dealtrace_platform using (true) with check (true);

grant select, insert, delete on prompt_versies to dealtrace_platform;
grant select, insert, update on llm_connections to dealtrace_platform;
grant select on llm_prijzen to dealtrace_platform;
grant select, insert on pakketprijzen, credit_prijzen to dealtrace_platform;

-- De app leest de AI-koppeling alleen via deze functie: eerst de eigen, dan die van het platform.
create or replace function dealtrace_llm_koppeling(p_org text)
  returns table (organisation_id text, provider text, sleutel text, modellen jsonb, regio text)
  language sql stable security definer set search_path = public
  as $$ select l.organisation_id, l.provider, l.sleutel, l.modellen, l.regio from llm_connections l
        where l.organisation_id = p_org or l.organisation_id is null order by l.organisation_id nulls last limit 1 $$;
revoke execute on function dealtrace_llm_koppeling(text) from public;
grant execute on function dealtrace_llm_koppeling(text) to dealtrace_app;

-- Stripe-webhook (geen sessie): de organisatie bij een klant-id, en AI pauzeren of hervatten.
create or replace function dealtrace_org_voor_stripe(p_klant text)
  returns text language sql stable security definer set search_path = public
  as $$ select id from organisations where stripe_customer_id = p_klant $$;
revoke execute on function dealtrace_org_voor_stripe(text) from public;
grant execute on function dealtrace_org_voor_stripe(text) to dealtrace_app;

-- Platformoverzichten: facturen met marge-gegevens, de roadmap over alle klanten, de motor en het verbruik.
create or replace function dealtrace_platform_facturen()
  returns table (id text, organisation_id text, naam text, nummer text, bedrag_cent int, btw_cent int, status text, vervalt_op date, betaald_op timestamptz, moneybird_id text, op timestamptz)
  language sql stable security definer set search_path = public
  as $$ select f.id, f.organisation_id, o.name, f.nummer, f.bedrag_cent, f.btw_cent, f.status, f.vervalt_op, f.betaald_op, f.moneybird_id, f.op from facturen f join organisations o on o.id = f.organisation_id order by f.op desc limit 500 $$;
create or replace function dealtrace_platform_extra_open()
  returns table (organisation_id text, naam text, aantal bigint, regels bigint)
  language sql stable security definer set search_path = public
  as $$ select e.organisation_id, o.name, sum(e.aantal), count(*) from extra_credits_log e join organisations o on o.id = e.organisation_id where e.factureren and not e.gefactureerd group by 1, 2 $$;
create or replace function dealtrace_platform_roadmap()
  returns table (id text, organisation_id text, naam text, titel text, omschrijving text, status text, prioriteit text, samengevoegd_met text, github_issue_url text, stemmen bigint, op timestamptz)
  language sql stable security definer set search_path = public
  as $$ select w.id, w.organisation_id, o.name, w.titel, w.omschrijving, w.status, w.prioriteit, w.samengevoegd_met, w.github_issue_url,
          (select count(*) from roadmap_stemmen s where s.wens_id = w.id), w.op
        from feature_requests w join organisations o on o.id = w.organisation_id order by w.op desc limit 500 $$;
-- Status "gestart" kan maar één keer: de update slaagt alleen vanuit ingediend (regel 50).
create or replace function dealtrace_platform_roadmap_zet(p_id text, p_status text, p_prioriteit text, p_issue text)
  returns text language sql volatile security definer set search_path = public
  as $$ update feature_requests set status = coalesce(p_status, status), prioriteit = coalesce(p_prioriteit, prioriteit), github_issue_url = coalesce(p_issue, github_issue_url)
        where id = p_id and (p_status is distinct from 'gestart' or status = 'ingediend') returning status $$;
create or replace function dealtrace_platform_motor()
  returns table (organisation_id text, naam text, laatste timestamptz, soort text, taken int, inzichten int, fouten jsonb, stappen jsonb, runs_7d bigint, fouten_7d bigint)
  language sql stable security definer set search_path = public
  as $$ select o.id, o.name, r.gestart_op, r.soort, r.taken, r.inzichten, r.fouten, r.stappen,
          (select count(*) from rule_runs x where x.organisation_id = o.id and x.gestart_op > now() - interval '7 days'),
          (select count(*) from rule_runs x where x.organisation_id = o.id and x.gestart_op > now() - interval '7 days' and jsonb_array_length(x.fouten) > 0)
        from organisations o left join lateral (select * from rule_runs r where r.organisation_id = o.id and r.rule_id is null order by r.gestart_op desc limit 1) r on true
        where o.status <> 'systeem' order by o.name $$;
create or replace function dealtrace_platform_verbruik(p_maand text)
  returns table (organisation_id text, naam text, soort text, gebruiker_id text, credits bigint, aanroepen bigint)
  language sql stable security definer set search_path = public
  as $$ select a.organisation_id, o.name, a.kosten->>'soort', a.gebruiker_id, sum(coalesce((a.kosten->>'credits')::int, 0)), count(*)
        from agent_runs a join organisations o on o.id = a.organisation_id
        where a.kosten ? 'credits' and to_char(a.op at time zone 'Europe/Amsterdam', 'YYYY-MM') = p_maand group by 1, 2, 3, 4 $$;
do $$
declare f text;
begin
  foreach f in array array['dealtrace_platform_facturen()', 'dealtrace_platform_extra_open()', 'dealtrace_platform_roadmap()', 'dealtrace_platform_roadmap_zet(text, text, text, text)', 'dealtrace_platform_motor()', 'dealtrace_platform_verbruik(text)'] loop
    execute format('revoke execute on function %s from public', f);
    execute format('grant execute on function %s to dealtrace_platform', f);
  end loop;
end $$;

-- Proefdraai van agent-prompts telt in de credits van de systeemorganisatie: een vaste pot, zonder klantdata.
insert into org_settings (organisation_id, key, value) values ('org-dealtrace', 'aiCredits', '{"vastePot": 20000}'::jsonb)
  on conflict (organisation_id, key) do nothing;
