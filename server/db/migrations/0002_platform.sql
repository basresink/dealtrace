-- P02: Platformbeheer basis en werken in een organisatie (F23, 15.3, ADR-011).
--
-- Drie lagen: de client verbergt, de server weigert, de database zegt nee.
-- De database-laag hier:
--   * dealtrace_platform: eigen rol voor platformwerk (zonder bypassrls). Mag
--     organisaties, gebruikers en platformtabellen lezen en schrijven, maar geen
--     klantdata (activiteiten, meldingen lezen, later accounts en contacten).
--     Over klantdata krijgt hij alleen getallen, via security-definer-functies.
--   * dealtrace_app is lid van dealtrace_platform zonder te erven: de app moet
--     expliciet "set local role dealtrace_platform" doen (alleen in requireFounder).
--   * Een trigger weigert de rol founder, behalve voor de migratierol.
--   * platform_audit is alleen toevoegen, voor iedere rol.

-- ---------------------------------------------------------------------------
-- Rol
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'dealtrace_platform') then
    create role dealtrace_platform nologin nosuperuser nocreatedb nocreaterole nobypassrls;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Systeemorganisatie "Dealtrace" voor de founders (zonder klantdata).
-- ---------------------------------------------------------------------------
insert into organisations (id, name, pakket, status, data)
values ('org-dealtrace', 'Dealtrace', 'compleet', 'systeem', '{}')
on conflict (id) do nothing;

do $$
declare c text;
begin
  for c in select conname from pg_constraint
           where conrelid = 'users'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%organisation_id is not null%'
  loop
    execute format('alter table users drop constraint %I', c);
  end loop;
end $$;
update users set organisation_id = 'org-dealtrace' where role = 'founder' and organisation_id is null;
alter table users alter column organisation_id set not null;

-- Bestaande klanten: een startcontract, zodat seats en stand bestaan.
update organisations
   set contract = jsonb_build_object('status', 'actief', 'seats', 10, 'looptijdMaanden', 12, 'opzegtermijnMaanden', 1,
                                     'start', to_char(created_at, 'YYYY-MM-DD'))
 where status <> 'systeem' and contract = '{}'::jsonb;
update organisations
   set data = data || jsonb_build_object('gebruikersStand', coalesce(data->>'gebruikersStand', 'zelf'),
                                         'toegangLeverancier', coalesce(data->>'toegangLeverancier', 'altijd'))
 where status <> 'systeem';

-- ---------------------------------------------------------------------------
-- De rol founder alleen via de migratierol (eigenaar van de tabel).
-- ---------------------------------------------------------------------------
create or replace function dealtrace_weiger_founder() returns trigger
  language plpgsql as $$
declare eigenaar text;
begin
  if new.role = 'founder' and (tg_op = 'INSERT' or old.role is distinct from 'founder') then
    select pg_get_userbyid(relowner) into eigenaar from pg_class where oid = 'users'::regclass;
    if current_user <> eigenaar then
      raise exception 'De rol founder kan alleen via een migratie worden toegekend' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists users_geen_founder on users;
create trigger users_geen_founder before insert or update of role on users
  for each row execute function dealtrace_weiger_founder();

-- ---------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------
create table gebruikersaanvragen (
  id               text primary key default gen_random_uuid()::text,
  organisation_id  text not null references organisations(id) on delete cascade,
  aangevraagd_door text not null,
  data             jsonb not null,   -- {naam, email, rol, niveau, werkplek, teamId}
  status           text not null default 'open' check (status in ('open', 'goedgekeurd', 'afgewezen')),
  afgehandeld_door text,
  afgehandeld_op   timestamptz,
  aangevraagd_op   timestamptz not null default now()
);
create index gebruikersaanvragen_org_idx on gebruikersaanvragen (organisation_id, status);

create table org_gezondheid (
  organisation_id text primary key references organisations(id) on delete cascade,
  stand           text not null check (stand in ('gezond', 'let_op', 'risico', 'leeg')),
  redenen         text[] not null default '{}',
  gebruikers      int not null default 0,
  met_login       int not null default 0,
  laatst_actief   timestamptz,
  berekend_op     timestamptz not null default now()
);

