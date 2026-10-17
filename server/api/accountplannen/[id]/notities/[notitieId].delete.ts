// DELETE /api/accountplannen/:id/notities/:notitieId: een aantekening weg (de schrijver of wie het plan mag wijzigen).
import { verwijderNotitie } from '../../../../utils/accountplannen'
import { metOrganisatie } from '../../../../utils/db'
import { vereisFunctie } from '../../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.accountplannen')
  return metOrganisatie(ctx.organisatie.id, (tx) => verwijderNotitie(tx, getRouterParam(event, 'id')!, getRouterParam(event, 'notitieId')!, ctx.gebruiker))
})
