// POST /api/platform/klanten/:id/avg/export {reden}: de founder maakt zelf geen export van klantdata, maar
// vraagt de beheerders van de klant er een te maken (Instellingen, Privacy). Melding en platformaudit.
import { eq } from 'drizzle-orm'
import { schema } from '../../../../../utils/db'
import { alsPlatform, meldBeheerders, platformAudit, requireFounder } from '../../../../../utils/platform'
import { leesAvgData } from '../../../../../utils/platformAvg'

export default defineEventHandler(async (event) => {
  const ctx = await requireFounder(event)
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ reden?: string }>(event).catch(() => ({} as { reden?: string }))
  const reden = typeof b?.reden === 'string' ? b.reden.trim().slice(0, 200) : ''
  if (reden.length < 3) throw createError({ statusCode: 422, statusMessage: 'Geef de reden voor de export' })
  return alsPlatform(async (tx) => {
    const [o] = await tx.select().from(schema.organisations).where(eq(schema.organisations.id, id))
    if (!o || o.status === 'systeem') throw createError({ statusCode: 404, statusMessage: 'Klant onbekend' })
    const avg = leesAvgData(o.data)
    const op = new Date().toISOString()
    await tx.update(schema.organisations).set({ data: { ...o.data, avg: { ...avg, exportGevraagdOp: op } }, updatedAt: op }).where(eq(schema.organisations.id, id))
    await platformAudit(tx, event, ctx, { organisatieId: id, handeling: 'avg.exportverzoek', object: id, reden })
    await meldBeheerders(tx, id, 'Maak een export van je organisatie', `Dealtrace vraagt je een export te maken: ${reden}. Dat doe je bij Instellingen, Privacy, Exporteer organisatie.`, '/instellingen/privacy')
    return { exportGevraagdOp: op }
  })
})
