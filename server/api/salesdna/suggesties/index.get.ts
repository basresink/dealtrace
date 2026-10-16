// GET /api/salesdna/suggesties?week=2026-W46: de suggesties naar SalesDNA per sublaag, plus de open
// voorstellen van Experts (salesmanager voor zijn teams, beheerder alles).
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'
import { suggestiesVoor } from '../../../utils/suggesties'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'salesdna.suggesties.vrijgeven')
  const week = String(getQuery(event).week ?? '') || null
  return metOrganisatie(ctx.organisatie.id, (tx) => suggestiesVoor(tx, ctx.gebruiker, week))
})
