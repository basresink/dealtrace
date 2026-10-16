// POST /api/salesdna/suggesties/verstuur {ids}: vrijgegeven suggesties (opnieuw) versturen, bijvoorbeeld na
// "Geef alles vrij" of na een mislukte poging. 429 boven 10 per sublaag per week.
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'
import { besluitSuggestie, verstuur } from '../../../utils/suggesties'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'salesdna.suggesties.vrijgeven')
  const b = await readBody<{ ids?: string[]; vrijgeven?: boolean }>(event)
  const ids = Array.isArray(b?.ids) ? b.ids.map(String).slice(0, 60) : []
  if (!ids.length) throw createError({ statusCode: 422, statusMessage: 'Kies de suggesties' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    // "Geef alles vrij": eerst vrijgeven (zonder losse verzending), dan in één bundel versturen.
    if (b.vrijgeven) for (const id of ids) await besluitSuggestie(tx, ctx.organisatie.id, ctx.gebruiker, id, { besluit: 'vrij' }, new Date(), { zonderVersturen: true })
    return verstuur(tx, ctx.organisatie.id, ctx.gebruiker, ids)
  })
})
