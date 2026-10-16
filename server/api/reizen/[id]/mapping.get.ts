// GET /api/reizen/:id/mapping: per oude fase met accounts het aantal en een voorstel voor de nieuwe fase.
import { metOrganisatie } from '../../../utils/db'
import { bewerker } from '../../../utils/reisApi'
import { mappingVoor } from '../../../utils/reisEditor'
import { vereisOrganisatie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  bewerker(ctx)
  return metOrganisatie(ctx.organisatie!.id, (tx) => mappingVoor(tx, getRouterParam(event, 'id')!))
})
