// POST /api/vandaag/signaal {signaalSleutel, besluit}: Gedaan, Later of Weg op het signaal van Vandaag.
// Hetzelfde pad als de sync-mutatie signaal.besluit; idempotent per gebruiker, signaal en dag.
import { metOrganisatie } from '../../utils/db'
import { besluit } from '../../utils/dagritme'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'vandaag.signaal')
  const b = await readBody<{ signaalSleutel?: string; besluit?: string }>(event)
  if (!b?.signaalSleutel || !['gedaan', 'later', 'weg'].includes(b.besluit ?? '')) throw createError({ statusCode: 422, statusMessage: 'Kies Gedaan, Later of Weg' })
  return metOrganisatie(ctx.organisatie.id, (tx) => besluit(tx, ctx.organisatie.id, ctx.gebruiker.id, String(b.signaalSleutel).slice(0, 200), b.besluit as 'gedaan'))
})
