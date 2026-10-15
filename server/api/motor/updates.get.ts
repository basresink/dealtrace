// GET /api/motor/updates?since=: nieuwe en gewijzigde taken en inzichten van de gebruiker
// sinds een tijdstip (de client pollt elke minuut; binnen 3 minuten zichtbaar).
import { and, eq, gt } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisOrganisatie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  const q = getQuery(event)
  const since = typeof q.since === 'string' && !Number.isNaN(Date.parse(q.since)) ? new Date(q.since).toISOString() : new Date(Date.now() - 3 * 60_000).toISOString()
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const taken = await tx.select({ id: schema.tasks.id, title: schema.tasks.title, status: schema.tasks.status, updatedAt: schema.tasks.updatedAt }).from(schema.tasks)
      .where(and(eq(schema.tasks.ownerId, ctx.gebruiker.id), gt(schema.tasks.updatedAt, since))).limit(200)
    const inzichten = await tx.select({ id: schema.signals.id, title: schema.signals.title, status: schema.signals.status, updatedAt: schema.signals.updatedAt }).from(schema.signals)
      .where(and(eq(schema.signals.ownerId, ctx.gebruiker.id), gt(schema.signals.updatedAt, since))).limit(200)
    return { nu: new Date().toISOString(), taken, inzichten }
  })
})
