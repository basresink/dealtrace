// Online testomgeving: zonder geldig toegangscookie geen app en geen API.
// Lokaal (geen TOEGANGSWACHTWOORD en niet online) doet deze middleware niets.
import { STANDAARD_GEHEIM, TOEGANG_COOKIE, gelijk, ontbrekendeInstellingen, toegangsPagina, toegangsbewijs } from '../utils/toegang'

const VRIJ = ['/toegang', '/_nuxt/', '/favicon.ico', '/robots.txt']

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  const pad = event.path.split('?')[0] ?? '/'
  if (VRIJ.some((v) => pad === v || (v.endsWith('/') && pad.startsWith(v)))) return

  const mist = ontbrekendeInstellingen(config as any)
  if (mist.length) {
    setResponseStatus(event, 503)
    setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
    return toegangsPagina({ mist })
  }
  const wachtwoord = config.toegangswachtwoord as string
  if (!wachtwoord) return

  const bewijs = toegangsbewijs(wachtwoord, (config.sessieGeheim as string) || STANDAARD_GEHEIM)
  if (gelijk(getCookie(event, TOEGANG_COOKIE) ?? '', bewijs)) return

  if (pad.startsWith('/api/')) throw createError({ statusCode: 401, statusMessage: 'Toegangswachtwoord ontbreekt' })
  return sendRedirect(event, `/toegang?naar=${encodeURIComponent(event.path)}`, 302)
})
