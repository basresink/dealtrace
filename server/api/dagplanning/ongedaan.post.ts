// POST /api/dagplanning/ongedaan {sleutel?}: maak één blok van de Dagplanner ongedaan, of zonder sleutel
// de hele dag. Belacties gaan terug naar je lijst met hun oude datum, een voorbereiding of nieuwe kans
// wordt geannuleerd, een bestaande bezoektaak krijgt haar oude datum terug. Wat al begon, blijft.
import { maakOngedaan } from '../../utils/dagplanning'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'dagritme.dagstart')
  if (ctx.werkIn) throw createError({ statusCode: 403, statusMessage: 'Je werkt in een organisatie: ongedaan maken doet de gebruiker zelf.' })
  const b = await readBody<{ sleutel?: unknown }>(event).catch(() => ({} as { sleutel?: unknown }))
  const sleutel = typeof b?.sleutel === 'string' && b.sleutel ? b.sleutel.slice(0, 120) : null
  return metOrganisatie(ctx.organisatie!.id, (tx) => maakOngedaan(tx, ctx.organisatie!.id, ctx.gebruiker.id, sleutel, new Date()))
})
