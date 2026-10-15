// POST /api/campagnes/:id/taken {itemIds?}: "Zet om naar taken" en "Verdeel over belblokken". Maakt
// taken voor items zonder open taak, gespreid over de koude belblokken of de regiodagen.
import { laad, magWijzigen, maakTaken } from '../../../utils/campagnes'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'campagnes.maken')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<any>(event).catch(() => ({}))
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    if (!(await magWijzigen(tx, ctx.gebruiker, await laad(tx, id)))) throw createError({ statusCode: 403, statusMessage: 'Alleen de eigenaar of de salesmanager maakt taken voor deze campagne' })
    return maakTaken(tx, ctx.organisatie.id, id, Array.isArray(b?.itemIds) ? b.itemIds.map(String) : null)
  })
})
