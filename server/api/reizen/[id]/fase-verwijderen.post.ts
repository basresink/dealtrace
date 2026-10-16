// POST /api/reizen/:id/fase-verwijderen {faseId, vervangendeFaseId}: alleen in een concept; 422 zonder vervangende fase.
import { metOrganisatie } from '../../../utils/db'
import { bewerker } from '../../../utils/reisApi'
import { verwijderFaseUitConcept } from '../../../utils/reisEditor'
import { vereisOrganisatie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  const g = bewerker(ctx)
  const b = await readBody<{ faseId?: string; vervangendeFaseId?: string }>(event)
  if (!b?.faseId) throw createError({ statusCode: 422, statusMessage: 'Kies de fase' })
  return metOrganisatie(ctx.organisatie!.id, (tx) => verwijderFaseUitConcept(tx, g, getRouterParam(event, 'id')!, b.faseId!, b.vervangendeFaseId ?? ''))
})
