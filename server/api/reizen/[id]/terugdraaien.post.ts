// POST /api/reizen/:id/terugdraaien {mapping?}: de vorige versie weer actief; 422 met de mapping die nodig is.
import { metOrganisatie } from '../../../utils/db'
import { terugdraaien } from '../../../utils/reisEditor'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'reizen.publiceren')
  const b = await readBody<{ mapping?: Record<string, string | null> }>(event).catch(() => ({} as any))
  return metOrganisatie(ctx.organisatie.id, (tx) => terugdraaien(tx, ctx.organisatie.id, ctx.gebruiker.id, getRouterParam(event, 'id')!, b?.mapping ?? {}))
})
