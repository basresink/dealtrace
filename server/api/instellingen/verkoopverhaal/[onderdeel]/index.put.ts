// PUT /api/instellingen/verkoopverhaal/:onderdeel: concept bewaren (automatisch per veld). 409 bij een
// gespiegeld onderdeel (P29); 422 bij meer dan drie winpunten op impact hoog.
import { ONDERDELEN, teveelHoog } from '../../../../../shared/verkoopverhaal'
import { metOrganisatie } from '../../../../utils/db'
import { bewaarConcept } from '../../../../utils/vvProjectie'
import { vereisFunctie } from '../../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'verkoopverhaal.inrichten')
  const onderdeel = ONDERDELEN.find((o) => o === getRouterParam(event, 'onderdeel'))
  if (!onderdeel) throw createError({ statusCode: 404, statusMessage: 'Onbekend onderdeel' })
  const concept = await readBody<any>(event)
  if (!concept || typeof concept !== 'object') throw createError({ statusCode: 422, statusMessage: 'Geen inhoud' })
  if (onderdeel === 'winpunten' && teveelHoog(concept)) throw createError({ statusCode: 422, statusMessage: 'Hooguit drie winpunten op impact hoog' })
  await metOrganisatie(ctx.organisatie.id, (tx) => bewaarConcept(tx, ctx.organisatie.id, onderdeel, concept))
  return { ok: true }
})
