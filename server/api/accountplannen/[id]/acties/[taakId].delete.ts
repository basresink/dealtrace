// DELETE /api/accountplannen/:id/acties/:taakId: de actie uit het plan; de taak wordt geannuleerd met een reden.
import { haalPlanActieWeg } from '../../../../utils/accountplannen'
import { metOrganisatie } from '../../../../utils/db'
import { vereisFunctie } from '../../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.accountplannen')
  return metOrganisatie(ctx.organisatie.id, (tx) => haalPlanActieWeg(tx, getRouterParam(event, 'id')!, getRouterParam(event, 'taakId')!, ctx.gebruiker))
})
