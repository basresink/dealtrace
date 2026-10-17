// PUT /api/accounts/:id/prospect-status {status: koud|lauw|warm|heet|null}: de status van een prospect,
// gekozen in het Info-venster van de accountkaart. Eigenaar, zijn salesmanager of de beheerder; met audit.
import { metOrganisatie } from '../../../utils/db'
import { statusAlsHttp, zetProspectStatus } from '../../../utils/prospectStatus'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.kaart')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ status?: unknown }>(event).catch(() => null)
  if (!b || !('status' in b)) throw createError({ statusCode: 422, statusMessage: 'Geef een status mee (of null om te wissen)' })
  return metOrganisatie(ctx.organisatie.id, (tx) => zetProspectStatus(tx, ctx.organisatie.id, ctx.gebruiker, id, b.status).catch(statusAlsHttp))
})
