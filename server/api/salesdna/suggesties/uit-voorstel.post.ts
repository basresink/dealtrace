// POST /api/salesdna/suggesties/uit-voorstel {voorstelId}: een voorstel van een Expert gaat via de
// salesmanager als Concept de bundel in (F25 "Per niveau"); nooit direct naar SalesDNA.
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'
import { voorstelNaarBundel } from '../../../utils/suggesties'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'salesdna.suggesties.vrijgeven')
  const b = await readBody<{ voorstelId?: string }>(event)
  if (!b?.voorstelId) throw createError({ statusCode: 422, statusMessage: 'Kies een voorstel' })
  return metOrganisatie(ctx.organisatie.id, (tx) => voorstelNaarBundel(tx, ctx.organisatie.id, ctx.gebruiker, b.voorstelId!))
})
