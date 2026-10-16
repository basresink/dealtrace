// POST /api/signaalradar/belblok { reikwijdte, branche, soort }: Zet in belblok. Je eigen accounts uit de
// golf gaan in je volgende vaste belblok voor koude acquisitie; wat niet past, in het blok daarna.
import { metOrganisatie } from '../../utils/db'
import { leesRadarCel, radarInBelblok } from '../../utils/signaalradar'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.signaalradar')
  await vereisFunctie(event, 'belblok.uitvoeren')
  const p = leesRadarCel((await readBody<any>(event)) ?? {})
  return metOrganisatie(ctx.organisatie!.id, (tx) => radarInBelblok(tx, ctx.organisatie!.id, ctx.gebruiker, p))
})
