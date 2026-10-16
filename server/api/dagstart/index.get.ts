// GET /api/dagstart?dag=&modus=buiten|binnen&branche=: de dagplanner (F3). Afspraken vast, bezoeken op
// route, belblokken in het uur waarop de doelgroep het vaakst opneemt, voorbereiding en wat er schoof.
import { metOrganisatie } from '../../utils/db'
import { laadDagstart } from '../../utils/dagritmeWeek'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'dagritme.dagstart')
  const q = getQuery(event)
  if (q.dag !== undefined && (typeof q.dag !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(q.dag) || Number.isNaN(Date.parse(q.dag)))) throw createError({ statusCode: 400, statusMessage: 'Ongeldige datum' })
  if (q.modus !== undefined && !['buiten', 'binnen'].includes(String(q.modus))) throw createError({ statusCode: 400, statusMessage: 'Kies buiten of binnen' })
  return metOrganisatie(ctx.organisatie!.id, (tx) => laadDagstart(tx, ctx.gebruiker.id, new Date(), { dag: (q.dag as string) ?? null, modus: (q.modus as string) ?? null, branche: typeof q.branche === 'string' ? q.branche : null, org: ctx.organisatie!.id }))
})
