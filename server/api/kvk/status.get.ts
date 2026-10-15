// GET /api/kvk/status: of "Zoek in KvK" kan (flyout Nieuwe prospect, globale zoek op de telefoon).
import { metOrganisatie } from '../../utils/db'
import { kvkStatus } from '../../utils/bronnen/kvk'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.nieuw')
  return metOrganisatie(ctx.organisatie!.id, async (tx) => ({ gekoppeld: (await kvkStatus(tx, ctx.organisatie!.pakket)).gekoppeld }))
})
