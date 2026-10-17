// PUT /api/instellingen/terugkomen/redenen {bronSoort, reden, terugkomregelId}: één verliesreden naar een regel
// (of null: geen regel, dan geldt de afkoeling van bellen). Alleen de beheerder. Wachtende prospects verschuiven.
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'
import { bewaarReden, terugkomWijzigingUitBody } from '../../../utils/terugkomBeheer'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'verkoopverhaal.mappings')
  const w = terugkomWijzigingUitBody({ reden: await readBody<any>(event) })
  if (!w.reden) throw createError({ statusCode: 422, statusMessage: 'Kies een bron en een reden' })
  return metOrganisatie(ctx.organisatie.id, (tx) => bewaarReden(tx, ctx.organisatie.id, ctx.gebruiker.id, w.reden!))
})
