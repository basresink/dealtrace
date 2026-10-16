// GET /api/platform/prompts: per slot de versies van de platformlaag (hooguit 10), het vaste kader en het
// aantal klanten met een eigen laag. Founder.
import { sql } from 'drizzle-orm'
import { PROMPT_SLOTS, VAST_KADER } from '../../../../shared/platform'
import { promptversies } from '../../../utils/platformBeheer'
import { alsPlatform, requireFounder } from '../../../utils/platform'

export default defineEventHandler(async (event) => {
  await requireFounder(event)
  return alsPlatform(async (tx) => ({
    kader: VAST_KADER,
    slots: await Promise.all(PROMPT_SLOTS.map(async (s) => ({ ...s, versies: await promptversies(tx, s.slot, 'platform') }))),
  }))
})
