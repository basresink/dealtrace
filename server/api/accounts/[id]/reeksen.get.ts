// GET /api/accounts/:id/reeksen: de opvolgreeksen van deze prospect voor het venster Opvolgreeksen onder Meer op de
// accountkaart. De lopende reeks (stap x van y, volgende stap met datum, contact), de eerdere reeksen met hun uitkomst
// en of je hier een reeks mag starten (kan.starten, met de reden als het niet mag). De handelingen zelf gaan via de
// bestaande routes: GET en PUT /api/reeksen/:id, POST /api/reeksen/:id/stappen/:stapId en POST /api/volgen/:id/reeks.
import { metOrganisatie } from '../../../utils/db'
import { reeksenVanAccount } from '../../../utils/opvolgreeksOverzicht'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.opvolgreeksen')
  const g = { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol, niveau: ctx.gebruiker.niveau, werkplek: ctx.gebruiker.werkplek, data: ctx.gebruiker.data }
  return metOrganisatie(ctx.organisatie.id, (tx) => reeksenVanAccount(tx, ctx.organisatie.id, g, getRouterParam(event, 'id')!))
})
