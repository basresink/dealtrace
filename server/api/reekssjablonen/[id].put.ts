// PUT /api/reekssjablonen/:id: een sjabloon wijzigen of (de)activeren ({actief}). Lopende reeksen houden de stappen
// waarmee ze startten; nieuwe reeksen krijgen het gewijzigde sjabloon.
import { metOrganisatie } from '../../utils/db'
import { bewaarSjabloon } from '../../utils/opvolgreeksOverzicht'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'instellingen.opvolgreeksen')
  const b = await readBody<any>(event)
  const g = { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol, niveau: ctx.gebruiker.niveau, werkplek: ctx.gebruiker.werkplek, data: ctx.gebruiker.data }
  return metOrganisatie(ctx.organisatie.id, (tx) => bewaarSjabloon(tx, ctx.organisatie.id, g, getRouterParam(event, 'id')!, b ?? {}))
})
