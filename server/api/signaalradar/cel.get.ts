// GET /api/signaalradar/cel?reikwijdte=&branche=&soort=: een cel van de radar met de accounts, waarom het
// wel of geen golf is, het winpunt dat past, de capaciteit in je komende belblokken en wat je ermee kunt.
import { kan } from '../../utils/accounts'
import { metOrganisatie } from '../../utils/db'
import { leesRadarCel, radarCel } from '../../utils/signaalradar'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.signaalradar')
  const p = leesRadarCel(getQuery(event))
  return metOrganisatie(ctx.organisatie!.id, (tx) => radarCel(tx, ctx.gebruiker, p, { belronde: kan(ctx, 'campagnes.maken'), belblok: kan(ctx, 'belblok.uitvoeren') }))
})
