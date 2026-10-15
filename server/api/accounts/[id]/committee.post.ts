// POST /api/accounts/:id/committee: "Stel voor met AI" (P19, F04). De Profielbouwer stelt per functie
// een rol voor met bron en zekerheid; onder 60 is het vermoedelijk. 3 credits (brief); 402 zonder credits.
import { stelCommitteeVoor } from '../../../utils/agents/profielbouwer'
import { metOrganisatie } from '../../../utils/db'
import { magAccount } from '../../../utils/overdracht'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'contacten.basis')
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    if (!(await magAccount(tx, ctx.gebruiker, id))) throw createError({ statusCode: 403, statusMessage: 'Dit account is niet van jou' })
    return stelCommitteeVoor(tx, ctx.organisatie.id, { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol, niveau: ctx.gebruiker.niveau, data: ctx.gebruiker.data }, id)
  })
})
