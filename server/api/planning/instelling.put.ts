// PUT /api/planning/instelling: startmaand, vensters, potentiebron en potentie per eigen klasse (F13).
// Salesmanager en beheerder.
import { leesPlanning } from '../../../shared/planning'
import { schrijfAudit } from '../../utils/audit'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'planning.vensters')
  const inst = leesPlanning(await readBody(event))
  return metOrganisatie(ctx.organisatie!.id, async (tx) => {
    await tx.insert(schema.orgSettings).values({ organisationId: ctx.organisatie!.id, key: 'prospectplanning', value: inst, updatedAt: new Date().toISOString() })
      .onConflictDoUpdate({ target: [schema.orgSettings.organisationId, schema.orgSettings.key], set: { value: inst, updatedAt: new Date().toISOString() } })
    await schrijfAudit(tx, { organisationId: ctx.organisatie!.id, actorId: ctx.gebruiker.id, action: 'instelling.prospectplanning', resourceType: 'org_settings', resourceId: 'prospectplanning', changes: inst as any })
    return inst
  })
})
