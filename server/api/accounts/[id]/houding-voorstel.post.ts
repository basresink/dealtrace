// POST /api/accounts/:id/houding-voorstel: de Notulist leest de gespreksverslagen en stelt per contact een
// houding voor met een citaat (F8). Het blijft een voorstel op het contact; de mens bevestigt het op de
// invloedskaart. Eerst de Bewaker; 5 credits (notulist).
import { stelHoudingVoor } from '../../../utils/agents/houding'
import { metOrganisatie } from '../../../utils/db'
import { magAccount } from '../../../utils/overdracht'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'contacten.basis')
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    if (!(await magAccount(tx, ctx.gebruiker, id))) throw createError({ statusCode: 403, statusMessage: 'Dit account is niet van jou' })
    return stelHoudingVoor(tx, ctx.organisatie.id, { id: ctx.gebruiker.id, niveau: ctx.gebruiker.niveau, data: ctx.gebruiker.data }, id)
  })
})
