-- P04: import en datakwaliteit (F02 tabblad Importeren, 15.1, 15.2).
create table import_batches (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  gebruiker_id    text not null references users(id) on delete cascade,
  bestandsnaam    text not null,
  soort           text not null check (soort in ('bedrijven', 'bedrijven_contacten')),
  bron_label      text not null,
  koppeling       jsonb not null default '{}'::jsonb,
  rapport         jsonb not null default '{}'::jsonb,
  -- Tijdelijke opslag van de rijen tot de batch verwerkt is; daarna leeg.
  rijen           jsonb,
  status          text not null default 'concept' check (status in ('concept', 'verwerkt', 'teruggedraaid')),
  verwerkt_op     timestamptz,
  created_at      timestamptz not null default now()
);
create index import_batches_org_idx on import_batches (organisation_id, created_at desc);

-- Onderdrukkingslijst (15.2): afgemelde e-mailadressen, gehasht (sha256 van het adres in kleine letters).
create table onderdrukkingslijst (
  organisation_id text not null references organisations(id) on delete cascade,
  email_hash      text not null,
  op              timestamptz not null default now(),
  bron            text not null default 'afgemeld',
  primary key (organisation_id, email_hash)
);

do $$
declare t text;
begin
  foreach t in array array['import_batches', 'onderdrukkingslijst'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy org_isolation on %I using (organisation_id = current_org_id()) with check (organisation_id = current_org_id())', t);
  end loop;
end $$;

create index accounts_import_idx on accounts (organisation_id, (data->>'importBatchId')) where data ? 'importBatchId';
