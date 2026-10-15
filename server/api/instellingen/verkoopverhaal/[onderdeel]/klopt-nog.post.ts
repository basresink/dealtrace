// POST /api/instellingen/verkoopverhaal/:onderdeel/klopt-nog: het label "Controleren" weg zonder nieuwe versie.
import { ONDERDELEN } from '../../../../../shared/verkoopverhaal'
import { metOrganisatie } from '../../../../utils/db'
import { kloptNog } from '../../../../utils/vvProjectie'
import { vereisFunctie } from '../../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'verkoopverhaal.inrichten')
  const onderdeel = ONDERDELEN.find((o) => o === getRouterParam(event, 'onderdeel'))
  if (!onderdeel) throw createError({ statusCode: 404, statusMessage: 'Onbekend onderdeel' })
  await metOrganisatie(ctx.organisatie.id, (tx) => kloptNog(tx, ctx.organisatie.id, onderdeel, ctx.gebruiker.id))
  return { ok: true }
})
