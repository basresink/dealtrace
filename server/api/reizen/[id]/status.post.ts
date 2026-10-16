// POST /api/reizen/:id/status {status: 'gepauzeerd'|'actief'|'gearchiveerd', reden}: pauzeren, hervatten of archiveren.
import { metOrganisatie } from '../../../utils/db'
import { zetStatus } from '../../../utils/reisEditor'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'reizen.publiceren')
  const b = await readBody<{ status?: string; reden?: string }>(event)
  if (!['gepauzeerd', 'actief', 'gearchiveerd'].includes(b?.status ?? '')) throw createError({ statusCode: 422, statusMessage: 'Onbekende status' })
  return metOrganisatie(ctx.organisatie.id, (tx) => zetStatus(tx, ctx.organisatie.id, ctx.gebruiker.id, getRouterParam(event, 'id')!, b.status as any, b.reden ?? ''))
})
