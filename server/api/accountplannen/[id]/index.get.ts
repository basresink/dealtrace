// GET /api/accountplannen/:id: het plan met blokken, beslissers, acties (taken) en de contacten van het account.
import { accountplanDetail } from '../../../utils/accountplannen'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.accountplannen')
  return metOrganisatie(ctx.organisatie.id, (tx) => accountplanDetail(tx, getRouterParam(event, 'id')!, ctx.gebruiker))
})
