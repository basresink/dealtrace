// PUT /api/platform/klanten/:id/avg/verzoeken/:vid {status: afgehandeld | open}: een AVG-verzoek afhandelen
// of heropenen. Founder, platformaudit.
import { eq } from 'drizzle-orm'
import { schema } from '../../../../../../utils/db'
import { alsPlatform, platformAudit, requireFounder } from '../../../../../../utils/platform'
import { leesAvgData, vandaagNL } from '../../../../../../utils/platformAvg'

export default defineEventHandler(async (event) => {
  const ctx = await requireFounder(event)
  const id = getRouterParam(event, 'id')!
  const vid = getRouterParam(event, 'vid')!
  const b = await readBody<{ status?: string }>(event)
  if (b?.status !== 'afgehandeld' && b?.status !== 'open') throw createError({ statusCode: 400, statusMessage: 'Kies afgehandeld of open' })
  return alsPlatform(async (tx) => {
    const [o] = await tx.select().from(schema.organisations).where(eq(schema.organisations.id, id))
    if (!o || o.status === 'systeem') throw createError({ statusCode: 404, statusMessage: 'Klant onbekend' })
    const avg = leesAvgData(o.data)
    const v = avg.verzoeken.find((x) => x.id === vid)
    if (!v) throw createError({ statusCode: 404, statusMessage: 'Verzoek onbekend' })
    const voor = { status: v.status, afgehandeldOp: v.afgehandeldOp ?? null }
    v.status = b.status as 'open' | 'afgehandeld'
    v.afgehandeldOp = v.status === 'afgehandeld' ? vandaagNL() : null
    await tx.update(schema.organisations).set({ data: { ...o.data, avg }, updatedAt: new Date().toISOString() }).where(eq(schema.organisations.id, id))
    await platformAudit(tx, event, ctx, { organisatieId: id, handeling: v.status === 'afgehandeld' ? 'avg.verzoek.afgehandeld' : 'avg.verzoek.heropend', object: vid, voor, na: { status: v.status, afgehandeldOp: v.afgehandeldOp } })
    return { verzoek: v }
  })
})
