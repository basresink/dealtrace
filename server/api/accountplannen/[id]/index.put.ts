// PUT /api/accountplannen/:id {titel?, eigenaarId?, geldigVan?, geldigTot?, status?, secties?, contactIds?, velden?}:
// wijzigen, afronden of heropenen. Een leeg blok of een lege veldwaarde wist.
import { effectiefNiveau } from '../../../utils/accounts'
import { wijzigAccountplan } from '../../../utils/accountplannen'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.accountplannen')
  const b = await readBody<any>(event)
  return metOrganisatie(ctx.organisatie.id, (tx) => wijzigAccountplan(tx, ctx.organisatie.id, getRouterParam(event, 'id')!, { ...ctx.gebruiker, niveau: effectiefNiveau(ctx) }, b ?? {}))
})
