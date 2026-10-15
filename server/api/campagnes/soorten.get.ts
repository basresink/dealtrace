// GET /api/campagnes/soorten: alle campagnesoorten met aan of uit (beheerder).
import { soorten } from '../../utils/campagnes'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'instellingen.campagnesoorten')
  return metOrganisatie(ctx.organisatie.id, async (tx) => ({ soorten: await soorten(tx) }))
})
