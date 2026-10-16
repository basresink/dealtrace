// GET /api/weekreview?week=: de persoonlijke weekreview (F10) in vier kaarten. Zonder week de week van
// vandaag; op maandag en dinsdag de vorige als je hem verzette. Alleen je eigen cijfers.
import { metOrganisatie } from '../../utils/db'
import { laadWeekreview } from '../../utils/dagritmeWeek'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'dagritme.weekreview')
  const week = getQuery(event).week
  if (week !== undefined && (typeof week !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(week))) throw createError({ statusCode: 400, statusMessage: 'Ongeldige week' })
  return metOrganisatie(ctx.organisatie!.id, (tx) => laadWeekreview(tx, ctx.gebruiker.id, new Date(), { maandag: (week as string) ?? null }))
})
