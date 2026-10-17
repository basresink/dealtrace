// GET /api/accountplannen/:id: het plan met blokken, contactpersonen (met rol), acties (taken), notities, eigen
// velden, de open taken en afspraken van het account en wie eigenaar kan worden.
import { effectiefNiveau } from '../../../utils/accounts'
import { accountplanDetail } from '../../../utils/accountplannen'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.accountplannen')
  return metOrganisatie(ctx.organisatie.id, (tx) => accountplanDetail(tx, getRouterParam(event, 'id')!, { ...ctx.gebruiker, niveau: effectiefNiveau(ctx) }))
})
