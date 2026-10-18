// POST /api/accounts/:id/band-ai: "Vul in met AI" in het venster Kwalificatie. De AI leest de gespreksverslagen van
// deze prospect (taken, afspraken, transcripten, samenvattingen van de Notulist) en zet per BAND-onderdeel een
// voorstel met citaat en bron klaar. Er wordt niets ingevuld: de gebruiker beslist per onderdeel via
// POST /band-voorstel. Eigenaar, zijn salesmanager of de beheerder, ook voorbij status nieuw. Via de AI-schil met credits (soort bandInvulling); 402 zonder credits, 422 zonder verslagen.
import { bandMetAi, vereisBandRecht } from '../../../utils/bandVoorstel'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'reis.kwalificeer')
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    await vereisBandRecht(tx, ctx.gebruiker, id)
    return bandMetAi(tx, ctx.organisatie.id, { id: ctx.gebruiker.id, niveau: ctx.gebruiker.niveau, data: ctx.gebruiker.data }, id)
  })
})
