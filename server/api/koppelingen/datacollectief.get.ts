// GET /api/koppelingen/datacollectief: stand van de koppeling (status, tegoed, plafond, verbruik, laatste
// runs), nooit de sleutel. De beheerder richt in; vanaf Expert lezen wie de bron gebruikt.
import { kan } from '../../utils/accounts'
import { dcStatus } from '../../utils/bronnen/datacollectief'
import { metOrganisatie } from '../../utils/db'
import { vereisOrganisatie, weigerFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  if (!kan(ctx, 'koppeling.datacollectief') && !kan(ctx, 'leadgenerator.datacollectief') && !kan(ctx, 'nav.leadgenerator')) weigerFunctie('leadgenerator.datacollectief', 'niveau')
  return metOrganisatie(ctx.organisatie!.id, async (tx) => ({ ...(await dcStatus(tx, ctx.organisatie!.pakket)), magInrichten: kan(ctx, 'koppeling.datacollectief'), pakket: ctx.organisatie!.pakket }))
})
