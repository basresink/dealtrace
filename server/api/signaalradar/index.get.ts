// GET /api/signaalradar?reikwijdte=mij|org: het raster branche maal signaalsoort over de laatste 30 dagen,
// vergeleken met normaal (gemiddelde van de zes perioden ervoor), met de golven (F5).
import { metOrganisatie } from '../../utils/db'
import { radarRaster } from '../../utils/signaalradar'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.signaalradar')
  const r = getQuery(event).reikwijdte === 'org' ? 'org' : 'mij'
  return metOrganisatie(ctx.organisatie!.id, (tx) => radarRaster(tx, ctx.gebruiker, r))
})
