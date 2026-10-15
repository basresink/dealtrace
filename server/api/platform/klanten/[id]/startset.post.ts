// POST /api/platform/klanten/:id/startset: "Startset aanvullen", idempotent.
import { eq } from 'drizzle-orm'
import { schema } from '../../../../utils/db'
import { pasStartsetToe } from '../../../../utils/orgStarter'
import { alsPlatform, platformAudit, requireFounder } from '../../../../utils/platform'

export default defineEventHandler(async (event) => {
  const ctx = await requireFounder(event)
  const id = getRouterParam(event, 'id')!
  return alsPlatform(async (tx) => {
    const [o] = await tx.select().from(schema.organisations).where(eq(schema.organisations.id, id))
    if (!o || o.status === 'systeem') throw createError({ statusCode: 404, statusMessage: 'Klant onbekend' })
    const startset = await pasStartsetToe(tx, id, o.name)
    await platformAudit(tx, event, ctx, { organisatieId: id, handeling: 'startset.aanvullen', object: id, na: { startset } })
    return { startset }
  })
})
