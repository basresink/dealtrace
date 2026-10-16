// POST /api/accounts/:id/bewijs {ja}: het antwoord op "Mag dit een bewijs worden?" na deal.gewonnen in
// DealDrive. Ja maakt een Concept voor de bundel naar SalesDNA (zonder namen); Nee sluit de vraag.
import { metOrganisatie } from '../../../utils/db'
import { magAccount } from '../../../utils/overdracht'
import { vereisFunctie } from '../../../utils/sessie'
import { beantwoordBewijs } from '../../../utils/suggesties'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'overdracht.bewijsVoorstel')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ ja?: boolean }>(event)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    if (!(await magAccount(tx, ctx.gebruiker, id))) throw createError({ statusCode: 403, statusMessage: 'Dit account is van een collega buiten je team' })
    return beantwoordBewijs(tx, ctx.organisatie.id, ctx.gebruiker, id, !!b?.ja)
  })
})
