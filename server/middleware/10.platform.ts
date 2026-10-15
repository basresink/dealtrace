// Eerste serverlaag van Platformbeheer: /api/platform/** bestaat niet (404) voor
// iedereen zonder founderrol. Elk endpoint controleert daarna zelf (requireFounder).
import { halveFounder } from '../utils/platform'
import { vereisSessie } from '../utils/sessie'

export default defineEventHandler(async (event) => {
  if (!event.path.startsWith('/api/platform')) return
  try {
    const ctx = await vereisSessie(event)
    if (ctx.echteRol === 'founder') return
  } catch {
    // Geen sessie: ook 404, behalve een founder die de TOTP-stap nog moet doen (401).
    if (await halveFounder(event)) throw createError({ statusCode: 401, statusMessage: 'Tweestapsverificatie vereist' })
  }
  throw createError({ statusCode: 404, statusMessage: 'Niet gevonden' })
})
