// Spiegel voor de beheerder (F23). De founder die in de organisatie werkt, mag
// hier niets beslissen over zijn eigen toegang.
import type { H3Event } from 'h3'
import { vereisFunctie } from './sessie'

export async function vereisBeheerder(event: H3Event, functie: string, opties: { nietDoorLeverancier?: boolean } = {}) {
  const ctx = await vereisFunctie(event, functie)
  if (opties.nietDoorLeverancier && ctx.werkIn) throw createError({ statusCode: 403, statusMessage: 'Dit beslist de beheerder van de klant zelf' })
  return ctx
}
