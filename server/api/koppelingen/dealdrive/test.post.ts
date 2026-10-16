// POST /api/koppelingen/dealdrive/test: Test verbinding (GET /ping bij DealDrive) voor de beheerder en de founder.
import { metOrganisatie } from '../../../utils/db'
import { testDealdrive } from '../../../utils/dealdrive'
import { vereisOrganisatie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  if (!['beheerder', 'founder'].includes(ctx.gebruiker.rol)) throw createError({ statusCode: 403, statusMessage: 'Alleen voor de beheerder' })
  return metOrganisatie(ctx.organisatie.id, (tx) => testDealdrive(tx, ctx.organisatie.id))
})
