// Status prospect (koud, lauw, warm, heet) voor een deel van de prospects van Eva Ervaren (u-07), zodat het
// blok Status prospect op Mijn dashboard en het label op de accountkaart gevuld zijn. Aanvulling op de al
// gedraaide seed van Eva: alleen prospects zonder status worden bijgewerkt, en de keuze hangt alleen af van
// het id en de fase, dus een tweede keer draaien verandert niets. Ongeveer een op de vier houdt geen status.
import type pg from 'pg'

export async function seedEvaStatus(client: pg.Client, orgId: string): Promise<number> {
  const r = await client.query(
    `with keuze as (
       select a.id,
         case
           when a.fase_id in ('afspraak-gepland', 'afspraak-gehouden') then 'heet'
           when a.fase_id = 'in-gesprek' then (case when abs(hashtext(a.id)) % 3 = 0 then 'heet' else 'warm' end)
           else (array['koud', 'koud', 'lauw', 'lauw', 'lauw', 'warm', 'warm', null, null, null])[abs(hashtext(a.id)) % 10 + 1]
         end as status
       from accounts a
       where a.organisation_id = $1 and a.owner_id = 'u-07' and a.account_kind = 'prospect' and a.gedeactiveerd_op is null
         and not (coalesce(a.data, '{}'::jsonb) ? 'prospectStatus')
     )
     update accounts a set data = coalesce(a.data, '{}'::jsonb) || jsonb_build_object('prospectStatus', k.status)
     from keuze k where a.id = k.id and k.status is not null`,
    [orgId],
  )
  return r.rowCount ?? 0
}
