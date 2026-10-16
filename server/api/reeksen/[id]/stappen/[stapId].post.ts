// POST /api/reeksen/:id/stappen/:stapId {actie: concept|verstuur|zelf-verstuurd|kopieer|overslaan, tekst?, onderwerp?}:
// een concept laten schrijven (Schrijver, credits), een mailconcept goedkeuren en versturen (langs de Bewaker),
// zelf verstuurd afvinken, een LinkedIn-tekst kopiëren en afvinken (nooit zelf verstuurd), of de stap overslaan.
import { metOrganisatie } from '../../../../utils/db'
import { stapActie } from '../../../../utils/opvolgreeks'
import { vereisFunctie } from '../../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.volgen')
  const b = await readBody<any>(event)
  const g = { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol, niveau: ctx.gebruiker.niveau, werkplek: ctx.gebruiker.werkplek, data: ctx.gebruiker.data }
  return metOrganisatie(ctx.organisatie.id, (tx) => stapActie(tx, ctx.organisatie.id, g, getRouterParam(event, 'id')!, getRouterParam(event, 'stapId')!, {
    actie: typeof b?.actie === 'string' ? b.actie : undefined, tekst: typeof b?.tekst === 'string' ? b.tekst : null, onderwerp: typeof b?.onderwerp === 'string' ? b.onderwerp : null,
  }, getRequestURL(event).origin))
})
