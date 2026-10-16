// GET /api/documenten/:id/bestand: het bestand zelf, inline (voor de preview en Openen).
import { metOrganisatie } from '../../../utils/db'
import { documentBestand } from '../../../utils/kennisbank'
import { vereisDocumenten } from '../../../utils/kennisbankToegang'

export default defineEventHandler(async (event) => {
  const ctx = await vereisDocumenten(event)
  const id = getRouterParam(event, 'id')!
  const b = await metOrganisatie(ctx.organisatie.id, (tx) => documentBestand(tx, id))
  setHeader(event, 'content-type', b.mime)
  setHeader(event, 'content-disposition', `inline; filename*=UTF-8''${encodeURIComponent(b.naam)}`)
  setHeader(event, 'cache-control', 'private, max-age=300')
  setHeader(event, 'x-content-type-options', 'nosniff')
  return b.inhoud
})
