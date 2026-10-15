// POST /api/tasks/:id/annuleren {reden}: annuleren met reden is de standaard (F06).
import { eq } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'
import { magTaak } from '../../../utils/taken'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'taken.basis')
  const id = getRouterParam(event, 'id')!
  const { reden } = await readBody<{ reden?: string }>(event)
  if (!reden?.trim()) throw createError({ statusCode: 422, statusMessage: 'Geef een reden' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [t] = await tx.select().from(schema.tasks).where(eq(schema.tasks.id, id))
    if (!t) throw createError({ statusCode: 404, statusMessage: 'Taak onbekend' })
    if (t.ownerId && !(await magTaak(tx, ctx, t.ownerId))) throw createError({ statusCode: 403, statusMessage: 'Dit is niet jouw taak' })
    await tx.update(schema.tasks).set({ status: 'geannuleerd', data: { ...(t.data ?? {}), annuleerReden: reden.trim().slice(0, 300) }, updatedAt: new Date().toISOString() }).where(eq(schema.tasks.id, id))
    return { id, status: 'geannuleerd' }
  })
})
