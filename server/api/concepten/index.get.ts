// GET /api/concepten?type=&status=&agent=&zoek=&sinds=&account=&team=1&concept=: de concept-inbox (8.5.7).
// Eigen concepten; de salesmanager met team=1 ook die van zijn teams. Nieuwste eerst, hooguit 100.
// Status: leeg is open (klaar en goedgekeurd), anders klaar, goedgekeurd, verstuurd, afgewezen of alle.
// Elke rij draagt het account (naam, klant of prospect) en het contact (uit het concept, de taak, de
// afspraak of de beslisser). De tellers per soort, status en agent rekenen met de andere filters erop.
import { conceptenOverzicht } from '../../utils/briefing'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'concepten.inbox')
  const q = getQuery(event)
  const s = (v: unknown) => (typeof v === 'string' && v ? v.slice(0, 120) : null)
  const status = s(q.status) === 'verworpen' ? 'afgewezen' : s(q.status)
  return metOrganisatie(ctx.organisatie.id, (tx) => conceptenOverzicht(tx, ctx.gebruiker, {
    soort: s(q.type), status, agent: s(q.agent), zoek: s(q.zoek), sinds: s(q.sinds), accountId: s(q.account), team: q.team === '1', concept: s(q.concept),
  }))
})
