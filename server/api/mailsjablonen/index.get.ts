// GET /api/mailsjablonen: de sjablonen van de organisatie (beheerder; leesbaar voor wie campagnes maakt).
import { sql } from 'drizzle-orm'
import { metOrganisatie } from '../../utils/db'
import { vereisOrganisatie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  return metOrganisatie(ctx.organisatie.id, async (tx) => ({ sjablonen: (await tx.execute(sql`select id, naam, kanaal, versie, actief, data from mailsjablonen order by naam`)).rows }))
})
