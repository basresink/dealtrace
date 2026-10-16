// PUT /api/instellingen/prompts/:slot {tekst}: een nieuwe versie van de eigen laag (hooguit 10). Beheerder vanaf Plus.
import { PROMPT_SLOTS, type PromptSlot } from '../../../../shared/platform'
import { schrijfAudit } from '../../../utils/audit'
import { vereisBeheerder } from '../../../utils/beheerder'
import { metOrganisatie } from '../../../utils/db'
import { bewaarPromptversie } from '../../../utils/platformBeheer'

export default defineEventHandler(async (event) => {
  const ctx = await vereisBeheerder(event, 'instellingen.prompts')
  const slot = getRouterParam(event, 'slot') as PromptSlot
  if (!PROMPT_SLOTS.some((s) => s.slot === slot)) throw createError({ statusCode: 404, statusMessage: 'Onbekend slot' })
  const { tekst } = await readBody<{ tekst?: string }>(event)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const versie = await bewaarPromptversie(tx, { slot, laag: 'organisatie', org: ctx.organisatie.id, tekst: String(tekst ?? ''), auteur: ctx.gebruiker.id })
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'prompt.opslaan', resourceType: 'prompt_versies', resourceId: slot, changes: { versie } })
    return { versie, tekst: `Versie ${versie} is opgeslagen.` }
  })
})
