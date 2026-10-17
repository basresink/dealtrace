-- Platformbeheer, pakket C: Data en AVG en de AI per klant in de klantflyout.
-- De platformrol leest klantdata nooit direct. Deze functies geven alleen getallen en data (geen namen,
-- geen e-mailadressen, geen teksten): wat er van een klant in Dealtrace staat, wanneer de beheerder
-- voor het laatst exporteerde, en welke agent-prompts de klant zelf heeft (slot, versie, datum).

create or replace function dealtrace_platform_avg(p_org text)
  returns table (
    accounts int, prospects int, klanten int, gedeactiveerd int,
    contacten int, contacten_verrijkt int, contacten_import int,
    leads_open int, leads_afgewezen int, accounts_per_bron jsonb, leads_per_bron jsonb,
    activiteiten int, verslagen int, transcripten int, bijlagen int, bijlagen_bytes bigint, opnames int,
    onderdrukt int, bel_me_niet int, laatste_export timestamptz, exports_12m int)
  language sql stable security definer set search_path = public
  as $$
    select
      (select count(*)::int from accounts a where a.organisation_id = p_org and a.gedeactiveerd_op is null),
      (select count(*)::int from accounts a where a.organisation_id = p_org and a.gedeactiveerd_op is null and a.account_kind = 'prospect'),
      (select count(*)::int from accounts a where a.organisation_id = p_org and a.gedeactiveerd_op is null and a.account_kind = 'klant'),
      (select count(*)::int from accounts a where a.organisation_id = p_org and a.gedeactiveerd_op is not null),
      (select count(*)::int from contacts c where c.organisation_id = p_org),
      (select count(*)::int from contacts c where c.organisation_id = p_org
         and jsonb_typeof(c.data->'herkomst') = 'object'
         and exists (select 1 from jsonb_each(c.data->'herkomst') h
                     where jsonb_typeof(h.value) = 'object' and h.value->>'bron' in ('kvk', 'datacollectief', 'crm', 'salesdna', 'web', 'ai'))),
      (select count(*)::int from contacts c where c.organisation_id = p_org and (c.data->>'bron' in ('import', 'leadgenerator') or c.data ? 'importBatchId')),
      (select count(*)::int from leads l where l.organisation_id = p_org and l.status = 'nieuw'),
      (select count(*)::int from leads l where l.organisation_id = p_org and l.status = 'afgewezen'),
      (select coalesce(jsonb_object_agg(b, n), '{}'::jsonb) from (
         select coalesce(a.nb_bron, 'onbekend') as b, count(*)::int as n from accounts a where a.organisation_id = p_org group by 1) x),
      (select coalesce(jsonb_object_agg(b, n), '{}'::jsonb) from (
         select l.bron as b, count(*)::int as n from leads l where l.organisation_id = p_org group by 1) x),
      (select count(*)::int from activiteiten x where x.organisation_id = p_org),
      (select count(*)::int from activiteit_verslagen x where x.organisation_id = p_org),
      (select count(*)::int from transcripten x where x.organisation_id = p_org),
      (select count(*)::int from bijlagen x where x.organisation_id = p_org),
      (select coalesce(sum(x.grootte), 0)::bigint from bijlagen x where x.organisation_id = p_org),
      (select count(*)::int from bijlagen x where x.organisation_id = p_org and x.soort = 'opname'),
      (select count(*)::int from onderdrukkingslijst x where x.organisation_id = p_org),
      (select count(*)::int from bel_me_niet x where x.organisation_id = p_org),
      (select max(e.occurred_at) from audit_events e where e.organisation_id = p_org and e.action = 'organisatie.export'),
      (select count(*)::int from audit_events e where e.organisation_id = p_org and e.action = 'organisatie.export' and e.occurred_at > now() - interval '12 months')
  $$;

create or replace function dealtrace_platform_prompts(p_org text)
  returns table (slot text, versies int, laatste_versie int, laatste_op timestamptz)
  language sql stable security definer set search_path = public
  as $$
    select p.slot, count(*)::int, max(p.versie)::int, max(p.op)
    from prompt_versies p where p.organisation_id = p_org and p.laag = 'organisatie'
    group by p.slot order by p.slot
  $$;

revoke execute on function dealtrace_platform_avg(text), dealtrace_platform_prompts(text) from public;
grant execute on function dealtrace_platform_avg(text), dealtrace_platform_prompts(text) to dealtrace_platform;

-- "Gebruik de platformkoppeling": de founder haalt de eigen AI-koppeling van een klant weg. Een eigen rij
-- zonder sleutel gaat in dealtrace_llm_koppeling vóór die van het platform, dus weghalen is de enige weg terug.
grant delete on llm_connections to dealtrace_platform;
