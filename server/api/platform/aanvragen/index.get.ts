// GET /api/platform/aanvragen: open gebruikersaanvragen van alle klanten.
import { desc, eq } from 'drizzle-orm'
import { schema } from '../../../utils/db'
import { alsPlatform, requireFounder } from '../../../utils/platform'

export default defineEventHandler(async (event) => {
  await requireFounder(event)
  return alsPlatform(async (tx) => {
    const rijen = await tx.select({ a: schema.gebruikersaanvragen, klant: schema.organisations.name })
      .from(schema.gebruikersaanvragen)
      .innerJoin(schema.organisations, eq(schema.organisations.id, schema.gebruikersaanvragen.organisationId))
      .where(eq(schema.gebruikersaanvragen.status, 'open'))
      .orderBy(desc(schema.gebruikersaanvragen.aangevraagdOp))
    return rijen.map((r) => ({ ...r.a, klant: r.klant }))
  })
})
