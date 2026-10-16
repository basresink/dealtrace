// POST /api/volgen/:accountId/reeks {sjabloonId, contactId?, mandaat?: B|C, aanleiding?}: een opvolgreeks starten.
// 409 als er al een reeks loopt; 422 bij een account op nee of overgedragen, of een mandaat dat je niet mag.
import { metOrganisatie } from '../../../utils/db'
import { startReeks } from '../../../utils/opvolgreeks'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.volgen')
  const b = await readBody<any>(event)
  const g = { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol, niveau: ctx.gebruiker.niveau, werkplek: ctx.gebruiker.werkplek, data: ctx.gebruiker.data }
  return metOrganisatie(ctx.organisatie.id, (tx) => startReeks(tx, ctx.organisatie.id, g, getRouterParam(event, 'accountId')!, {
    sjabloonId: typeof b?.sjabloonId === 'string' ? b.sjabloonId : undefined, contactId: typeof b?.contactId === 'string' && b.contactId ? b.contactId : null,
    mandaat: typeof b?.mandaat === 'string' ? b.mandaat : undefined, aanleiding: typeof b?.aanleiding === 'string' ? b.aanleiding.slice(0, 200) : null,
  }, getRequestURL(event).origin))
})
