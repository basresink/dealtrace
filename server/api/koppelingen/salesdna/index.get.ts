// GET /api/koppelingen/salesdna: status, onderdelen met bron en spiegel, logboek (50). Beheerder; nooit het geheim.
import { metOrganisatie } from '../../../utils/db'
import { status } from '../../../utils/salesdna'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'koppeling.salesdna')
  const s = await metOrganisatie(ctx.organisatie.id, (tx) => status(tx, ctx.organisatie.id))
  return { ...s, webhookPad: s.koppeling ? `/api/koppelingen/salesdna/webhook/${s.koppeling.id}` : null }
})
