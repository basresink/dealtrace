// GET /api/settings: alle instellingen van de organisatie behalve VERBORGEN_KEYS.
import { isVerborgen } from '../../../shared/settingKeys'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisOrganisatie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const { organisatie } = await vereisOrganisatie(event)
  const rijen = await metOrganisatie(organisatie.id, (tx) => tx.select().from(schema.orgSettings))
  const uit: Record<string, unknown> = {}
  for (const r of rijen) if (!isVerborgen(r.key)) uit[r.key] = r.value
  return uit
})
