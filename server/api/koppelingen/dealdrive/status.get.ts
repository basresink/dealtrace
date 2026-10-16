// GET /api/koppelingen/dealdrive/status: de stand van de DealDrive-koppeling (uit, mock of aan), de laatste
// overdracht, de mislukte overdrachten en het logboek (beheerder, founder). Nooit het geheim; de stand zet
// alleen de founder in Platformbeheer.
import { metOrganisatie } from '../../../utils/db'
import { dealdriveStatus } from '../../../utils/dealdrive'
import { vereisOrganisatie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  if (!['beheerder', 'founder'].includes(ctx.gebruiker.rol)) throw createError({ statusCode: 403, statusMessage: 'Alleen voor de beheerder' })
  return metOrganisatie(ctx.organisatie.id, (tx) => dealdriveStatus(tx))
})
