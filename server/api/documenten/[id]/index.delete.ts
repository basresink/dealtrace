// DELETE /api/documenten/:id: het document uit de kennisbank en van elke account- en contactkaart. Alleen wie
// het uploadde of de beheerder (403).
import { metOrganisatie } from '../../../utils/db'
import { verwijderDocument } from '../../../utils/kennisbank'
import { vereisDocumenten } from '../../../utils/kennisbankToegang'

export default defineEventHandler(async (event) => {
  const ctx = await vereisDocumenten(event)
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, (tx) => verwijderDocument(tx, ctx.organisatie.id, id, ctx.gebruiker))
})
