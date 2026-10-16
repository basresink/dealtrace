// PUT /api/reeksen/:id {mandaat?: B|C, actie?: pauzeer|hervat|stop}: mandaat wijzigen, pauzeren (geplande stappen
// schuiven bij hervatten op), of stoppen (open stappen vallen weg, het ritme gaat verder).
import { metOrganisatie } from '../../../utils/db'
import { wijzigReeks } from '../../../utils/opvolgreeks'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.volgen')
  const b = await readBody<any>(event)
  const g = { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol, niveau: ctx.gebruiker.niveau, werkplek: ctx.gebruiker.werkplek, data: ctx.gebruiker.data }
  return metOrganisatie(ctx.organisatie.id, (tx) => wijzigReeks(tx, ctx.organisatie.id, g, getRouterParam(event, 'id')!, {
    mandaat: typeof b?.mandaat === 'string' ? b.mandaat : undefined, actie: typeof b?.actie === 'string' ? b.actie : undefined,
  }))
})
