// GET /api/accounts/:id/band-voorstel: per BAND-letter een voorstel uit de analyses van de gespreksverslagen
// (Notulist), met citaat en herkomst. Letters die al zijn ingevuld krijgen geen voorstel.
import { leesBandVoorstellen } from '../../../utils/bandVoorstel'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.kaart')
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, (tx) => leesBandVoorstellen(tx, id))
})
