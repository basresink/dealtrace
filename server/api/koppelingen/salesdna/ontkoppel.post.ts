// POST /api/koppelingen/salesdna/ontkoppel: de laatst bevestigde spiegel wordt de eigen inrichting (herkomst salesdna).
import { metOrganisatie } from '../../../utils/db'
import { ontkoppel } from '../../../utils/salesdna'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'koppeling.salesdna')
  await metOrganisatie(ctx.organisatie.id, (tx) => ontkoppel(tx, ctx.organisatie.id, ctx.gebruiker.id))
  return { ok: true }
})
