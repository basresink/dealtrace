// GET /api/platform/agentmaxima: platformmaximum per agent (founder).
import { AGENTS } from '../../../../shared/mandaat'
import { schema } from '../../../utils/db'
import { alsPlatform, requireFounder } from '../../../utils/platform'

export default defineEventHandler(async (event) => {
  await requireFounder(event)
  return alsPlatform(async (tx) => {
    const rijen = await tx.select().from(schema.platformAgentmaxima)
    return AGENTS.map((a) => ({ agent: a.sleutel, naam: a.naam, standaard: a.platformMax, max: rijen.find((r) => r.agent === a.sleutel)?.maxMandaat ?? a.platformMax }))
  })
})
