// PUT /api/accounts/:id/terug-op {datum, reden}: terugkomdatum aanpassen (Gevorderd).
import { metOrganisatie } from '../../../utils/db'
import { alsHttpFout, zetTerugOp } from '../../../utils/reis'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'account.terugOpAanpassen')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ datum?: string; reden?: string }>(event)
  return metOrganisatie(ctx.organisatie.id, (tx) => zetTerugOp(tx, id, String(b?.datum ?? ''), String(b?.reden ?? ''), ctx.gebruiker.id).catch(alsHttpFout))
})
