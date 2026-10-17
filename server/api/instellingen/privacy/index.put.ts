// PUT /api/instellingen/privacy {termijnen}: de bewaartermijnen per soort (maanden of null). 422 bij een keuze
// die niet bestaat; elke wijziging is een auditregel. Alleen de beheerder.
import { metOrganisatie } from '../../../utils/db'
import { bewaarTermijnen, vereisPrivacyBeheer } from '../../../utils/privacy'
import { privacyOverzicht } from '../../../utils/privacyApi'
import { vereisOrganisatie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  vereisPrivacyBeheer(ctx)
  const b = await readBody<{ termijnen?: unknown }>(event).catch(() => null)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    await bewaarTermijnen(tx, ctx.organisatie.id, ctx.gebruiker.id, b?.termijnen)
    return privacyOverzicht(tx, ctx.organisatie.id)
  })
})
