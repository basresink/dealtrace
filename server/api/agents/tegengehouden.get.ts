// GET /api/agents/tegengehouden?datum=YYYY-MM-DD: wat de Bewaker tegenhield, met reden.
// Beheerder en salesmanager alles; een Expert (agents.waaromNiet) zijn eigen accounts.
import { and, eq, gte, lt, sql } from 'drizzle-orm'
import { nlMoment, nlTijdstip, plusDagen } from '../../../shared/datum'
import { metOrganisatie, schema } from '../../utils/db'
import { kan } from '../../utils/accounts'
import { vereisOrganisatie, weigerFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  const beheer = kan(ctx, 'agents.beheer')
  if (!beheer && !kan(ctx, 'agents.waaromNiet')) weigerFunctie('agents.waaromNiet', 'niveau')
  const q = getQuery(event)
  const datum = typeof q.datum === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(q.datum) ? q.datum : nlMoment(new Date()).datum
  const accountId = typeof q.accountId === 'string' ? q.accountId : null
  const alles = beheer || ctx.gebruiker.rol === 'salesmanager'
  return metOrganisatie(ctx.organisatie.id, (tx) => tx.select({ id: schema.agentRuns.id, agent: schema.agentRuns.agent, handeling: schema.agentRuns.handeling, reden: schema.agentRuns.reden, op: schema.agentRuns.op, accountId: schema.agentRuns.accountId, account: schema.accounts.name })
    .from(schema.agentRuns).leftJoin(schema.accounts, eq(schema.accounts.id, schema.agentRuns.accountId))
    .where(and(eq(schema.agentRuns.uitkomst, 'geblokkeerd'), gte(schema.agentRuns.op, nlTijdstip(datum, 0).toISOString()), lt(schema.agentRuns.op, nlTijdstip(plusDagen(datum, 1), 0).toISOString()),
      accountId ? eq(schema.agentRuns.accountId, accountId) : sql`true`, alles ? sql`true` : eq(schema.accounts.ownerId, ctx.gebruiker.id)))
    .orderBy(sql`${schema.agentRuns.op} desc`).limit(200))
})
