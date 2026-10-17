// PUT /api/terug-in-beeld/:id/datum {datum, reden}: Later of Pas datum aan. Nooit binnen de afkoeling (de datum
// schuift dan naar het einde ervan); vraagt ook de functie Terugkomdatum aanpassen.
import { metOrganisatie } from '../../../utils/db'
import { alsHttpFout } from '../../../utils/reis'
import { vereisFunctie } from '../../../utils/sessie'
import { zetLater } from '../../../utils/terugInBeeld'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.terugInBeeld')
  await vereisFunctie(event, 'account.terugOpAanpassen')
  const b = await readBody<{ datum?: string; reden?: string }>(event)
  return metOrganisatie(ctx.organisatie.id, (tx) => zetLater(tx, ctx.gebruiker, getRouterParam(event, 'id')!, b ?? {}).catch(alsHttpFout))
})
