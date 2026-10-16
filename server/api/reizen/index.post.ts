// POST /api/reizen {vanuit: 'leeg'|'standaard'|reisId, naam?, doelgroepId?}: een concept (Expert met maatwerk, salesmanager, beheerder).
import { metOrganisatie } from '../../utils/db'
import { bewerker } from '../../utils/reisApi'
import { maakConcept } from '../../utils/reisEditor'
import { vereisOrganisatie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  const g = bewerker(ctx)
  const b = await readBody<{ vanuit?: string; naam?: string; doelgroepId?: string | null }>(event)
  return metOrganisatie(ctx.organisatie!.id, (tx) => maakConcept(tx, ctx.organisatie!.id, g, { vanuit: b?.vanuit || 'standaard', naam: b?.naam ?? null, doelgroepId: b?.doelgroepId ?? null }))
})
