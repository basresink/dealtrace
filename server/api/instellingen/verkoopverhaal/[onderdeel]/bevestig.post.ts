// POST /api/instellingen/verkoopverhaal/:onderdeel/bevestig: nieuwe versie met auditregel; 422 met de ontbrekende velden.
import { ONDERDELEN } from '../../../../../shared/verkoopverhaal'
import { metOrganisatie } from '../../../../utils/db'
import { bevestig } from '../../../../utils/vvProjectie'
import { vereisFunctie } from '../../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'verkoopverhaal.inrichten')
  const onderdeel = ONDERDELEN.find((o) => o === getRouterParam(event, 'onderdeel'))
  if (!onderdeel) throw createError({ statusCode: 404, statusMessage: 'Onbekend onderdeel' })
  return metOrganisatie(ctx.organisatie.id, (tx) => bevestig(tx, ctx.organisatie.id, onderdeel, ctx.gebruiker.id))
})
