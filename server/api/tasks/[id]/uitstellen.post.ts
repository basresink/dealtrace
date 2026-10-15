// POST /api/tasks/:id/uitstellen {periode: 'werkdag'|'week'}: tijdstip blijft; telt vanaf de
// oude vervaldatum als die in de toekomst ligt.
import { eq } from 'drizzle-orm'
import { uitstellen } from '../../../../shared/taken'
import { metOrganisatie, schema } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'
import { magTaak } from '../../../utils/taken'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'taken.basis')
  const id = getRouterParam(event, 'id')!
  const { periode } = await readBody<{ periode?: string }>(event)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [t] = await tx.select().from(schema.tasks).where(eq(schema.tasks.id, id))
    if (!t) throw createError({ statusCode: 404, statusMessage: 'Taak onbekend' })
    if (t.ownerId && !(await magTaak(tx, ctx, t.ownerId))) throw createError({ statusCode: 403, statusMessage: 'Dit is niet jouw taak' })
    const werkdagen = ((await tx.select().from(schema.orgSettings).where(eq(schema.orgSettings.key, 'werkdagen')))[0]?.value as any) ?? {}
    const due = uitstellen(t, periode === 'week' ? 'week' : 'werkdag', new Date(), werkdagen)
    await tx.update(schema.tasks).set({ dueDate: due, updatedAt: new Date().toISOString() }).where(eq(schema.tasks.id, id))
    return { id, dueDate: due }
  })
})
