// GET /api/briefing/zoek?q=: het ene zoekveld op /briefings. Prospects en klanten op naam en, met een zoekterm,
// contactpersonen op naam of functie, met het bedrijf en of het een prospect of klant is (hooguit 30).
import { briefingZoek } from '../../utils/briefing'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'briefing.lezen')
  const q = String(getQuery(event).q ?? '').slice(0, 80)
  return metOrganisatie(ctx.organisatie.id, (tx) => briefingZoek(tx, { id: ctx.gebruiker.id }, q))
})
