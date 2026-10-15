// DELETE /api/regels/:id: beheerder; een Expert alleen zijn eigen persoonlijke regel.
import { eq } from 'drizzle-orm'
import { schrijfAudit } from '../../../utils/audit'
import { metOrganisatie, schema } from '../../../utils/db'
import { regelUitRij } from '../../../utils/motor'
import { vereisOrganisatie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [rij] = await tx.select().from(schema.activityRules).where(eq(schema.activityRules.id, id))
    if (!rij) throw createError({ statusCode: 404, statusMessage: 'Regel onbekend' })
    const r = regelUitRij(rij)
    const mag = ctx.gebruiker.rol === 'beheerder' || (r.scope === 'persoonlijk' && r.eigenaarId === ctx.gebruiker.id)
    if (!mag) throw createError({ statusCode: 403, statusMessage: 'Alleen de beheerder verwijdert regels' })
    await tx.delete(schema.activityRules).where(eq(schema.activityRules.id, id))
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'regel.verwijderen', resourceType: 'activity_rules', resourceId: id, changes: r })
    setResponseStatus(event, 204)
    return null
  })
})
