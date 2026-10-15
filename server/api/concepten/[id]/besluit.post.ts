// POST /api/concepten/:id/besluit {besluit: goedkeuren|verwerpen, tekst?, onderwerp?}: met de overname
// (ongewijzigd, aangepast, verworpen). 409 als er al anders besloten is. Ook via de wachtrij (concept.besluit).
import { besluit } from '../../../utils/briefing'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'concepten.inbox')
  const b = await readBody<any>(event)
  if (!['goedkeuren', 'verwerpen'].includes(b?.besluit)) throw createError({ statusCode: 400, statusMessage: 'Kies goedkeuren of verwerpen' })
  return metOrganisatie(ctx.organisatie.id, (tx) => besluit(tx, ctx.gebruiker, getRouterParam(event, 'id')!, { besluit: b.besluit, tekst: typeof b.tekst === 'string' ? b.tekst : null, onderwerp: typeof b.onderwerp === 'string' ? b.onderwerp : null }))
})
