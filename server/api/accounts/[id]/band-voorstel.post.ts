// POST /api/accounts/:id/band-voorstel {letter, besluit: bevestig|bewerk|verwerp|ongedaan, ja?, toelichting?, bronId?}:
// het besluit over een BAND-voorstel uit een gespreksverslag. Nooit stil: alleen na een klik van de gebruiker.
// Eigenaar, zijn salesmanager of de beheerder; ook voorbij status nieuw. Alleen bij minimaal 3 van 4 en status nieuw
// meldt Dealtrace `gekwalificeerd`, zoals PUT /band.
import { besluitBandVoorstel, type BandBesluit } from '../../../utils/bandVoorstel'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'reis.kwalificeer')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<BandBesluit>(event)
  return metOrganisatie(ctx.organisatie.id, (tx) => besluitBandVoorstel(tx, ctx.organisatie.id, ctx.gebruiker, id, b ?? ({} as BandBesluit)))
})
