// PUT /api/platform/prompts/:slot {tekst}: een nieuwe versie van de platformlaag. Herbevestiging; de elfde
// versie verdringt de oudste; 422 als de tekst het vaste kader probeert op te heffen. Platformaudit.
import { PROMPT_SLOTS, type PromptSlot } from '../../../../shared/platform'
import { bewaarPromptversie } from '../../../utils/platformBeheer'
import { alsPlatform, platformAudit, requireFounder, vereisHerbevestiging } from '../../../utils/platform'

export default defineEventHandler(async (event) => {
  const ctx = await requireFounder(event)
  const slot = getRouterParam(event, 'slot') as PromptSlot
  if (!PROMPT_SLOTS.some((s) => s.slot === slot)) throw createError({ statusCode: 404, statusMessage: 'Onbekend slot' })
  const { tekst } = await readBody<{ tekst?: string }>(event)
  vereisHerbevestiging(ctx)
  return alsPlatform(async (tx) => {
    const versie = await bewaarPromptversie(tx, { slot, laag: 'platform', org: null, tekst: String(tekst ?? ''), auteur: ctx.gebruiker.id })
    await platformAudit(tx, event, ctx, { organisatieId: null, handeling: 'prompt.opslaan', object: slot, na: { versie } })
    return { versie, tekst: `Versie ${versie} van ${slot} is opgeslagen.` }
  })
})
