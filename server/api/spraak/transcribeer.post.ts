// POST /api/spraak/transcribeer {bijlageId}: de mock van de transcriptie (P30). De echte transcriptie
// op de server bouwt P31; tot dan komt er een vaste tekst terug met het label "voorbeeld".
import { vereisOrganisatie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  await vereisOrganisatie(event)
  const b = await readBody<{ bijlageId?: string }>(event)
  if (!b?.bijlageId) throw createError({ statusCode: 400, statusMessage: 'Geen opname' })
  return { tekst: 'Goed gesprek gehad. Ze willen een vervolg. Actiepunt: offerte via DealDrive voorbereiden.', mock: true }
})
