// GET /api/whatsapp/stand?accountId=: of "Verstuur via WhatsApp" kan (koppeling, sjabloon, mobiel, toestemming).
import { metOrganisatie } from '../../utils/db'
import { vereisOrganisatie } from '../../utils/sessie'
import { waStand } from '../../utils/whatsapp'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  const accountId = typeof getQuery(event).accountId === 'string' ? String(getQuery(event).accountId) : null
  return metOrganisatie(ctx.organisatie.id, (tx) => waStand(tx, accountId))
})
