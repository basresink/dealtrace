// POST /api/dagplanning/plan: "Plan mijn dag nu". De Dagplanner deelt de rest van vandaag in en zet het
// in je agenda (ook na ongedaan maken of als hij eerder alleen een voorstel mocht), langs de Bewaker.
import { planMijnDag } from '../../utils/agents/dagplanner'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'dagritme.dagstart')
  if (ctx.werkIn) throw createError({ statusCode: 403, statusMessage: 'Je werkt in een organisatie: plannen doet de gebruiker zelf.' })
  const r = await metOrganisatie(ctx.organisatie!.id, (tx) => planMijnDag(tx, ctx.organisatie!.id, ctx.gebruiker.id, new Date(), 'handmatig'))
  if (r.status === 'geen-werkdag') throw createError({ statusCode: 422, statusMessage: 'Vandaag is geen werkdag' })
  if (r.status === 'geblokkeerd') throw createError({ statusCode: 409, statusMessage: `Tegengehouden door de Bewaker: ${r.reden}` })
  return r
})
