// GET /api/funnel/accounts?fase=&reden=&...filters: de accounts achter een fase of uitvalreden, met fase
// sinds, laatste poging en volgende stap (oudste eerst).
import { FUNNEL_FASES, type FunnelFase } from '../../../shared/funnel'
import { kan } from '../../utils/accounts'
import { metOrganisatie } from '../../utils/db'
import { filtersUitQuery, funnelAccounts } from '../../utils/funnel'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'funnel.eigen')
  const q = getQuery(event)
  if (!FUNNEL_FASES.includes(q.fase as FunnelFase)) throw createError({ statusCode: 400, statusMessage: 'Onbekende fase' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const { f } = await filtersUitQuery(tx, { gebruiker: ctx.gebruiker, kan: (x) => kan(ctx, x) }, q)
    return { accounts: await funnelAccounts(tx, f, q.fase as FunnelFase, typeof q.reden === 'string' && q.reden ? q.reden : null) }
  })
})
