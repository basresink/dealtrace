// GET /api/koppelingen/kvk: de stand van de KvK-koppeling, zonder de sleutel (12). Lezen voor
// wie de leadgenerator gebruikt; inrichten alleen de beheerder.
import { kan } from '../../utils/accounts'
import { metOrganisatie } from '../../utils/db'
import { kvkStatus } from '../../utils/bronnen/kvk'
import { vereisOrganisatie, weigerFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  if (!kan(ctx, 'koppeling.kvk') && !kan(ctx, 'nav.leadgenerator')) weigerFunctie('nav.leadgenerator', 'niveau')
  return metOrganisatie(ctx.organisatie!.id, async (tx) => ({ ...(await kvkStatus(tx, ctx.organisatie!.pakket)), magInrichten: kan(ctx, 'koppeling.kvk') }))
})
