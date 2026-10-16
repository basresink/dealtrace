// DELETE /api/weekreview/voornemens?week=: kies opnieuw. De voornemens voor de week erna vervallen met de
// taken en belblokken die ze werden (alleen wat nog open of gepland staat) en de gedeelde coachingpunten.
import { metOrganisatie } from '../../utils/db'
import { wisVoornemens } from '../../utils/dagritmeWeek'
import { vereisFunctie } from '../../utils/sessie'
import { reviewWeekUit } from '../../utils/dagritmeApi'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'dagritme.weekreview')
  const week = reviewWeekUit(getQuery(event).week)
  return metOrganisatie(ctx.organisatie!.id, (tx) => wisVoornemens(tx, ctx.organisatie!.id, ctx.gebruiker.id, week))
})
