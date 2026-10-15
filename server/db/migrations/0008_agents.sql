-- P08: agents en mandaten (11.3, F14). agent_runs is het logboek van elke
-- agenthandeling, ook wat de Bewaker tegenhield. Alleen toevoegen; bewaartermijn 13 maanden.
create table agent_runs (
  id              text primary key default gen_random_uuid()::text,
  organisation_id text not null references organisations(id) on delete cascade,
  agent           text not null,
  handeling       text not null,
  mandaat_niveau  text not null check (mandaat_niveau in ('A', 'B', 'C', 'D')),
  gebruiker_id    text,
  account_id      text,
  contact_id      text,
  task_id         text,
  uitkomst        text not null check (uitkomst in ('uitgevoerd', 'als_taak', 'geblokkeerd', 'fout')),
  reden           text,
  bronnen         jsonb not null default '[]'::jsonb,
  kosten          jsonb,
  op              timestamptz not null default now()
);
create index agent_runs_org_op_idx on agent_runs (organisation_id, op desc);
create index agent_runs_geblokkeerd_idx on agent_runs (organisation_id, op) where uitkomst = 'geblokkeerd';
alter table agent_runs enable row level security;
alter table agent_runs force row level security;
create policy org_isolation on agent_runs using (organisation_id = current_org_id()) with check (organisation_id = current_org_id());

-- Platformmaxima per agent: alleen de founder schrijft (F23). Geen organisatiekolom;
-- iedereen leest, de app schrijft niet (rollen.sql).
create table platform_agentmaxima (
  agent           text primary key,
  max_mandaat     text not null check (max_mandaat in ('A', 'B', 'C', 'D')),
  gewijzigd_door  text,
  gewijzigd_op    timestamptz not null default now()
);

-- executor_status: alleen de waarden die de code zet (gat 22).
alter table tasks add constraint tasks_executor_status_check
  check (executor_status is null or executor_status in ('concept-klaar', 'goedgekeurd', 'uitgevoerd', 'tegengehouden'));
alter table tasks add constraint tasks_executor_check check (executor is null or executor in ('mens', 'ai'));
