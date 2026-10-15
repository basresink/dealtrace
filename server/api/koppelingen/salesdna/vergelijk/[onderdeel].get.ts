// GET /api/koppelingen/salesdna/vergelijk/:onderdeel: eigen inrichting naast de spiegel, met de controlelijst.
import { ONDERDELEN } from '../../../../../shared/verkoopverhaal'
import { metOrganisatie } from '../../../../utils/db'
import { vergelijk } from '../../../../utils/salesdna'
import { vereisFunctie } from '../../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'koppeling.salesdna.bronPerOnderdeel')
  const onderdeel = ONDERDELEN.find((o) => o === getRouterParam(event, 'onderdeel'))
  if (!onderdeel) throw createError({ statusCode: 404, statusMessage: 'Onbekend onderdeel' })
  return metOrganisatie(ctx.organisatie.id, (tx) => vergelijk(tx, ctx.organisatie.id, onderdeel))
})
