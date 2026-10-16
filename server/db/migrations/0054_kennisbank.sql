-- Kennisbank (opzet van DealDrive /kennisbank): een bibliotheek van documenten van de organisatie (cases,
-- offertes, presentaties, productinfo, contracten, prijslijsten) met type, versie, het bestand zelf en de
-- uitgelezen tekst voor de AI. Een document kan aan accounts en contacten hangen (document_koppelingen):
-- het staat dan op het tabblad Documenten van die account- en contactkaart en blijft in de kennisbank
-- zoekbaar. De documenten die tot nu toe als bijlage (soort document) aan een account of contact hingen,
-- verhuizen hierheen met hetzelfde id en dezelfde koppeling.

create table documenten (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  naam            text not null check (length(trim(naam)) > 0),
  type            text not null default 'overig' check (type in ('offerte', 'case', 'presentatie', 'productinfo', 'contract', 'prijslijst', 'overig')),
  versie          text not null default '1',
  beschrijving    text,
  mime            text not null,
  grootte         int not null check (grootte >= 0 and grootte <= 8000000),
  inhoud          bytea,
  -- De uitgelezen tekst (txt, md, csv, docx, pptx) en of dat lukte. 'onbekend' wordt bij het eerste openen
  -- alsnog uitgelezen (verhuisde documenten).
  tekst           text,
  tekst_status    text not null default 'onbekend' check (tekst_status in ('gelezen', 'niet-gelezen', 'geen', 'onbekend')),
  eigenaar_id     text references users(id) on delete set null,
  gemaakt_op      timestamptz not null default now(),
  bijgewerkt_op   timestamptz not null default now()
);
create index documenten_org_idx on documenten (organisation_id, bijgewerkt_op desc);

-- Koppeling aan een account, of aan een contact (dan staat het account van dat contact er ook in, zodat de
-- accountkaart de documenten van zijn contacten toont).
create table document_koppelingen (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  document_id     text not null references documenten(id) on delete cascade,
  account_id      text not null references accounts(id) on delete cascade,
  contact_id      text references contacts(id) on delete cascade
);
create unique index document_koppelingen_uniek on document_koppelingen (document_id, account_id, coalesce(contact_id, ''));
create index document_koppelingen_account_idx on document_koppelingen (account_id);
create index document_koppelingen_contact_idx on document_koppelingen (contact_id) where contact_id is not null;

do $$
declare t text;
begin
  foreach t in array array['documenten', 'document_koppelingen'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy org_isolation on %I using (organisation_id = current_org_id()) with check (organisation_id = current_org_id())', t);
  end loop;
end $$;

-- Bestaande documenten uit bijlagen meenemen: het type geraden uit de naam, de tekst wordt later uitgelezen.
insert into documenten (id, organisation_id, naam, type, mime, grootte, inhoud, tekst_status, eigenaar_id, gemaakt_op, bijgewerkt_op)
select b.id, b.organisation_id, coalesce(nullif(trim(b.naam), ''), 'Document'),
  case
    when b.naam ilike '%offerte%' then 'offerte'
    when b.naam ilike '%contract%' or b.naam ilike '%overeenkomst%' then 'contract'
    when b.naam ilike '%prijs%' then 'prijslijst'
    when b.naam ilike '%case%' or b.naam ilike '%referentie%' then 'case'
    when b.naam ilike '%presentatie%' or b.mime like '%presentation%' or b.mime = 'application/vnd.ms-powerpoint' then 'presentatie'
    when b.naam ilike '%product%' or b.naam ilike '%brochure%' then 'productinfo'
    else 'overig'
  end,
  b.mime, b.grootte, b.inhoud, case when b.mime like 'image/%' then 'geen' else 'onbekend' end, b.eigenaar_id, b.op, b.op
from bijlagen b
where b.soort = 'document' and b.record_soort in ('account', 'contact')
  and (b.record_soort <> 'account' or exists (select 1 from accounts a where a.id = b.record_id))
  and (b.record_soort <> 'contact' or exists (select 1 from contacts c where c.id = b.record_id));

insert into document_koppelingen (organisation_id, document_id, account_id, contact_id)
select b.organisation_id, b.id, b.record_id, null from bijlagen b
where b.soort = 'document' and b.record_soort = 'account' and exists (select 1 from documenten d where d.id = b.id)
union all
select b.organisation_id, b.id, c.account_id, c.id from bijlagen b join contacts c on c.id = b.record_id
where b.soort = 'document' and b.record_soort = 'contact' and exists (select 1 from documenten d where d.id = b.id);

delete from bijlagen b where b.soort = 'document' and b.record_soort in ('account', 'contact') and exists (select 1 from documenten d where d.id = b.id);
