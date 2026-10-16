// POST /api/reizen/:id/controleer: fouten, waarschuwingen en informatie, plus wat publiceren blokkeert.
import { valideerReis } from '../../../../shared/reis'
import { blokkeertPublicatie } from '../../../../shared/reisEditor'
import { metOrganisatie } from '../../../utils/db'
import { bewerker } from '../../../utils/reisApi'
import { laadReis } from '../../../utils/reisEditor'
import { vereisOrganisatie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  bewerker(ctx)
  return metOrganisatie(ctx.organisatie!.id, async (tx) => { const v = valideerReis((await laadReis(tx, getRouterParam(event, 'id')!)).data); return { ...v, blokkeert: blokkeertPublicatie(v) } })
})
