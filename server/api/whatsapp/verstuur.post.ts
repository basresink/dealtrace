// POST /api/whatsapp/verstuur {conceptId}: een goedgekeurd WhatsApp-concept via de provider. 403 met de reden
// van de Bewaker ("Geen consent voor WhatsApp") of van magWhatsapp; 409 zonder koppeling of sjabloon.
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'
import { verstuurWhatsapp } from '../../utils/whatsapp'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'whatsapp.versturen')
  const b = await readBody<any>(event)
  if (!b?.conceptId) throw createError({ statusCode: 400, statusMessage: 'conceptId ontbreekt' })
  const r = await metOrganisatie(ctx.organisatie.id, (tx) => verstuurWhatsapp(tx, ctx.organisatie.id, { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol, niveau: ctx.gebruiker.niveau, data: (ctx.gebruiker as any).data }, String(b.conceptId)))
  // De blokkade is gelogd (de transactie is doorgegaan); nu pas de 403 met de reden.
  if (r.status === 'geblokkeerd') throw createError({ statusCode: 403, statusMessage: r.tekst })
  return r
})
