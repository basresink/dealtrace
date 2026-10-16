// POST /api/reizen/voorstel {doelgroepId}: "Stel fases voor" (Expert). Altijd een concept; 402 als de AI-credits op zijn.
import { metOrganisatie } from '../../utils/db'
import { bewerker } from '../../utils/reisApi'
import { stelFasesVoor } from '../../utils/reisEditor'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'reizen.voorstelAI')
  const g = bewerker(ctx)
  const b = await readBody<{ doelgroepId?: string | null }>(event)
  return metOrganisatie(ctx.organisatie.id, (tx) => stelFasesVoor(tx, ctx.organisatie.id, { ...g, niveau: ctx.gebruiker.niveau, data: ctx.gebruiker.data }, b?.doelgroepId ?? null))
})
