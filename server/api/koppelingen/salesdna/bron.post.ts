// POST /api/koppelingen/salesdna/bron {onderdeel, bron, controlelijstBevestigd, mapping?}: bron per onderdeel.
// 409 als SalesDNA voor dat onderdeel leeg is; 422 zonder bevestigde controlelijst.
import { ONDERDELEN } from '../../../../shared/verkoopverhaal'
import { metOrganisatie } from '../../../utils/db'
import { wordEigen, wordSalesdna } from '../../../utils/salesdna'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'koppeling.salesdna.bronPerOnderdeel')
  const b = await readBody<{ onderdeel?: string; bron?: string; controlelijstBevestigd?: boolean; mapping?: Record<string, string | null> }>(event)
  const onderdeel = ONDERDELEN.find((o) => o === b?.onderdeel)
  if (!onderdeel || !['eigen', 'salesdna'].includes(b?.bron ?? '')) throw createError({ statusCode: 422, statusMessage: 'Kies een onderdeel en een bron' })
  return metOrganisatie(ctx.organisatie.id, (tx) => b.bron === 'salesdna'
    ? wordSalesdna(tx, ctx.organisatie.id, onderdeel, { controlelijstBevestigd: !!b.controlelijstBevestigd, mapping: b.mapping }, ctx.gebruiker.id)
    : wordEigen(tx, ctx.organisatie.id, onderdeel, ctx.gebruiker.id))
})
