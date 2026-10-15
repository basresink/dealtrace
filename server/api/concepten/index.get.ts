// GET /api/concepten?status=&type=&account=&team=1: de concept-inbox (8.5.7). Eigen concepten; de
// salesmanager met team=1 ook die van zijn teams. Nieuwste eerst.
import { concepten } from '../../utils/briefing'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'concepten.inbox')
  const q = getQuery(event)
  const s = (v: unknown) => (typeof v === 'string' && v ? v : null)
  return metOrganisatie(ctx.organisatie.id, async (tx) => ({ concepten: await concepten(tx, ctx.gebruiker, { status: s(q.status), type: s(q.type), accountId: s(q.account), team: q.team === '1' }) }))
})
