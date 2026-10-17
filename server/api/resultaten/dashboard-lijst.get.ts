// GET /api/resultaten/dashboard-lijst?blok=reis|uitkomst|dekking|status&sleutel=&periode=&van=&tot=: de
// prospects of pogingen achter een cel, balk of getal op Mijn dashboard, voor het venster. Dezelfde rechten
// als het blok: reis met funnel.eigen, dekking met funnel.filters; uitkomst en status voor iedereen met
// nav.resultaten. Altijd alleen je eigen prospects en pogingen.
import { kan } from '../../utils/accounts'
import { dashboardLijst } from '../../utils/dashboard'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.resultaten')
  const q = getQuery(event)
  const k = (f: string) => kan(ctx, f)
  const opties = { vergelijken: k('resultaten.trend'), dekking: k('funnel.filters'), funnel: k('funnel.eigen'), funnelDetails: k('funnel.filters') || k('funnel.team') }
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    try { return await dashboardLijst(tx, ctx.gebruiker.id, q, opties) } catch (e: any) {
      if (e?.statusCode) throw createError({ statusCode: e.statusCode, statusMessage: e.statusMessage })
      throw e
    }
  })
})
