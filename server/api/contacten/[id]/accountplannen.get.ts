// GET /api/contacten/:id/accountplannen: de accountplannen waar dit contact in voorkomt, als contactpersoon van
// het plan of met een actie in het actieplan (voor de contactkaart). Zonder de functie Accountplannen een lege lijst.
import { plannenVanContact } from '../../../utils/accountplannen'
import { metOrganisatie } from '../../../utils/db'
import { beschikbaar } from '../../../../shared/functies'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'contacten.basis')
  const id = getRouterParam(event, 'id')!
  if (!beschikbaar('nav.accountplannen', ctx.gebruiker, ctx.organisatie, ctx.stand).ok) return { contactId: id, plannen: [], aan: false }
  return metOrganisatie(ctx.organisatie.id, async (tx) => ({ ...(await plannenVanContact(tx, id)), aan: true }))
})
