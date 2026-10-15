-- P33: AI-assistent (F26) en AI-credits voor alle AI (11.4). Eén pot per organisatie per maand.
-- Verbruik is de som van de geboekte rijen in agent_runs (kosten); een reservering staat vóór de
-- aanroep in ai_reserveringen en wordt na afloop geboekt of vrijgegeven.
create table ai_credits (
  organisation_id text not null references organisations(id) on delete cascade,
  maand           text not null check (maand ~ '^\d{4}-\d{2}$'),
  toegekend       int not null default 0,
  extra           int not null default 0,
  gemeld80        boolean not null default false,
  gemeld10        boolean not null default false,
  primary key (organisation_id, maand)
);
create table ai_reserveringen (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  gebruiker_id    text,
  soort           text not null,
  credits         int not null check (credits >= 0),
  automatisch     boolean not null default false,
  status          text not null default 'gereserveerd' check (status in ('gereserveerd', 'geboekt', 'vrijgegeven', 'vervallen')),
  op              timestamptz not null default now(),
  afgerond_op     timestamptz
);
create index ai_reserveringen_open on ai_reserveringen (organisation_id, op) where status = 'gereserveerd';
create table ai_credit_plafonds (
  organisation_id text not null references organisations(id) on delete cascade,
  gebruiker_id    text not null references users(id) on delete cascade,
  plafond         int not null check (plafond >= 0),
  primary key (organisation_id, gebruiker_id)
);
create table credit_aanvragen (
  id               text primary key default gen_random_uuid()::text,
  organisation_id  text not null references organisations(id) on delete cascade,
  aantal           int not null check (aantal > 0),
  toelichting      text,
  status           text not null default 'open' check (status in ('open', 'toegekend', 'afgewezen')),
  aangevraagd_door text not null,
  op               timestamptz not null default now(),
  besloten_door    text,
  besloten_op      timestamptz
);
-- Gesprekken met de assistent: alleen van de gebruiker zelf (de server filtert op gebruiker), 30 dagen.
create table ai_chats (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  gebruiker_id    text not null references users(id) on delete cascade,
  context         jsonb not null default '{}'::jsonb,
  titel           text,
  gemaakt_op      timestamptz not null default now(),
  verloopt_op     timestamptz not null default now() + interval '30 days'
);
create index ai_chats_gebruiker on ai_chats (gebruiker_id, gemaakt_op desc);
create table ai_chat_berichten (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  chat_id         text not null references ai_chats(id) on delete cascade,
  rol             text not null check (rol in ('gebruiker', 'assistent')),
  tekst           text not null,
  bronnen         jsonb not null default '[]'::jsonb,
  acties          jsonb not null default '[]'::jsonb,
  credits         int not null default 0,
  op              timestamptz not null default now()
);
create index ai_chat_berichten_chat on ai_chat_berichten (chat_id, op);

do $$
declare t text;
begin
  foreach t in array array['ai_credits', 'ai_reserveringen', 'ai_credit_plafonds', 'credit_aanvragen', 'ai_chats', 'ai_chat_berichten'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy org_isolation on %I using (organisation_id = current_org_id()) with check (organisation_id = current_org_id())', t);
  end loop;
end $$;

-- Platform: prijs per handeling en credits per gebruiker per pakket; alleen de founder schrijft.
-- Sleutels 'prijs:<soort>' en 'pot:<pakket>'; zonder rij geldt de standaard uit shared/credits.ts.
create table credit_instellingen (
  sleutel         text primary key check (sleutel ~ '^(prijs|pot):[a-zA-Z]+$'),
  waarde          int not null check (waarde >= 0),
  gewijzigd_door  text,
  gewijzigd_op    timestamptz not null default now()
);
revoke insert, update, delete on credit_instellingen from dealtrace_app;

-- De founder ziet tellingen per organisatie, nooit berichten (F23).
create or replace function dealtrace_platform_credits()
  returns table (organisation_id text, naam text, pakket text, maand text, toegekend int, extra int, verbruikt int, open_aanvragen int, chats int)
  language sql stable security definer set search_path = public
  as $$
    select o.id, o.name, o.pakket, to_char(now() at time zone 'Europe/Amsterdam', 'YYYY-MM'),
      coalesce(c.toegekend, 0), coalesce(c.extra, 0),
      coalesce((select sum((r.kosten->>'credits')::int) from agent_runs r where r.organisation_id = o.id and r.kosten is not null and r.uitkomst = 'uitgevoerd' and r.op >= date_trunc('month', now() at time zone 'Europe/Amsterdam') at time zone 'Europe/Amsterdam'), 0)::int,
      (select count(*) from credit_aanvragen a where a.organisation_id = o.id and a.status = 'open')::int,
      (select count(*) from ai_chats h where h.organisation_id = o.id)::int
    from organisations o
    left join ai_credits c on c.organisation_id = o.id and c.maand = to_char(now() at time zone 'Europe/Amsterdam', 'YYYY-MM')
  $$;
revoke execute on function dealtrace_platform_credits() from public;
grant execute on function dealtrace_platform_credits() to dealtrace_platform;
