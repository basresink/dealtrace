// GET /api/zoeken?q=: globale zoek (6.3). In P01 doorzoek je gebruikers en de
// zijbalkitems; latere prompts melden hun soort aan in server/utils/zoekbronnen.ts.
import { zoekBronnen } from '../utils/zoekbronnen'
import { vereisOrganisatie } from '../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  const q = String(getQuery(event).q ?? '').trim()
  if (q.length < 1) return { groepen: [] }
  const groepen = []
  for (const bron of zoekBronnen) {
    const rijen = await bron.zoek(q, ctx)
    if (rijen.length) groepen.push({ soort: bron.soort, label: bron.label, rijen: rijen.slice(0, 8), totaal: rijen.length })
  }
  return { groepen }
})
