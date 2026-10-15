// Founder in "Alleen meekijken": elke schrijfactie in klantdata wordt geweigerd,
// ook via de sync-wachtrij. Platformroutes en de eigen sessie blijven werken.
import { MEEKIJKTEKST } from '../../shared/werkIn'
import { vereisSessie } from '../utils/sessie'
import { WERK_IN_COOKIE } from '../utils/werkIn'

// Eigen meldingen van de founder zijn geen klantdata.
const VRIJ = ['/api/platform/', '/api/sessie/', '/api/auth/', '/api/mij/gezien', '/api/mij/toestellen', '/api/notificaties/']

export default defineEventHandler(async (event) => {
  if (!event.path.startsWith('/api/')) return
  if (['GET', 'HEAD', 'OPTIONS'].includes(event.method)) return
  if (!getCookie(event, WERK_IN_COOKIE)) return
  if (VRIJ.some((v) => event.path.startsWith(v))) return
  let ctx
  try { ctx = await vereisSessie(event) } catch { return }
  if (ctx.werkIn?.modus === 'meekijken') {
    throw createError({ statusCode: 403, statusMessage: MEEKIJKTEKST, data: { meekijken: true } })
  }
})
