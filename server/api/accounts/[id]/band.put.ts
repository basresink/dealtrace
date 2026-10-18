// PUT /api/accounts/:id/band {letter, ja, bron?}: één BAND-letter zetten. BAND bewerken mag de eigenaar, zijn
// salesmanager of de beheerder, ook voorbij status nieuw. Alleen bij status nieuw meldt minimaal 3 van 4
// `gekwalificeerd` (zoals de knop Kwalificeer); daarna is bijwerken geen gebeurtenis in de reis.
import { zetBandLetter } from '../../../utils/bandVoorstel'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'reis.kwalificeer')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ letter?: string; ja?: boolean; bron?: string }>(event)
  return metOrganisatie(ctx.organisatie.id, (tx) => zetBandLetter(tx, ctx.gebruiker, id, b ?? {}))
})
