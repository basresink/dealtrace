// POST /api/instellingen/niveaus/standaard: terug naar de standaard van Dealtrace. Alle keuzes van de
// beheerder vervallen; auditregel instelling.functiesStandaard met de keuzes van daarvoor.
import { metOrganisatie } from '../../../utils/db'
import { vereisBeheerder } from '../../../utils/beheerder'
import { keuzesNaarStandaard } from '../../../utils/functieKeuzes'
import { vergeetOrganisaties } from '../../../utils/kortGeheugen'

export default defineEventHandler(async (event) => {
  event.node.res.once('finish', vergeetOrganisaties)
  const ctx = await vereisBeheerder(event, 'niveaus.iedereenAlles')
  return metOrganisatie(ctx.organisatie.id, (tx) => keuzesNaarStandaard(tx, ctx))
})
