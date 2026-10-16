// GET /api/briefing?afspraak=|taak=|account=: de briefing met soort, blokken (herkomst berekend, AI of
// eigen tekst) en drie regels. Werkt zonder AI-credits; elke ingang kiest dezelfde soort (gat 34).
// Met account= kan contact= mee (/briefings): dan staat de contactpersoon erbij (404 als hij niet bij het account hoort).
import { kan } from '../../utils/accounts'
import { briefing, contactBijBriefing } from '../../utils/briefing'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'briefing.lezen')
  const q = getQuery(event)
  const o = typeof q.afspraak === 'string' ? { soort: 'afspraak' as const, id: q.afspraak } : typeof q.taak === 'string' ? { soort: 'taak' as const, id: q.taak } : typeof q.account === 'string' ? { soort: 'account' as const, id: q.account } : null
  if (!o) throw createError({ statusCode: 400, statusMessage: 'Kies een afspraak, taak of account' })
  const contactId = o.soort === 'account' && typeof q.contact === 'string' && q.contact ? q.contact : null
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const b = await briefing(tx, o)
    const contact = contactId ? await contactBijBriefing(tx, o.id, contactId) : null
    if (contactId && !contact) throw createError({ statusCode: 404, statusMessage: 'Contact hoort niet bij dit account' })
    return { ...b, contact, kan: { bewerken: kan(ctx, 'briefing.bewerken'), vastzetten: kan(ctx, 'briefing.soortVastzetten'), pitstop: kan(ctx, 'pitstop.maken'), opnieuw: kan(ctx, 'pitstop.opnieuw') } }
  })
})
