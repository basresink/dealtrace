// POST /api/koppelingen/salesdna/sync {onderwerpId?}: volledige synchronisatie; 409 als er al een loopt.
import { metOrganisatie } from '../../../utils/db'
import { volledigeSync } from '../../../utils/salesdna'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'koppeling.salesdna')
  const b = await readBody<{ onderwerpId?: string }>(event).catch(() => ({} as { onderwerpId?: string }))
  return metOrganisatie(ctx.organisatie.id, (tx) => volledigeSync(tx, ctx.organisatie.id, b?.onderwerpId ?? null, 'verzoek'))
})
