// Eerste serverlaag van Platformbeheer: /api/platform/** bestaat niet (404) voor
// iedereen zonder founderrol. Elk endpoint controleert daarna zelf (requireFounder).
import { vereisSessie } from '../utils/sessie'

export default defineEventHandler(async (event) => {
  if (!event.path.startsWith('/api/platform')) return
  try {
    const ctx = await vereisSessie(event)
    if (ctx.echteRol === 'founder') return
  } catch { /* geen sessie: ook 404 */ }
  throw createError({ statusCode: 404, statusMessage: 'Niet gevonden' })
})
