// POST /api/accountplannen/voorstel {doel, planId? | accountId, concept?}: een voorzet van de Pitstop voor één
// blok of voor het actieplan (soort concept, met credits; 402 als de pot op is). Altijd een voorstel met de
// bronnen erbij ("Gebaseerd op"); de server schrijft niets in het plan. Vereist Accountplannen en Pitstop.
import { planVoorzet } from '../../utils/accountplanAi'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  await vereisFunctie(event, 'pitstop.maken')
  const ctx = await vereisFunctie(event, 'nav.accountplannen')
  const b = await readBody<any>(event)
  return planVoorzet(ctx.organisatie.id, ctx.gebruiker, b ?? {})
})
