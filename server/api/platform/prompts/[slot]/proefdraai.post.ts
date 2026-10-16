// POST /api/platform/prompts/:slot/proefdraai {tekst}: het slot op voorbeelddata uit Voltvast. Founder.
import { PROMPT_SLOTS, controleerPrompt, type PromptSlot } from '../../../../../shared/platform'
import { proefdraai } from '../../../../utils/proefdraai'
import { requireFounder } from '../../../../utils/platform'

export default defineEventHandler(async (event) => {
  const ctx = await requireFounder(event)
  const slot = getRouterParam(event, 'slot') as PromptSlot
  if (!PROMPT_SLOTS.some((s) => s.slot === slot)) throw createError({ statusCode: 404, statusMessage: 'Onbekend slot' })
  const { tekst } = await readBody<{ tekst?: string }>(event)
  const f = controleerPrompt(String(tekst ?? ''))
  if (f) throw createError({ statusCode: 422, statusMessage: f })
  return proefdraai(slot, String(tekst), ctx.gebruiker.id)
})
