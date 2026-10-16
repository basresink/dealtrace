// GET /api/documenten/:id: het document voor de flyout (velden, koppelingen, uitgelezen tekst en of je het mag
// verwijderen).
import { metOrganisatie } from '../../../utils/db'
import { documentDetail } from '../../../utils/kennisbank'
import { vereisDocumenten } from '../../../utils/kennisbankToegang'

export default defineEventHandler(async (event) => {
  const ctx = await vereisDocumenten(event)
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, (tx) => documentDetail(tx, id, ctx.gebruiker))
})
