// PUT /api/accountplannen/:id/acties/:taakId {klaar}: afvinken rondt de taak af, uitvinken zet hem weer open.
import { zetPlanActie } from '../../../../utils/accountplannen'
import { metOrganisatie } from '../../../../utils/db'
import { alsHttpFout } from '../../../../utils/reis'
import { vereisFunctie } from '../../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.accountplannen')
  const b = await readBody<{ klaar?: boolean }>(event)
  return metOrganisatie(ctx.organisatie.id, (tx) => zetPlanActie(tx, getRouterParam(event, 'id')!, getRouterParam(event, 'taakId')!, ctx.gebruiker, !!b?.klaar).catch(alsHttpFout))
})
