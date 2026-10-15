// POST /api/doelgroepen: nieuwe doelgroep (salesmanager, beheerder).
import { schrijfAudit } from '../../utils/audit'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'
import { schoonDoelgroep } from '../../utils/doelgroepen'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'doelgroepen.beheren')
  const d = schoonDoelgroep(await readBody(event))
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [rij] = await tx.insert(schema.doelgroepen).values({ organisationId: ctx.organisatie.id, ...d }).returning()
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'doelgroep.maken', resourceType: 'doelgroepen', resourceId: rij!.id, changes: d })
    return rij
  })
})
