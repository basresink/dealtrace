// DELETE /api/tasks/:id: echt verwijderen, alleen de beheerder (F06).
import { eq } from 'drizzle-orm'
import { schrijfAudit } from '../../../utils/audit'
import { metOrganisatie, schema } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'taken.basis')
  if (ctx.gebruiker.rol !== 'beheerder') throw createError({ statusCode: 403, statusMessage: 'Alleen de beheerder verwijdert taken; annuleer met een reden' })
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [t] = await tx.delete(schema.tasks).where(eq(schema.tasks.id, id)).returning()
    if (!t) throw createError({ statusCode: 404, statusMessage: 'Taak onbekend' })
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'taak.verwijderen', resourceType: 'tasks', resourceId: id, changes: { title: t.title } })
    setResponseStatus(event, 204)
    return null
  })
})
