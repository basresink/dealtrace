// PUT /api/agents/credits {soort, dagplafond}: dagplafond in credits per AI-soort voor de agents (11.4).
import { AI_SOORTEN, type AiSoort } from '../../../shared/credits'
import { schrijfAudit } from '../../utils/audit'
import { metOrganisatie } from '../../utils/db'
import { laadAgentStand } from '../../utils/agents/bewaker'
import { zetAgentInstelling } from '../../utils/agents/instellingen'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'agents.beheer')
  const b = await readBody<{ soort?: AiSoort; dagplafond?: number | null }>(event)
  if (!b?.soort || !AI_SOORTEN.includes(b.soort)) throw createError({ statusCode: 400, statusMessage: 'Onbekende AI-soort' })
  if (b.dagplafond != null && !(Number.isInteger(b.dagplafond) && b.dagplafond >= 0 && b.dagplafond <= 100000)) throw createError({ statusCode: 422, statusMessage: 'Dagplafond is een geheel getal vanaf 0' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const stand = await laadAgentStand(tx, ctx.organisatie.id)
    const nieuw = { ...stand.creditsPerSoort }
    if (b.dagplafond == null) delete nieuw[b.soort!]
    else nieuw[b.soort!] = b.dagplafond
    const oud = await zetAgentInstelling(tx, ctx.organisatie.id, 'agentCreditsPerSoort', nieuw)
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'agents.creditsPlafond', resourceType: 'org_settings', resourceId: 'agentCreditsPerSoort', changes: { van: oud, naar: nieuw } })
    return nieuw
  })
})
