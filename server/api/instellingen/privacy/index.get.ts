// GET /api/instellingen/privacy: bewaartermijnen, wat er bij de volgende opschoning zou vervallen en de export.
// Alleen de beheerder.
import { metOrganisatie } from '../../../utils/db'
import { vereisPrivacyBeheer } from '../../../utils/privacy'
import { privacyOverzicht } from '../../../utils/privacyApi'
import { vereisOrganisatie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  vereisPrivacyBeheer(ctx)
  return metOrganisatie(ctx.organisatie.id, (tx) => privacyOverzicht(tx, ctx.organisatie.id))
})
