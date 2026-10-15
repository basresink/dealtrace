// PUT /api/campagnes/:id: wijzigen, pauzeren, hervatten of accounts toevoegen (eigenaar, salesmanager van
// het team, beheerder). 409 bij een versieconflict; 400 als een toegevoegd account niet mee kan.
import { schrijfAudit } from '../../../utils/audit'
import { laad, magWijzigen, wijzig } from '../../../utils/campagnes'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'campagnes.maken')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<any>(event)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    if (!(await magWijzigen(tx, ctx.gebruiker, await laad(tx, id)))) throw createError({ statusCode: 403, statusMessage: 'Alleen de eigenaar of de salesmanager wijzigt deze campagne' })
    const r = await wijzig(tx, id, b ?? {}, { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol }, ctx.organisatie.id)
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'campagne.wijzigen', resourceType: 'campagnes', resourceId: id, changes: b ?? {} })
    return { id: r.id, versie: r.versie, status: r.status, toegevoegd: r.toegevoegd }
  })
})
