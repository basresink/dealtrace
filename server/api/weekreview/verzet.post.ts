// POST /api/weekreview/verzet: de weekreview van deze week schuift naar maandagochtend.
import { metOrganisatie } from '../../utils/db'
import { verzetReview } from '../../utils/dagritmeWeek'
import { vereisFunctie } from '../../utils/sessie'
import { reviewWeekUit } from '../../utils/dagritmeApi'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'dagritme.weekreview')
  const b = await readBody<{ week?: string }>(event).catch(() => ({} as { week?: string }))
  const week = reviewWeekUit(b?.week)
  return metOrganisatie(ctx.organisatie!.id, (tx) => verzetReview(tx, ctx.organisatie!.id, ctx.gebruiker.id, week))
})
