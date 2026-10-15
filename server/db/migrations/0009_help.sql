-- P09: helpcenter (F21). Platformartikelen hebben geen organisatie en zijn voor
-- iedereen leesbaar; een eigen artikel (P25) alleen voor de eigen organisatie.
create extension if not exists unaccent with schema public;

-- unaccent is niet immutable; deze wrapper wel, zodat hij in een index kan.
create or replace function dealtrace_zoektekst(t text) returns text
  language sql immutable parallel safe as $$ select lower(public.unaccent('public.unaccent'::regdictionary, coalesce(t, ''))) $$;

create table help_artikelen (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text references organisations(id) on delete cascade,
  collectie       text not null default 'product' check (collectie in ('product', 'newbusiness')),
  categorie       text not null,
  slug            text not null,
  titel           text not null,
  niveau          text check (niveau in ('beginner', 'gevorderd', 'expert')),
  status          text not null default 'gepubliceerd' check (status in ('concept', 'gepubliceerd', 'gearchiveerd')),
  versie          int not null default 1,
  data            jsonb not null default '{}'::jsonb,
  gepubliceerd_op timestamptz not null default now(),
  bijgewerkt_op   timestamptz not null default now()
);
create unique index help_artikelen_slug on help_artikelen (coalesce(organisation_id, ''), slug);
create index help_artikelen_zoek on help_artikelen using gin (to_tsvector('dutch', dealtrace_zoektekst(titel || ' ' || coalesce(data->>'samenvatting', '') || ' ' || coalesce(data->>'inhoud', ''))));
alter table help_artikelen enable row level security;
alter table help_artikelen force row level security;
create policy lezen on help_artikelen for select using (organisation_id is null or organisation_id = current_org_id());
create policy eigen_schrijven on help_artikelen for all using (organisation_id = current_org_id()) with check (organisation_id = current_org_id());
create policy platform_alles on help_artikelen to dealtrace_platform using (true) with check (true);

create table help_gelezen (
  organisation_id text not null references organisations(id) on delete cascade,
  gebruiker_id    text not null references users(id) on delete cascade,
  artikel_id      text not null references help_artikelen(id) on delete cascade,
  op              timestamptz not null default now(),
  primary key (gebruiker_id, artikel_id)
);
create table help_feedback (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  gebruiker_id    text not null,
  artikel_id      text not null references help_artikelen(id) on delete cascade,
  nuttig          boolean not null,
  reden           text,
  op              timestamptz not null default now()
);
create table help_zoekopdrachten (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  term            text not null,
  resultaten      int not null,
  op              timestamptz not null default now()
);
do $$
declare t text;
begin
  foreach t in array array['help_gelezen', 'help_feedback', 'help_zoekopdrachten'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy org_isolation on %I using (organisation_id = current_org_id()) with check (organisation_id = current_org_id())', t);
  end loop;
end $$;

-- Features per niveau: de founder schrijft via de platformrol (F23).
create policy platform_alles on functies_per_niveau to dealtrace_platform using (true) with check (true);
