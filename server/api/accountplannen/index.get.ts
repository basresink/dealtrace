// GET /api/accountplannen?accountId=&van=mij: het overzicht (Actueel, Verlopen en afgerond) met account, eigenaar
// en de voortgang van het actieplan. Met accountId alleen de plannen van dat account (accountkaart); met van=mij
// alleen je eigen plannen.
import { accountplanLijst } from '../../utils/accountplannen'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.accountplannen')
  const q = getQuery(event)
  const accountId = typeof q.accountId === 'string' && q.accountId ? q.accountId : null
  return metOrganisatie(ctx.organisatie.id, (tx) => accountplanLijst(tx, { accountId, eigenaarId: q.van === 'mij' ? ctx.gebruiker.id : null }))
})
