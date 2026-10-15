// GET /api/funnel?periode=&doelgroep=&reis=&reis2=&campagne=&gebruiker=&team=&kanaal=: de funnel van de
// prospectreis (F17). Beginner: aantallen en stokpunt; vanaf funnel.filters conversie, doorlooptijd,
// uitval en pogingen; reis2 zet een tweede funnel ernaast (Expert, minstens 20 accounts per reis).
import { kan } from '../../utils/accounts'
import { metOrganisatie } from '../../utils/db'
import { filtersUitQuery, laadFunnel } from '../../utils/funnel'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'funnel.eigen')
  const q = getQuery(event)
  const k = (f: string) => kan(ctx, f)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const { periode, f, reis2 } = await filtersUitQuery(tx, { gebruiker: ctx.gebruiker, kan: k }, q)
    if (reis2 && !k('funnel.vergelijken')) throw createError({ statusCode: 403, statusMessage: 'Functie niet beschikbaar', data: { functie: 'funnel.vergelijken', reden: 'niveau' } })
    const details = k('funnel.filters') || k('funnel.team')
    const hoofd = await laadFunnel(tx, f, { details })
    const tweede = reis2 ? await laadFunnel(tx, { ...f, reisId: reis2 }, { details }) : null
    return {
      periode: periode.label, ...hoofd,
      vergelijk: tweede ? { ...tweede, teWeinig: hoofd.aantalAccounts < 20 || tweede.aantalAccounts < 20 } : null,
      kan: { filters: k('funnel.filters'), vergelijken: k('funnel.vergelijken'), export: k('funnel.export') || k('funnel.team'), team: k('funnel.team') },
    }
  })
})
