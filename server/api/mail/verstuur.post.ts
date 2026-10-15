// POST /api/mail/verstuur {conceptId}: een goedgekeurd mailconcept versturen via de mailkoppeling.
// 403 met de reden van de Bewaker of bij een afgemeld adres; 409 zonder mailkoppeling; 502 mailserver.
import { verstuurConcept } from '../../utils/briefing'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'mail.versturen')
  const b = await readBody<any>(event)
  if (!b?.conceptId) throw createError({ statusCode: 400, statusMessage: 'conceptId ontbreekt' })
  const basis = getRequestURL(event).origin
  return metOrganisatie(ctx.organisatie.id, (tx) => verstuurConcept(tx, ctx.organisatie.id, { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol, niveau: ctx.gebruiker.niveau, data: (ctx.gebruiker as any).data }, String(b.conceptId), basis))
})
