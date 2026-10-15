-- P27: inloggen met een code per mail (B12), TOTP voor de founder, sessies per toestel.
-- Vóór het inloggen is er geen organisatie; deze tabellen hebben daarom geen RLS en zijn
-- alleen via de server bereikbaar. Ze bevatten geen e-mailadressen, alleen hashes.
create table inlog_aanvragen (
  id         bigint generated always as identity primary key,
  email_hash text not null,
  op         timestamptz not null default now()
);
create index inlog_aanvragen_email on inlog_aanvragen (email_hash, op desc);

create table inlog_codes (
  id          text primary key default gen_random_uuid()::text,
  email_hash  text not null,
  code_hash   text not null,
  verloopt_op timestamptz not null,
  gebruikt_op timestamptz,
  pogingen    int not null default 0,
  op          timestamptz not null default now()
);
create index inlog_codes_email on inlog_codes (email_hash, op desc);

-- Een sessie is een toestel: de cookie draagt het id; intrekken maakt de sessie ongeldig.
create table gebruiker_toestellen (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text references organisations(id) on delete cascade,
  gebruiker_id    text not null references users(id) on delete cascade,
  label           text not null,
  aangemaakt_op   timestamptz not null default now(),
  laatst_gezien   timestamptz not null default now(),
  ingetrokken_op  timestamptz
);
create index gebruiker_toestellen_gebruiker on gebruiker_toestellen (gebruiker_id);

-- Opzoeken op e-mail vóór het inloggen (RLS op users omzeild, alleen deze velden).
create or replace function dealtrace_gebruiker_op_email(p_email text)
  returns table (id text, organisation_id text, role text, status text, totp jsonb)
  language sql stable security definer set search_path = public
  as $$
    select u.id, u.organisation_id, u.role, u.status, u.data->'totp' from users u where lower(u.email) = lower(p_email)
  $$;

-- Geslaagde verificatie: laatste inlog bijwerken.
create or replace function dealtrace_inlog_geslaagd(p_id text) returns void
  language sql volatile security definer set search_path = public
  as $$ update users set laatste_inlog = now() where id = p_id $$;

-- TOTP-geheim (versleuteld door de server) zetten of wissen.
create or replace function dealtrace_zet_totp(p_id text, p_totp jsonb) returns void
  language sql volatile security definer set search_path = public
  as $$ update users set data = case when p_totp is null then data - 'totp' else data || jsonb_build_object('totp', p_totp) end where id = p_id $$;

grant execute on function dealtrace_gebruiker_op_email(text), dealtrace_inlog_geslaagd(text), dealtrace_zet_totp(text, jsonb) to dealtrace_app;
