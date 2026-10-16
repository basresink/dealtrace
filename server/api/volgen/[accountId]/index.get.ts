// GET /api/volgen/:accountId?contact=: de flyout Volgen (F2 en F7). De volgende beste stap met weging, twee
// alternatieven, het oordeel van de Bewaker en de herkomst; de opvolgreeks van het account (eerst bijgewerkt:
// stopregels en klaarzetten), de sjablonen en de mandaten die je mag kiezen. Met ?contact= gaat de stap over dat
// contact binnen zijn account (contactkaart).
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'
import { volgenVoor } from '../../../utils/volgen'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.volgen')
  const accountId = getRouterParam(event, 'accountId')!
  const contact = getQuery(event).contact
  const g = { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol, niveau: ctx.gebruiker.niveau, werkplek: ctx.gebruiker.werkplek, data: ctx.gebruiker.data }
  return metOrganisatie(ctx.organisatie.id, (tx) => volgenVoor(tx, ctx.organisatie.id, g, accountId, typeof contact === 'string' && contact ? contact : null, new Date(), getRequestURL(event).origin))
})
