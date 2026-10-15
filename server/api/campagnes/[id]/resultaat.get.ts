// GET /api/campagnes/:id/resultaat: bereikt, gesprekken, afspraken gepland en gehouden, overgedragen,
// conversie en winpunt uitgevoerd. Geen deals of pipelinewaarde (B17).
import { laad, resultaat } from '../../../utils/campagnes'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'campagnes.meedoen')
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const c = await laad(tx, id)
    return c.status === 'afgerond' && c.data?.resultaat ? c.data.resultaat : resultaat(tx, id)
  })
})
