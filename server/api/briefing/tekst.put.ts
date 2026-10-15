// PUT /api/briefing/tekst {onderwerp, id, blok, tekst}: eigen tekst per blok (Gevorderd), bewaard per
// gesprek; leeg haalt hem weg. Blok _soort zet de soort vast (Expert).
import { BRIEFING_SOORTEN } from '../../../shared/briefing'
import { kan } from '../../utils/accounts'
import { bewaarTekst } from '../../utils/briefing'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'briefing.bewerken')
  const b = await readBody<any>(event)
  if (!['afspraak', 'taak'].includes(b?.onderwerp) || !b?.id || !b?.blok) throw createError({ statusCode: 400, statusMessage: 'Onderwerp, id en blok zijn verplicht' })
  if (b.blok === '_soort') {
    if (!kan(ctx, 'briefing.soortVastzetten')) throw createError({ statusCode: 403, statusMessage: 'Functie niet beschikbaar', data: { functie: 'briefing.soortVastzetten', reden: 'niveau' } })
    if (b.tekst && !BRIEFING_SOORTEN.includes(b.tekst)) throw createError({ statusCode: 400, statusMessage: 'Onbekende soort' })
  }
  return metOrganisatie(ctx.organisatie.id, (tx) => bewaarTekst(tx, ctx.organisatie.id, ctx.gebruiker.id, { soort: b.onderwerp, id: String(b.id) }, String(b.blok).slice(0, 40), String(b.tekst ?? '').slice(0, 2000)))
})
