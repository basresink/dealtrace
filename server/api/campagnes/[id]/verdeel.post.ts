// POST /api/campagnes/:id/verdeel {wijze, eigenaars}: verdelen over verkopers (salesmanager): gelijk, op
// gebied of op capaciteit. Open taken gaan mee naar de nieuwe eigenaar.
import { schrijfAudit } from '../../../utils/audit'
import { laad, verdeel } from '../../../utils/campagnes'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'campagnes.team')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<any>(event)
  const wijze = ['gelijk', 'gebied', 'capaciteit'].includes(b?.wijze) ? b.wijze : 'gelijk'
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    await laad(tx, id)
    const r = await verdeel(tx, id, { wijze, eigenaars: Array.isArray(b?.eigenaars) ? b.eigenaars.map(String) : [] })
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'campagne.verdelen', resourceType: 'campagnes', resourceId: id, changes: { wijze, eigenaars: b?.eigenaars } })
    return r
  })
})
