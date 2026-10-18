// PUT /api/instellingen/niveaus/functie {functie, niveau, aan}: de beheerder zet één functie voor één niveau
// aan of uit, voor de hele organisatie. 422 buiten het pakket of voor een rolfunctie, 409 als Dealtrace hem
// uitzette. Auditregel instelling.functieAan of instelling.functieUit. Antwoord: het nieuwe overzicht.
import { metOrganisatie } from '../../../utils/db'
import { vereisBeheerder } from '../../../utils/beheerder'
import { zetFunctieKeuze } from '../../../utils/functieKeuzes'
import { vergeetOrganisaties } from '../../../utils/kortGeheugen'

export default defineEventHandler(async (event) => {
  event.node.res.once('finish', vergeetOrganisaties)
  const ctx = await vereisBeheerder(event, 'niveaus.iedereenAlles')
  const b = await readBody<{ functie?: unknown; niveau?: unknown; aan?: unknown }>(event)
  return metOrganisatie(ctx.organisatie.id, (tx) => zetFunctieKeuze(tx, ctx, b ?? {}))
})
