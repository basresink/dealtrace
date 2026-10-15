// POST /api/notificaties/:id/gelezen: alleen eigen meldingen; "gelezen" staat op de server (8.10).
import { and, eq } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../../utils/db'
import { vereisOrganisatie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const { gebruiker, organisatie } = await vereisOrganisatie(event)
  const id = getRouterParam(event, 'id')!
  const res = await metOrganisatie(organisatie.id, (tx) =>
    tx.update(schema.notificaties).set({ gelezenOp: new Date().toISOString() })
      .where(and(eq(schema.notificaties.id, id), eq(schema.notificaties.gebruikerId, gebruiker.id))).returning({ id: schema.notificaties.id }))
  if (!res.length) throw createError({ statusCode: 404, statusMessage: 'Melding onbekend' })
  return { ok: true }
})
