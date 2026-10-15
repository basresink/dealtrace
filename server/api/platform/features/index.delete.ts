// DELETE /api/platform/features {functie, niveau, organisatieId}: "Terug naar standaard"
// haalt de afwijking van één organisatie weg.
import type { Niveau } from '../../../../shared/types'
import { celObject, isNiveaucel, leesCel, zetCel } from '../../../utils/features'
import { alsPlatform, platformAudit, requireFounder } from '../../../utils/platform'

export default defineEventHandler(async (event) => {
  const ctx = await requireFounder(event)
  const b = await readBody<{ functie?: string; niveau?: string; organisatieId?: string }>(event)
  if (!b?.functie || !b.niveau || !isNiveaucel(b.functie, b.niveau)) throw createError({ statusCode: 422, statusMessage: 'Onbekende functie of niveau' })
  if (!b.organisatieId) throw createError({ statusCode: 422, statusMessage: 'Alleen een afwijking van één organisatie gaat terug naar standaard' })
  await alsPlatform(async (tx) => {
    const voor = await leesCel(tx, b.functie!, b.niveau as Niveau, b.organisatieId!)
    if (!voor) return
    await zetCel(tx, b.functie!, b.niveau as Niveau, b.organisatieId!, null, ctx.gebruiker.id)
    await platformAudit(tx, event, ctx, { organisatieId: b.organisatieId!, handeling: 'feature.standaard', object: celObject(b.functie!, b.niveau!, b.organisatieId!), voor, na: null })
  })
  setResponseStatus(event, 204)
  return null
})
