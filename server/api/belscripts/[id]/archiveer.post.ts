// POST /api/belscripts/:id/archiveer: uit de keuze, wel in de rapportage.
import { eq } from 'drizzle-orm'
import { schrijfAudit } from '../../../utils/audit'
import { metOrganisatie, schema } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'belscript.beheer')
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const r = await tx.update(schema.belscripts).set({ status: 'gearchiveerd', updatedAt: new Date().toISOString() }).where(eq(schema.belscripts.id, id)).returning({ id: schema.belscripts.id })
    if (!r.length) throw createError({ statusCode: 404, statusMessage: 'Script onbekend' })
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'belscript.archiveren', resourceType: 'belscripts', resourceId: id, changes: null })
    return { id, status: 'gearchiveerd' }
  })
})
