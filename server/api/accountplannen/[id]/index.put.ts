// PUT /api/accountplannen/:id {titel?, geldigVan?, geldigTot?, status?, secties?, contactIds?}: wijzigen,
// afronden of heropenen. Een leeg blok wist dat blok.
import { wijzig } from '../../../utils/accountplannen'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.accountplannen')
  const b = await readBody<any>(event)
  return metOrganisatie(ctx.organisatie.id, (tx) => wijzig(tx, ctx.organisatie.id, getRouterParam(event, 'id')!, ctx.gebruiker, b ?? {}))
})
