// POST /api/campagnes/:id/activeer {bevestiging?}: activeren zet de startdatum (gat 13) en spreidt de
// taken. 400 bij kanaaldekking onder 80 procent; 403 {reden:'capaciteit'} boven capaciteit, tenzij de
// salesmanager activeert of de accountmanager om bevestiging vraagt (dan status "wacht").
import { schrijfAudit } from '../../../utils/audit'
import { activeerCampagne, laad, magWijzigen } from '../../../utils/campagnes'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'campagnes.maken')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<any>(event).catch(() => ({}))
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    if (!(await magWijzigen(tx, ctx.gebruiker, await laad(tx, id)))) throw createError({ statusCode: 403, statusMessage: 'Alleen de eigenaar of de salesmanager activeert deze campagne' })
    const r = await activeerCampagne(tx, ctx.organisatie.id, { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol, naam: ctx.gebruiker.naam }, id, { bevestigd: !!b?.bevestiging })
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'campagne.activeren', resourceType: 'campagnes', resourceId: id, changes: r })
    return r
  })
})
