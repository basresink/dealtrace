// GET /api/koppelingen/:soort/runs?fouten=1: het synchronisatielog, nieuwste eerst (Expert en beheerder).
import { sql } from 'drizzle-orm'
import { crmSoortUit } from '../../../utils/crmApi'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'koppeling.crmSync')
  const soort = crmSoortUit(event)
  const alleenFouten = getQuery(event).fouten === '1'
  return metOrganisatie(ctx.organisatie.id, async (tx) => ((await tx.execute(sql`select id, handeling, start, eind, gelezen, geschreven, fouten from koppeling_runs where soort = ${soort}
    ${alleenFouten ? sql`and jsonb_array_length(fouten) > 0` : sql``} order by start desc limit 50`)).rows as any[]).map((r) => ({ ...r, start: new Date(r.start).toISOString(), eind: r.eind ? new Date(r.eind).toISOString() : null })))
})
