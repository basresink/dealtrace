// POST /api/reizen/:id/publiceer {mapping}: salesmanager en beheerder (403 reden rol voor een Expert-accountmanager).
// 422 bij blokkerende fouten of een onvolledige mapping.
import { metOrganisatie } from '../../../utils/db'
import { publiceer } from '../../../utils/reisEditor'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'reizen.publiceren')
  const b = await readBody<{ mapping?: Record<string, string | null> }>(event).catch(() => ({} as any))
  return metOrganisatie(ctx.organisatie.id, (tx) => publiceer(tx, ctx.organisatie.id, ctx.gebruiker.id, getRouterParam(event, 'id')!, b?.mapping ?? {}))
})
