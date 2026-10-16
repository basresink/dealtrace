// POST /api/reizen/:id/publicatie-aanvragen: "Vraag publicatie aan" (Expert): een taak voor de salesmanager.
import { metOrganisatie } from '../../../utils/db'
import { bewerker } from '../../../utils/reisApi'
import { vraagPublicatieAan } from '../../../utils/reisEditor'
import { vereisOrganisatie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  const g = bewerker(ctx)
  return metOrganisatie(ctx.organisatie!.id, (tx) => vraagPublicatieAan(tx, ctx.organisatie!.id, g, getRouterParam(event, 'id')!))
})
