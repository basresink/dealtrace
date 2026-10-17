// PUT /api/platform/klanten/:id/avg {verwerkersovereenkomst: {versie, getekendOp} | null}: de stand van de
// verwerkersovereenkomst met deze klant. Founder, platformaudit.
import { eq } from 'drizzle-orm'
import { isDatum } from '../../../../../../shared/platformAvg'
import { schema } from '../../../../../utils/db'
import { alsPlatform, platformAudit, requireFounder } from '../../../../../utils/platform'
import { leesAvgData, vandaagNL } from '../../../../../utils/platformAvg'

export default defineEventHandler(async (event) => {
  const ctx = await requireFounder(event)
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ verwerkersovereenkomst?: { versie?: string; getekendOp?: string } | null }>(event)
  const vo = b?.verwerkersovereenkomst ?? null
  if (vo) {
    if (typeof vo.versie !== 'string' || !vo.versie.trim() || vo.versie.trim().length > 40) throw createError({ statusCode: 422, statusMessage: 'Geef de versie van de verwerkersovereenkomst' })
    if (!isDatum(vo.getekendOp)) throw createError({ statusCode: 422, statusMessage: 'Geef de datum van ondertekenen' })
    if (vo.getekendOp > vandaagNL()) throw createError({ statusCode: 422, statusMessage: 'De datum van ondertekenen ligt in de toekomst' })
  }
  return alsPlatform(async (tx) => {
    const [o] = await tx.select().from(schema.organisations).where(eq(schema.organisations.id, id))
    if (!o || o.status === 'systeem') throw createError({ statusCode: 404, statusMessage: 'Klant onbekend' })
    const avg = leesAvgData(o.data)
    const voor = avg.verwerkersovereenkomst
    const na = vo ? { versie: vo.versie!.trim(), getekendOp: vo.getekendOp!, door: ctx.gebruiker.naam, op: new Date().toISOString() } : null
    await tx.update(schema.organisations).set({ data: { ...o.data, avg: { ...avg, verwerkersovereenkomst: na } }, updatedAt: new Date().toISOString() }).where(eq(schema.organisations.id, id))
    await platformAudit(tx, event, ctx, { organisatieId: id, handeling: 'avg.verwerkersovereenkomst', object: id, voor, na })
    return { verwerkersovereenkomst: na }
  })
})
