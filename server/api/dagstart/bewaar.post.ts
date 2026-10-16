// POST /api/dagstart/bewaar: neem de nieuwe indeling over; "Wat schoof" begint opnieuw.
import { metOrganisatie } from '../../utils/db'
import { bewaarDagindeling } from '../../utils/dagritmeWeek'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'dagritme.dagstart')
  return metOrganisatie(ctx.organisatie!.id, (tx) => bewaarDagindeling(tx, ctx.organisatie!.id, ctx.gebruiker.id, new Date()))
})
