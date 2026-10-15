// GET /api/kvk/:nummer: het basisprofiel (30 dagen gecachet) voor "Zoek in KvK" in de flyout.
import { KVK_NIET_GEKOPPELD } from '../../../shared/leadGenerator'
import { metOrganisatie } from '../../utils/db'
import { kvkContext, kvkProfiel, KvkFout } from '../../utils/bronnen/kvk'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.nieuw')
  const nummer = getRouterParam(event, 'nummer')!.replace(/\D/g, '')
  if (!/^\d{8}$/.test(nummer)) throw createError({ statusCode: 422, statusMessage: 'Een KvK-nummer heeft acht cijfers' })
  return metOrganisatie(ctx.organisatie!.id, async (tx) => {
    const k = await kvkContext(tx, ctx.organisatie!.pakket)
    if (!k) throw createError({ statusCode: 400, statusMessage: KVK_NIET_GEKOPPELD })
    try {
      const p = await kvkProfiel(tx, ctx.organisatie!.id, k, nummer)
      if (!p) throw createError({ statusCode: 404, statusMessage: 'Dit KvK-nummer staat niet in het register' })
      return p
    } catch (e) {
      if (e instanceof KvkFout) throw createError({ statusCode: e.statusCode, statusMessage: e.message })
      throw e
    }
  })
})
