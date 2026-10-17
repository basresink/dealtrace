// POST /api/reekssjablonen {naam, omschrijving?, na?, stappen[{dag, kanaal, titel, onderwerp?, instructie?}], einde{dag,
// wachtDagen}, uitkomsten[], stopregels{}, actief?}: een eigen sjabloon voor de organisatie (salesmanager en beheerder).
// 422 met alle redenen bij een onjuist sjabloon; 409 bij een dubbele naam.
import { metOrganisatie } from '../../utils/db'
import { bewaarSjabloon } from '../../utils/opvolgreeksOverzicht'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'instellingen.opvolgreeksen')
  const b = await readBody<any>(event)
  const g = { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol, niveau: ctx.gebruiker.niveau, werkplek: ctx.gebruiker.werkplek, data: ctx.gebruiker.data }
  return metOrganisatie(ctx.organisatie.id, (tx) => bewaarSjabloon(tx, ctx.organisatie.id, g, null, b ?? {}))
})
