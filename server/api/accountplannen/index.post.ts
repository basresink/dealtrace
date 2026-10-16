// POST /api/accountplannen {accountId, titel, geldigVan?, geldigTot?, secties?, contactIds?}: een nieuw plan.
import { maakAccountplan } from '../../utils/accountplannen'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.accountplannen')
  const b = await readBody<any>(event)
  return metOrganisatie(ctx.organisatie.id, (tx) => maakAccountplan(tx, ctx.organisatie.id, ctx.gebruiker, b ?? {}))
})
