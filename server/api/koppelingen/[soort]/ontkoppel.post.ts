// POST /api/koppelingen/:soort/ontkoppel: tokens gewist, status uit, audit (beheerder). De gelezen
// kopie (crm_records) blijft voor ontdubbelen tot een nieuwe koppeling hem ververst.
import { sql } from 'drizzle-orm'
import { schrijfAudit } from '../../../utils/audit'
import { crmRij, crmStand } from '../../../utils/crm'
import { crmSoortUit } from '../../../utils/crmApi'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'koppeling.crm')
  const soort = crmSoortUit(event)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const k = await crmRij(tx, soort)
    if (k) await tx.execute(sql`update koppelingen set status = 'uit', geheimen = null, updated_at = now() where id = ${k.id}`)
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'koppeling.crm.ontkoppeld', resourceType: 'koppelingen', resourceId: soort, changes: {} })
    return crmStand(tx, soort)
  })
})
