// POST /api/belscripts/:id/activeer: een nieuwe versie; 422 bij een validatiefout.
import { eq } from 'drizzle-orm'
import { schrijfAudit } from '../../../utils/audit'
import { metOrganisatie, schema } from '../../../utils/db'
import { kan } from '../../../utils/accounts'
import { activeer } from '../../../utils/belscripts'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'belscript.kiezen')
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [r] = await tx.select({ p: schema.belscripts.isPersoonlijk, g: schema.belscripts.gebruikerId }).from(schema.belscripts).where(eq(schema.belscripts.id, id))
    if (!r || (r.p && r.g !== ctx.gebruiker.id)) throw createError({ statusCode: 404, statusMessage: 'Script onbekend' })
    if (r.p ? !kan(ctx, 'belscript.variant') : !kan(ctx, 'belscript.beheer')) throw createError({ statusCode: 403, statusMessage: 'Je mag dit script niet activeren' })
    const uit = await activeer(tx, id, ctx.gebruiker.id)
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'belscript.activeren', resourceType: 'belscripts', resourceId: id, changes: { versie: uit.versie } })
    return uit
  })
})
