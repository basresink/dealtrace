// POST /api/accounts/:id/pauzeer {tot, reden?}: status wachtend tot een datum; de fase blijft.
import { metOrganisatie } from '../../../utils/db'
import { alsHttpFout, pauzeer } from '../../../utils/reis'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'account.nee')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ tot?: string; reden?: string }>(event)
  return metOrganisatie(ctx.organisatie.id, (tx) => pauzeer(tx, id, String(b?.tot ?? ''), b?.reden?.trim().slice(0, 300) || null, ctx.gebruiker.id).catch(alsHttpFout))
})
