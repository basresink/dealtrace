// GET /api/resultaten/mij: Mijn resultaten (P21). Eigen cijfers; vanaf Gevorderd trend en teamgemiddelde zonder
// namen van collega's; de afspraken en gedeelde coachingpunten. Nooit een privénotitie.
import { kan } from '../../utils/accounts'
import { mijnResultaten } from '../../utils/coaching'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.resultaten')
  const vergelijken = kan(ctx, 'resultaten.trend')
  return metOrganisatie(ctx.organisatie.id, async (tx) => ({ ...(await mijnResultaten(tx, { id: ctx.gebruiker.id }, { vergelijken })), kan: { trend: vergelijken, zelfanalyse: kan(ctx, 'resultaten.zelfanalyse') } }))
})
