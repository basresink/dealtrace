// POST /api/accountplannen/:id/notities {tekst}: een aantekening bij het plan (nieuwste eerst).
import { voegNotitieToe } from '../../../../utils/accountplannen'
import { metOrganisatie } from '../../../../utils/db'
import { vereisFunctie } from '../../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'nav.accountplannen')
  const b = await readBody<{ tekst?: string }>(event)
  return metOrganisatie(ctx.organisatie.id, (tx) => voegNotitieToe(tx, ctx.organisatie.id, getRouterParam(event, 'id')!, ctx.gebruiker, b?.tekst))
})
