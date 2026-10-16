// POST /api/platform/facturen/moneybird: betaalde facturen naar Moneybird (job, lokaal de mock). Founder.
import { sql } from 'drizzle-orm'
import { metOrganisatie } from '../../../utils/db'
import { synchroniseerMoneybird } from '../../../utils/platformBeheer'
import { alsPlatform, platformAudit, requireFounder } from '../../../utils/platform'

export default defineEventHandler(async (event) => {
  const ctx = await requireFounder(event)
  const orgs = await alsPlatform(async (tx) => ((await tx.execute(sql`select distinct organisation_id as id from dealtrace_platform_facturen() where status = 'betaald' and moneybird_id is null`)).rows as any[]).map((r) => r.id as string))
  let n = 0
  for (const org of orgs) n += await metOrganisatie(org, (tx) => synchroniseerMoneybird(tx, org))
  await alsPlatform((tx) => platformAudit(tx, event, ctx, { organisatieId: null, handeling: 'moneybird.sync', object: 'facturen', na: { aantal: n } }))
  return { ok: true, aantal: n, tekst: n ? `${n} ${n === 1 ? 'factuur' : 'facturen'} naar Moneybird.` : 'Alles staat al in Moneybird.' }
})
