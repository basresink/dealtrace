// PUT /api/salesdna/suggesties/:id {tekst?, besluit: 'vrij'|'af'}: de salesmanager geeft vrij (en Dealtrace
// verstuurt direct) of wijst af. 422 als de aangepaste tekst een naam noemt (namenfilter opnieuw).
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'
import { besluitSuggestie } from '../../../utils/suggesties'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'salesdna.suggesties.vrijgeven')
  const b = await readBody<{ tekst?: string; besluit?: string }>(event)
  if (b?.besluit !== 'vrij' && b?.besluit !== 'af') throw createError({ statusCode: 422, statusMessage: 'Kies vrij of af' })
  return metOrganisatie(ctx.organisatie.id, (tx) => besluitSuggestie(tx, ctx.organisatie.id, ctx.gebruiker, getRouterParam(event, 'id')!, { tekst: b.tekst ?? null, besluit: b.besluit as 'vrij' | 'af' }))
})
