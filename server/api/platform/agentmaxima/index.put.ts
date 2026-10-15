// PUT /api/platform/agentmaxima {agent, max}: alleen de founder zet het platformmaximum (F23).
// Nooit ruimer dan de standaard uit shared/mandaat.ts.
import { AGENTS, MANDATEN, strengste, type Mandaat } from '../../../../shared/mandaat'
import { schema } from '../../../utils/db'
import { alsPlatform, platformAudit, requireFounder } from '../../../utils/platform'

export default defineEventHandler(async (event) => {
  const ctx = await requireFounder(event)
  const b = await readBody<{ agent?: string; max?: Mandaat }>(event)
  const def = AGENTS.find((a) => a.sleutel === b?.agent)
  if (!def) throw createError({ statusCode: 404, statusMessage: 'Onbekende agent' })
  if (!MANDATEN.includes(b!.max!)) throw createError({ statusCode: 400, statusMessage: 'Kies A, B, C of D' })
  if (strengste(b!.max!, def.platformMax) !== b!.max) throw createError({ statusCode: 422, statusMessage: `Ruimer dan de standaard (${def.platformMax})` })
  return alsPlatform(async (tx) => {
    await tx.insert(schema.platformAgentmaxima).values({ agent: def.sleutel, maxMandaat: b!.max!, gewijzigdDoor: ctx.gebruiker.id, gewijzigdOp: new Date().toISOString() })
      .onConflictDoUpdate({ target: schema.platformAgentmaxima.agent, set: { maxMandaat: b!.max!, gewijzigdDoor: ctx.gebruiker.id, gewijzigdOp: new Date().toISOString() } })
    await platformAudit(tx, event, ctx, { organisatieId: null, handeling: 'agentmaximum.zetten', object: def.sleutel, na: { max: b!.max } })
    return { agent: def.sleutel, max: b!.max }
  })
})
