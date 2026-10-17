// PUT /api/mailsjablonen/:id/actief {actief}: een sjabloon aan- of uitzetten (beheerder). De versie blijft
// gelijk, want de inhoud verandert niet; wel een auditregel.
import { sql } from 'drizzle-orm'
import { schrijfAudit } from '../../../utils/audit'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'instellingen.mailsjablonen')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ actief?: unknown }>(event)
  if (typeof b?.actief !== 'boolean') throw createError({ statusCode: 422, statusMessage: 'Geef aan of het sjabloon aan of uit staat' })
  const actief = b.actief
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [r] = (await tx.execute(sql`update mailsjablonen set actief = ${actief}, updated_at = now() where id = ${id} returning id, naam`)).rows as any[]
    if (!r) throw createError({ statusCode: 404, statusMessage: 'Sjabloon niet gevonden' })
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: actief ? 'mailsjabloon.aan' : 'mailsjabloon.uit', resourceType: 'mailsjablonen', resourceId: r.id, changes: { actief } })
    return { id: r.id, actief }
  })
})
