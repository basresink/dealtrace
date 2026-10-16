// POST /api/overdrachten/:id/opnieuw: een mislukte overdracht opnieuw versturen (eigenaar, salesmanager
// van het team, beheerder). 409 als de status niet mislukt is.
import { sql } from 'drizzle-orm'
import { schrijfAudit } from '../../../utils/audit'
import { metOrganisatie } from '../../../utils/db'
import { magAccount, opnieuw, overdrachtUit, verstuurOverdracht } from '../../../utils/overdracht'
import { verstuurCrmOverdracht } from '../../../utils/crm'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'overdracht.basis')
  const id = getRouterParam(event, 'id')!
  const org = ctx.organisatie.id
  let naar: string | null = null
  await metOrganisatie(org, async (tx) => {
    const [o] = (await tx.execute(sql`select account_id, naar from overdrachten where id = ${id}`)).rows as any[]
    naar = o?.naar ?? null
    if (!o) throw createError({ statusCode: 404, statusMessage: 'Overdracht niet gevonden' })
    if (!(await magAccount(tx, ctx.gebruiker, o.account_id))) throw createError({ statusCode: 403, statusMessage: 'Dit account is van een collega buiten je team' })
    await opnieuw(tx, id)
    await schrijfAudit(tx, { organisationId: org, actorId: ctx.gebruiker.id, action: 'overdracht.opnieuw', resourceType: 'overdrachten', resourceId: id, changes: {} })
  })
  await metOrganisatie(org, (tx) => (naar === 'crm' ? verstuurCrmOverdracht(tx, id) : verstuurOverdracht(tx, id))).catch(() => null)
  return metOrganisatie(org, async (tx) => overdrachtUit(((await tx.execute(sql`select * from overdrachten where id = ${id}`)).rows as any[])[0]))
})
