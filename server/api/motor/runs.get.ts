// GET /api/motor/runs: de laatste runverslagen (regels lezen).
import { desc } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../utils/db'
import { magRegelsLezen } from '../../utils/regels'
import { vereisOrganisatie, weigerFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  if (!magRegelsLezen(ctx)) weigerFunctie('regels.lezen', 'niveau')
  return metOrganisatie(ctx.organisatie.id, async (tx) => ({ runs: await tx.select().from(schema.ruleRuns).orderBy(desc(schema.ruleRuns.gestartOp)).limit(20) }))
})
