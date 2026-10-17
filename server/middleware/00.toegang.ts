// Online testomgeving: zonder geldig toegangscookie geen app en geen API.
// Lokaal (geen TOEGANGSWACHTWOORD en niet online) doet deze middleware niets.
import { STANDAARD_GEHEIM, TOEGANG_COOKIE, gelijk, ontbrekendeInstellingen, toegangsPagina, toegangsbewijs } from '../utils/toegang'

// /api/motor/run-all heeft een eigen geheim (x-motor-secret) voor de geplande functie; de
// SalesDNA-webhook, de DealDrive-koppeling (v1) en de Stripe- en WhatsApp-webhook controleren zelf de handtekening; de afmeldlink is ondertekend (P18).
// De reeksen-sweep heeft het motorgeheim; de webhook voor inkomende mail een ondertekende URL per organisatie (F7).
// De dagplanning heeft het motorgeheim; de melding van de gekoppelde agenda een ondertekend token (F3).
// De dagritme-mail (weekreview, weekstart, dagstart) heeft het motorgeheim.
const VRIJ = ['/toegang', '/_nuxt/', '/favicon.ico', '/robots.txt', '/manifest.webmanifest', '/iconen/', '/api/motor/run-all', '/api/motor/reminders-sweep', '/api/motor/onderweg-meldingen', '/api/koppelingen/salesdna/webhook', '/api/koppelingen/salesdna/webhook/', '/api/koppelingen/dealdrive/v1/', '/api/stripe/webhook', '/api/afmelden', '/api/whatsapp/webhook', '/api/motor/reeksen-sweep', '/api/mail/inkomend', '/api/motor/dagplanning', '/api/motor/dagritme-mail', '/api/koppelingen/agenda/melding']

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
