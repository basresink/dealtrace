// POST /api/koppelingen/salesdna/koppel {endpoint, geheim}: test, bewaar versleuteld en start de volledige synchronisatie.
import { metOrganisatie } from '../../../utils/db'
import { koppel } from '../../../utils/salesdna'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'koppeling.salesdna')
  const b = await readBody<{ endpoint?: string; geheim?: string }>(event)
  return metOrganisatie(ctx.organisatie.id, (tx) => koppel(tx, ctx.organisatie.id, String(b?.endpoint ?? ''), b?.geheim ? String(b.geheim) : null, ctx.gebruiker.id))
})
