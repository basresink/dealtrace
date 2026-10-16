// GET /api/accounts/nieuw-context: de keuzes voor de flyout "+ Prospect" (branches en concurrenten uit
// het verkoopverhaal, klassen, regio's, doelgroepen en de planning), zodat de flyout vooraf laat zien
// waar de nieuwe prospect in de matrix en de motor valt.
import { metOrganisatie } from '../../utils/db'
import { nieuwContext } from '../../utils/nieuweProspect'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.nieuw')
  return metOrganisatie(ctx.organisatie.id, (tx) => nieuwContext(tx, ctx))
})
