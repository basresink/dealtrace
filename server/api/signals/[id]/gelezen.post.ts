// POST /api/signals/:id/gelezen: "Markeer als gelezen".
import { and, eq } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'taken.basis')
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    await tx.update(schema.signals).set({ status: 'gelezen', updatedAt: new Date().toISOString() }).where(and(eq(schema.signals.id, id), eq(schema.signals.status, 'nieuw')))
    return { id, status: 'gelezen' }
  })
})
