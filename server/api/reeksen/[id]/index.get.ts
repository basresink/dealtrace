// GET /api/reeksen/:id: de detailkolom van het overzicht. De reeks (eerst bijgewerkt) met stappen per dag, concepten
// en taken, het account, de mandaten die de eigenaar mag kiezen en wat jij mag (wijzigen; stappen afhandelen alleen
// als eigenaar). Een reeks van een collega buiten je team geeft 403.
import { metOrganisatie } from '../../../utils/db'
import { reeksDetail } from '../../../utils/opvolgreeksOverzicht'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.volgen')
  const g = { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol, niveau: ctx.gebruiker.niveau, werkplek: ctx.gebruiker.werkplek, data: ctx.gebruiker.data }
  return metOrganisatie(ctx.organisatie.id, (tx) => reeksDetail(tx, ctx.organisatie.id, g, getRouterParam(event, 'id')!))
})
