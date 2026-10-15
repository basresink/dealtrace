// PUT /api/agents/:agent/mandaat {mandaat, dagplafond?, aan?, eigen?}: de beheerder zet het
// organisatiemandaat binnen het platformmaximum; een Expert zet met eigen: true zijn eigen
// mandaat binnen het organisatiemandaat. Boven het maximum: 422.
import { eq } from 'drizzle-orm'
import { agentDef, mandaatFout, organisatieMaximum, type AgentMandaten, type Mandaat } from '../../../../shared/mandaat'
import { schrijfAudit } from '../../../utils/audit'
import { metOrganisatie, schema } from '../../../utils/db'
import { kan } from '../../../utils/accounts'
import { laadAgentStand } from '../../../utils/agents/bewaker'
import { zetAgentInstelling } from '../../../utils/agents/instellingen'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const agent = getRouterParam(event, 'agent') ?? ''
  const b = await readBody<{ mandaat?: Mandaat; dagplafond?: number | null; aan?: boolean; eigen?: boolean }>(event)
  const ctx = await vereisFunctie(event, b?.eigen ? 'agents.eigenMandaat' : 'agents.beheer')
  if (!agentDef(agent)) throw createError({ statusCode: 404, statusMessage: 'Onbekende agent' })
  if (b?.dagplafond != null && !(Number.isInteger(b.dagplafond) && b.dagplafond >= 0 && b.dagplafond <= 1000)) throw createError({ statusCode: 422, statusMessage: 'Dagplafond tussen 0 en 1000' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const stand = await laadAgentStand(tx, ctx.organisatie.id)
    const orgMax = organisatieMaximum(agent, stand.maxima[agent])
    if (b?.eigen) {
      // Eigen mandaat: nooit ruimer dan wat de organisatie toestaat, ook niet het dagplafond.
      const orgInst = stand.mandaten[agent]
      const max = orgInst?.mandaat ?? orgMax
      const fout = mandaatFout(agent, b.mandaat, max)
      if (fout) throw createError({ statusCode: 422, statusMessage: fout })
      if (b.dagplafond != null && orgInst?.dagplafond != null && b.dagplafond > orgInst.dagplafond) throw createError({ statusCode: 422, statusMessage: `Dagplafond hoger dan het organisatiemaximum (${orgInst.dagplafond})` })
      const [u] = await tx.select({ data: schema.users.data }).from(schema.users).where(eq(schema.users.id, ctx.gebruiker.id))
      const data = { ...(u?.data ?? {}), mandaat: { ...(u?.data?.mandaat ?? {}), [agent]: { mandaat: b.mandaat!, dagplafond: b.dagplafond ?? null } } }
      await tx.update(schema.users).set({ data, updatedAt: new Date().toISOString() }).where(eq(schema.users.id, ctx.gebruiker.id))
      await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'agent.eigenMandaat', resourceType: 'users', resourceId: ctx.gebruiker.id, changes: { agent, van: u?.data?.mandaat?.[agent] ?? null, naar: data.mandaat[agent] } })
      return { agent, eigen: data.mandaat[agent] }
    }
    if (!kan(ctx, 'agents.beheer')) throw createError({ statusCode: 403, statusMessage: 'Alleen de beheerder zet mandaten' })
    const fout = mandaatFout(agent, b?.mandaat, orgMax)
    if (fout) throw createError({ statusCode: 422, statusMessage: fout })
    const nieuw: AgentMandaten = { ...stand.mandaten, [agent]: { mandaat: b!.mandaat!, dagplafond: b?.dagplafond ?? stand.mandaten[agent]?.dagplafond ?? null, aan: b?.aan ?? stand.mandaten[agent]?.aan ?? true } }
    const oud = await zetAgentInstelling(tx, ctx.organisatie.id, 'agentmandaten', nieuw)
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'agent.mandaat', resourceType: 'org_settings', resourceId: 'agentmandaten', changes: { agent, van: (oud as any)?.[agent] ?? null, naar: nieuw[agent] } })
    return { agent, ...nieuw[agent] }
  })
})
