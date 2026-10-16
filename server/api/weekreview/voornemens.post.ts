// POST /api/weekreview/voornemens: hooguit drie voornemens die meteen iets concreets worden in de week
// erna (belblok, taak of regiodag). Met delen=true komen ze als afspraak in coaching bij je manager.
import { metOrganisatie } from '../../utils/db'
import { planVoornemens, type VoornemenInvoer } from '../../utils/dagritmeWeek'
import { vereisFunctie } from '../../utils/sessie'
import { reviewWeekUit } from '../../utils/dagritmeApi'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'dagritme.weekreview')
  const b = await readBody<{ week?: string; voornemens?: VoornemenInvoer[]; delen?: boolean }>(event)
  const week = reviewWeekUit(b?.week)
  const lijst = Array.isArray(b?.voornemens) ? b!.voornemens.map((v) => ({ soort: v?.soort, tekst: String(v?.tekst ?? ''), data: v?.data && typeof v.data === 'object' ? v.data : {} })) : []
  return metOrganisatie(ctx.organisatie!.id, (tx) => planVoornemens(tx, ctx.organisatie!.id, ctx.gebruiker.id, week, lijst as VoornemenInvoer[], b?.delen === true))
})
