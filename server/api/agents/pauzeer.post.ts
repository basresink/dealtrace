// POST /api/agents/pauzeer {pauze}: de stopknop. Alle B-handelingen gaan direct naar de mens.
import { schrijfAudit } from '../../utils/audit'
import { metOrganisatie } from '../../utils/db'
import { zetAgentInstelling } from '../../utils/agents/instellingen'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'agents.beheer')
  const b = await readBody<{ pauze?: boolean }>(event)
  if (typeof b?.pauze !== 'boolean') throw createError({ statusCode: 400, statusMessage: 'pauze ontbreekt' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const waarde = b.pauze ? { sinds: new Date().toISOString(), door: ctx.gebruiker.naam } : null
    const oud = await zetAgentInstelling(tx, ctx.organisatie.id, 'agentenGepauzeerd', waarde)
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: b.pauze ? 'agents.pauzeren' : 'agents.hervatten', resourceType: 'org_settings', resourceId: 'agentenGepauzeerd', changes: { van: oud, naar: waarde } })
    return { pauze: waarde }
  })
})
