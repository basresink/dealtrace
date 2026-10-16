// GET /api/instellingen/prompts: per slot de eigen laag (versies) en de platformtekst als alleen-lezen
// voorbeeld, plus het vaste kader. Beheerder vanaf Plus (403 met reden pakket op Starter).
import { PROMPT_SLOTS, VAST_KADER } from '../../../../shared/platform'
import { vereisBeheerder } from '../../../utils/beheerder'
import { metOrganisatie } from '../../../utils/db'
import { promptversies } from '../../../utils/platformBeheer'

export default defineEventHandler(async (event) => {
  const ctx = await vereisBeheerder(event, 'instellingen.prompts')
  return metOrganisatie(ctx.organisatie.id, async (tx) => ({
    kader: VAST_KADER,
    slots: await Promise.all(PROMPT_SLOTS.map(async (s) => ({ ...s, platform: (await promptversies(tx, s.slot, 'platform'))[0]?.tekst ?? null, versies: await promptversies(tx, s.slot, 'organisatie') }))),
  }))
})
