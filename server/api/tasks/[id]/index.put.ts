// PUT /api/tasks/:id: bewerkstand (titel, prioriteit, vervaldatum, actiesoort, toegewezen aan, beschrijving).
import { eq } from 'drizzle-orm'
import { ACTIETYPES } from '../../../../shared/taken'
import { metOrganisatie, schema } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'
import { magTaak } from '../../../utils/taken'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'taken.basis')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<any>(event)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [t] = await tx.select().from(schema.tasks).where(eq(schema.tasks.id, id))
    if (!t) throw createError({ statusCode: 404, statusMessage: 'Taak onbekend' })
    if (t.ownerId && !(await magTaak(tx, ctx, t.ownerId))) throw createError({ statusCode: 403, statusMessage: 'Dit is niet jouw taak' })
    if (b.ownerId && b.ownerId !== t.ownerId && !(await magTaak(tx, ctx, b.ownerId))) throw createError({ statusCode: 403, statusMessage: 'Je wijst alleen taken toe binnen je team' })
    const set: Partial<typeof schema.tasks.$inferInsert> = { updatedAt: new Date().toISOString() }
    if (typeof b.title === 'string') { if (b.title.trim().length < 3) throw createError({ statusCode: 422, statusMessage: 'Geef een titel van minstens 3 tekens' }); set.title = b.title.trim().slice(0, 200) }
    if (['hoog', 'middel', 'laag'].includes(b.priority)) set.priority = b.priority
    if ((ACTIETYPES as readonly string[]).includes(b.actionType)) set.actionType = b.actionType
    if (b.dueDate && !Number.isNaN(Date.parse(b.dueDate))) set.dueDate = new Date(b.dueDate).toISOString()
    if (b.ownerId) set.ownerId = b.ownerId
    if ('beschrijving' in b || 'aanleiding' in b) set.data = { ...(t.data ?? {}), ...('beschrijving' in b ? { beschrijving: String(b.beschrijving ?? '').slice(0, 2000) } : {}), ...('aanleiding' in b ? { aanleiding: String(b.aanleiding ?? '').slice(0, 500) } : {}) }
    const [na] = await tx.update(schema.tasks).set(set).where(eq(schema.tasks.id, id)).returning()
    return na
  })
})
