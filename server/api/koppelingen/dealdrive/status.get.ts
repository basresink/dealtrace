// GET /api/koppelingen/dealdrive/status: de stand van de DealDrive-koppeling (uit, mock, http) en de
// laatste overdracht (beheerder). De stand zet alleen de founder.
import { sql } from 'drizzle-orm'
import { metOrganisatie } from '../../../utils/db'
import { dealdriveStand, overdrachtUit } from '../../../utils/overdracht'
import { vereisOrganisatie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  if (!['beheerder', 'founder'].includes(ctx.gebruiker.rol)) throw createError({ statusCode: 403, statusMessage: 'Alleen voor de beheerder' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [o] = (await tx.execute(sql`select * from overdrachten where naar = 'dealdrive' order by op desc limit 1`)).rows as any[]
    const telling = (await tx.execute(sql`select status, count(*)::int as n from overdrachten group by status`)).rows as any[]
    return { stand: await dealdriveStand(tx), laatste: o ? overdrachtUit(o) : null, telling: Object.fromEntries(telling.map((r) => [r.status, r.n])) }
  })
})
