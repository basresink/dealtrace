// GET /api/accounts/:id/overdracht: het venster "Overdragen?": mag het, de keuzes met reden, de
// vervolgstap uit "Rond af", de collega's, het voorbeeld met de briefing en de stand van een lopende overdracht.
import { metOrganisatie } from '../../../utils/db'
import { voorbereiding } from '../../../utils/overdracht'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'overdracht.basis')
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, (tx) => voorbereiding(tx, id, ctx.gebruiker))
})
