// GET /api/resultaten/dashboard?periode=week|maand|kwartaal|eigen&van=&tot=: Mijn dashboard in de opzet van
// DealDrive /rapportage. Altijd de eigen cijfers (nav.resultaten); vanaf resultaten.trend het teamgemiddelde
// zonder namen en de weektabel, met funnel.filters de prospectdekking, met funnel.eigen de reisfases.
// Nooit een privénotitie van de salesmanager.
import { kan } from '../../utils/accounts'
import { mijnDashboard } from '../../utils/dashboard'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.resultaten')
  const q = getQuery(event)
  const k = (f: string) => kan(ctx, f)
  const opties = { vergelijken: k('resultaten.trend'), dekking: k('funnel.filters'), funnel: k('funnel.eigen'), funnelDetails: k('funnel.filters') || k('funnel.team') }
  return metOrganisatie(ctx.organisatie.id, async (tx) => ({
    ...(await mijnDashboard(tx, ctx.gebruiker.id, q, opties)),
    kan: { trend: opties.vergelijken, zelfanalyse: k('resultaten.zelfanalyse'), dekking: opties.dekking, funnel: opties.funnel, funnelDetails: opties.funnelDetails, data: k('data.kwaliteit') },
  }))
})
