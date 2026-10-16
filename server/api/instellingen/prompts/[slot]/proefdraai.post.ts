// POST /api/instellingen/prompts/:slot/proefdraai {tekst}: de eigen laag op voorbeelddata uit Voltvast. Beheerder vanaf Plus.
import { PROMPT_SLOTS, controleerPrompt, type PromptSlot } from '../../../../../shared/platform'
import { vereisBeheerder } from '../../../../utils/beheerder'
import { proefdraai } from '../../../../utils/proefdraai'

export default defineEventHandler(async (event) => {
  const ctx = await vereisBeheerder(event, 'instellingen.prompts')
  const slot = getRouterParam(event, 'slot') as PromptSlot
  if (!PROMPT_SLOTS.some((s) => s.slot === slot)) throw createError({ statusCode: 404, statusMessage: 'Onbekend slot' })
  const { tekst } = await readBody<{ tekst?: string }>(event)
  const f = controleerPrompt(String(tekst ?? ''))
  if (f) throw createError({ statusCode: 422, statusMessage: f })
  return proefdraai(slot, String(tekst), ctx.gebruiker.id)
})
