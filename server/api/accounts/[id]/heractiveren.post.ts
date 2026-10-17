// POST /api/accounts/:id/heractiveren: een gedeactiveerde prospect doet weer mee (0064). Dezelfde rechten als
// deactiveren; campagnekaarten gaan terug naar hun kolom en een lopend hercontactritme loopt weer.
import { metOrganisatie } from '../../../utils/db'
import { alsHttp, heractiveer } from '../../../utils/deactiveren'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.deactiveren')
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, (tx) => heractiveer(tx, ctx.organisatie.id, ctx.gebruiker, id).catch(alsHttp))
})