create table platform_audit (
  id                  text primary key default gen_random_uuid()::text,
  actor_id            text not null,
  actieve_organisatie text,
  handeling           text not null,
  object              text,
  voor                jsonb,
  na                  jsonb,
  reden               text,
  ip                  text,
  op                  timestamptz not null default now()
);
create index platform_audit_op_idx on platform_audit (op desc);
create index platform_audit_org_idx on platform_audit (actieve_organisatie, op desc);

create table toegangsverzoeken (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  founder_id      text not null,
  founder_naam    text not null,
  reden           text not null,
  modus           text not null check (modus in ('meekijken', 'wijzigen')),
  status          text not null default 'open' check (status in ('open', 'goedgekeurd', 'afgewezen', 'gebruikt')),
  aangevraagd_op  timestamptz not null default now(),
  geldig_tot      timestamptz not null default now() + interval '24 hours',
  besloten_door   text,
  besloten_op     timestamptz
);
create index toegangsverzoeken_org_idx on toegangsverzoeken (organisation_id, status);

-- platform_audit: geen update of delete, voor welke rol ook.
create or replace function dealtrace_alleen_toevoegen() returns trigger
  language plpgsql as $$
begin
  raise exception 'platform_audit is alleen toevoegen' using errcode = '42501';
end $$;
create trigger platform_audit_alleen_toevoegen before update or delete on platform_audit
  for each row execute function dealtrace_alleen_toevoegen();
create trigger platform_audit_geen_truncate before truncate on platform_audit
  for each statement execute function dealtrace_alleen_toevoegen();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- Klantkant (dealtrace_app): eigen organisatie.
do $$
declare t text;
begin
  foreach t in array array['gebruikersaanvragen', 'toegangsverzoeken'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy org_isolation on %I using (organisation_id = current_org_id()) with check (organisation_id = current_org_id())', t);
  end loop;
end $$;
-- Alleen platform: geen org-regel, dus de app ziet niets (ook zonder grants).
alter table org_gezondheid enable row level security;
alter table org_gezondheid force row level security;
alter table platform_audit enable row level security;
alter table platform_audit force row level security;

-- Platformkant (dealtrace_platform): over organisaties heen, alleen deze tabellen.
do $$
declare t text;
begin
  foreach t in array array['organisations', 'users', 'teams', 'org_settings', 'gebruikersaanvragen', 'toegangsverzoeken',
                           'org_gezondheid', 'platform_audit'] loop
    execute format('create policy platform_alles on %I to dealtrace_platform using (true) with check (true)', t);
  end loop;
  -- Meldingen en audit van de klant: alleen toevoegen (insert), nooit lezen.
  foreach t in array array['audit_events', 'notificaties'] loop
    execute format('create policy platform_toevoegen on %I for insert to dealtrace_platform with check (true)', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Functies voor het platform: alleen getallen, nooit klantrecords.
-- ---------------------------------------------------------------------------
create or replace function dealtrace_platform_tellingen()
  returns table (organisation_id text, gebruikers int, met_login int, laatste_inlog timestamptz,
                 laatste_activiteit timestamptz, activiteiten_30d int)
  language sql stable security definer set search_path = public
  as $$
    select o.id,
           (select count(*)::int from users u where u.organisation_id = o.id and u.status <> 'gearchiveerd'),
           (select count(*)::int from users u where u.organisation_id = o.id and u.status <> 'gearchiveerd' and u.laatste_inlog is not null),
           (select max(u.laatste_inlog) from users u where u.organisation_id = o.id),
           (select max(a.op) from activiteiten a where a.organisation_id = o.id),
           (select count(*)::int from activiteiten a where a.organisation_id = o.id and a.op > now() - interval '30 days')
    from organisations o
    where o.status <> 'systeem'
  $$;

-- Melding aan alle founders (systeemorganisatie). De app mag dit aanroepen,
-- bijvoorbeeld bij een gebruikersaanvraag van een beheerder; hij krijgt niets terug.
create or replace function dealtrace_meld_founders(p_titel text, p_tekst text, p_link text)
  returns void
  language sql volatile security definer set search_path = public
  as $$
    insert into notificaties (organisation_id, gebruiker_id, soort, titel, tekst, link)
    select u.organisation_id, u.id, 'systeem', left(p_titel, 200), left(p_tekst, 1000), p_link
    from users u where u.role = 'founder' and u.status = 'actief'
  $$;
