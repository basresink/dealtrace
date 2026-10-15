// GET /api/onderweg/in-de-buurt?lat=&lng=&minuten=&prospects=1: eigen accounts binnen 15 minuten
// (Gevorderd). De plek staat alleen in dit verzoek: geen kolom, geen log.
import { metOrganisatie } from '../../utils/db'
import { inDeBuurt } from '../../utils/onderweg'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'onderweg.inDeBuurt')
  const q = getQuery(event)
  const lat = Number(q.lat); const lng = Number(q.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw createError({ statusCode: 400, statusMessage: 'Je plek is onbekend' })
  const minuten = Math.max(5, Math.min(30, Number(q.minuten) || 15))
  setHeader(event, 'cache-control', 'no-store')
  return metOrganisatie(ctx.organisatie.id, async (tx) => ({ minuten, accounts: await inDeBuurt(tx, ctx.gebruiker.id, { lat, lng }, minuten, q.prospects === '1') }))
})
