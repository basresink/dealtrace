// GET /api/weekstart: het weekplan van maandag. Afspraken en bezoeken per dag, belblokken, de voornemens
// uit de weekreview met hun stand, wat openstaat, het tempo tegen je doel en de belangrijkste aanleidingen.
// Plus de blokken (shared/ritmeBlokken.ts), elk alleen als de functie voor jou aanstaat.
import { metOrganisatie } from '../utils/db'
import { laadWeekstart } from '../utils/dagritmeWeek'
import { vereisFunctie } from '../utils/sessie'
import { kan } from '../utils/accounts'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'dagritme.weekstart')
  return metOrganisatie(ctx.organisatie!.id, (tx) => laadWeekstart(tx, ctx.gebruiker.id, new Date(), { kan: (sleutel) => kan(ctx, sleutel) }))
})
