// POST /api/afspraken/:id/verplaats {start, duurMin?, titel?}: een geplande afspraak verzetten naar een
// ander moment (en de titel bijwerken). Alleen gepland; de gekoppelde agenda krijgt het nieuwe moment.
import { verplaatsAfspraak } from '../../../utils/agenda'
import { vereisAfspraak } from '../../../utils/afspraakToegang'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'agenda.basis')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ start?: string; duurMin?: number; titel?: string | null }>(event)
  if (!b?.start) throw createError({ statusCode: 422, statusMessage: 'Kies een datum en starttijd' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    await vereisAfspraak(tx, ctx, id)
    return verplaatsAfspraak(tx, ctx.organisatie.id, id, ctx.gebruiker.id, { start: b.start!, duurMin: b.duurMin, titel: b.titel })
  })
})
