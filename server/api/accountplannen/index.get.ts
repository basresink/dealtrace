// GET /api/accountplannen?accountId=: het overzicht (Actueel, Verlopen en afgerond) met account, eigenaar en
// de voortgang van het actieplan. Met accountId alleen de plannen van dat account (accountkaart).
import { accountplanLijst } from '../../utils/accountplannen'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.accountplannen')
  const accountId = getQuery(event).accountId
  return metOrganisatie(ctx.organisatie.id, (tx) => accountplanLijst(tx, { accountId: typeof accountId === 'string' && accountId ? accountId : null }))
})
