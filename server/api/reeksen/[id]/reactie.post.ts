// POST /api/reeksen/:id/reactie {kanaal?: mail|telefoon|linkedin|anders, notitie?}: de prospect reageerde. De
// reactie komt in de activiteitenlog, de reeks stopt en er komt een taak "bel terug" (langs de Bewaker).
import { metOrganisatie } from '../../../utils/db'
import { logReactie } from '../../../utils/opvolgreeks'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.volgen')
  const b = await readBody<any>(event)
  const g = { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol, niveau: ctx.gebruiker.niveau, werkplek: ctx.gebruiker.werkplek, data: ctx.gebruiker.data }
  return metOrganisatie(ctx.organisatie.id, (tx) => logReactie(tx, ctx.organisatie.id, g, getRouterParam(event, 'id')!, {
    kanaal: typeof b?.kanaal === 'string' ? b.kanaal : undefined, notitie: typeof b?.notitie === 'string' ? b.notitie : null,
  }))
})
