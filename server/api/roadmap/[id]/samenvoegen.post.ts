// POST /api/roadmap/:id/samenvoegen {met}: de beheerder voegt een dubbele wens samen met een andere van de eigen organisatie.
import { sql } from 'drizzle-orm'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'roadmap')
  if (ctx.gebruiker.rol !== 'beheerder') throw createError({ statusCode: 403, statusMessage: 'Samenvoegen doet de beheerder' })
  const id = getRouterParam(event, 'id')!
  const { met } = await readBody<{ met?: string }>(event)
  if (!met || met === id) throw createError({ statusCode: 422, statusMessage: 'Kies de wens om mee samen te voegen' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const r = (await tx.execute(sql`update feature_requests set samengevoegd_met = ${met} where id = ${id} and exists (select 1 from feature_requests m where m.id = ${met} and m.samengevoegd_met is null) returning id`)).rows
    if (!r.length) throw createError({ statusCode: 404, statusMessage: 'Wens niet gevonden' })
    return { ok: true }
  })
})
