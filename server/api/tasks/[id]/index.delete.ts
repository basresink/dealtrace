// DELETE /api/tasks/:id: echt verwijderen (F06). Mag wie de taak mag afronden: de eigenaar, zijn salesmanager en de
// beheerder; een taak zonder eigenaar alleen de beheerder. De voet van het taakvenster vraagt eerst om bevestiging.
// Prospects verwijder je nooit (0064: deactiveren); een taak wel.
import { eq } from 'drizzle-orm'
import { schrijfAudit } from '../../../utils/audit'
import { metOrganisatie, schema } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'
import { magTaak } from '../../../utils/taken'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'taken.basis')
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [bestaand] = await tx.select({ ownerId: schema.tasks.ownerId }).from(schema.tasks).where(eq(schema.tasks.id, id))
    if (!bestaand) throw createError({ statusCode: 404, statusMessage: 'Taak onbekend' })
    if (!(ctx.gebruiker.rol === 'beheerder' || (bestaand.ownerId && await magTaak(tx, ctx, bestaand.ownerId)))) throw createError({ statusCode: 403, statusMessage: 'Dit is niet jouw taak; annuleer hem met een reden' })
    const [t] = await tx.delete(schema.tasks).where(eq(schema.tasks.id, id)).returning()
    if (!t) throw createError({ statusCode: 404, statusMessage: 'Taak onbekend' })
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'taak.verwijderen', resourceType: 'tasks', resourceId: id, changes: { title: t.title } })
    setResponseStatus(event, 204)
    return null
  })
})
