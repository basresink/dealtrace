// GET /api/accountplannen/opties?accountId=: wat het aanmaakformulier nodig heeft. Wie je eigenaar mag maken
// (jezelf, je teamleden als salesmanager, iedereen als beheerder), de eigen velden van een accountplan en, met
// een prospect, de contactpersonen met rol en de waarschuwing als er al een actueel plan loopt.
import { accountplanOpties } from '../../utils/accountplannen'
import { effectiefNiveau } from '../../utils/accounts'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.accountplannen')
  const accountId = getQuery(event).accountId
  return metOrganisatie(ctx.organisatie.id, (tx) => accountplanOpties(tx, { ...ctx.gebruiker, niveau: effectiefNiveau(ctx) }, typeof accountId === 'string' && accountId ? accountId : null))
})
