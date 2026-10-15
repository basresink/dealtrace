// POST /api/campagnes/winpunt {faseId?}: het AI-voorstel voor het winpunt in de wizard (Schrijver,
// mandaat A, soort concept). Kiest alleen uit bevestigde winpunten; 402 zonder credits.
import { kan } from '../../utils/accounts'
import { winpuntVoorstel } from '../../utils/campagnes'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'campagnes.maken')
  if (!kan(ctx, 'campagnes.boodschapAI')) return { voorstel: null }
  const b = await readBody<any>(event)
  return metOrganisatie(ctx.organisatie.id, async (tx) => ({ voorstel: await winpuntVoorstel(tx, ctx.organisatie.id, ctx.gebruiker, b?.faseId ?? null) }))
})
