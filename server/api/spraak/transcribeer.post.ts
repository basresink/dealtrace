// POST /api/spraak/transcribeer {bijlageId}: een opname omzetten naar tekst bij een EU-dienst
// (P31). 413 boven 15 minuten, 502 bij een fout van de dienst; credits op: de opname wacht.
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'
import { transcribeer } from '../../utils/transcriptie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'spraak.inspreken')
  const b = await readBody<{ bijlageId?: string }>(event)
  if (!b?.bijlageId) throw createError({ statusCode: 400, statusMessage: 'Geen opname' })
  return metOrganisatie(ctx.organisatie.id, (tx) => transcribeer(tx, ctx.organisatie.id, ctx.gebruiker.id, b.bijlageId!))
})
