// GET /api/logo?domein=: het favicon van een bedrijfsdomein, opgehaald bij dat domein zelf en hier bewaard
// (B11). Zo gaat geen prospectdomein naar een dienst van derden. Volgorde: de grootste <link rel="icon">
// of apple-touch-icon uit de voorpagina, anders /favicon.ico. Geen bruikbaar logo: 204 zonder inhoud, dan
// houdt AccountLogo de initialen (en staat er geen 404 in de console). Testdomeinen (.test, .example,
// .invalid, .localhost, .local) halen we nooit op. Alleen openbare adressen: een domein dat naar een
// intern adres wijst, weigeren we.
import { promises as dns } from 'node:dns'
import { isIP } from 'node:net'
import { iconLinks, logoDomein, logoOphaalbaar } from '../../shared/logo'
import { vereisOrganisatie } from '../utils/sessie'

interface Logo { type: string; data: Buffer | null; tot: number }
const CACHE = new Map<string, Logo>()
const BEZIG = new Map<string, Promise<Logo>>()
const MAX_CACHE = 2000
const DAG = 864e5
const MAX_BYTES = 400_000
const TIMEOUT_MS = 4000

function intern(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase()
    if (v.startsWith('::ffff:')) return intern(v.slice(7))
    return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')
  }
  const [a, b] = ip.split('.').map(Number) as [number, number]
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
}

async function openbaar(host: string): Promise<boolean> {
  try {
    const adressen = await Promise.race([dns.lookup(host, { all: true }), new Promise<never>((_, nee) => setTimeout(() => nee(new Error('dns')), 2000))])
    return adressen.length > 0 && adressen.every((x) => !intern(x.address))
  } catch { return false }
}

/** Haalt een URL op met een tijdslimiet en maximaal drie omleidingen, elk naar een openbaar https-adres. */
async function haal(url: string, accept: string): Promise<Response | null> {
  let huidig = url
  for (let i = 0; i < 4; i++) {
    const u = new URL(huidig)
    if (u.protocol !== 'https:' || !(await openbaar(u.hostname))) return null
    const r = await fetch(huidig, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS), headers: { accept, 'user-agent': 'Dealtrace-logo/1.0' } }).catch(() => null)
    if (!r) return null
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { huidig = new URL(r.headers.get('location')!, huidig).toString(); continue }
    return r.ok ? r : null
  }
  return null
}

async function lees(r: Response, max: number): Promise<Buffer | null> {
  if (Number(r.headers.get('content-length') ?? 0) > max) return null
  const buf = Buffer.from(await r.arrayBuffer())
  return buf.length > 0 && buf.length <= max ? buf : null
}

async function zoekLogo(domein: string): Promise<{ type: string; data: Buffer } | null> {
  const basis = `https://${domein}/`
  const kandidaten: string[] = []
  const pagina = await haal(basis, 'text/html')
  if (pagina && (pagina.headers.get('content-type') ?? '').includes('html')) {
    const html = (await lees(pagina, 1_000_000))?.toString('utf8') ?? ''
    kandidaten.push(...iconLinks(html, pagina.url || basis).slice(0, 3))
  }
  kandidaten.push(`${basis}favicon.ico`)
  for (const k of [...new Set(kandidaten)]) {
    const r = await haal(k, 'image/*')
    if (!r) continue
    const type = (r.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase()
    // Geen SVG: die kan scripts bevatten; AccountLogo toont alleen gewone afbeeldingen.
    if (!/^image\/(png|x-icon|vnd\.microsoft\.icon|ico|jpeg|jpg|gif|webp)$/.test(type)) continue
    const data = await lees(r, MAX_BYTES)
    if (data) return { type, data }
  }
  return null
}

export default defineEventHandler(async (event) => {
  await vereisOrganisatie(event)
  const domein = logoDomein(String(getQuery(event).domein ?? ''))
  if (!domein) throw createError({ statusCode: 400, statusMessage: 'Geef een geldig domein mee' })
  let logo = CACHE.get(domein)
  if (!logo || logo.tot < Date.now()) {
    // Eén ophaalactie per domein tegelijk, en hooguit tien seconden in totaal.
    let bezig = BEZIG.get(domein)
    if (!bezig) {
      bezig = (async () => {
        const gevonden = logoOphaalbaar(domein) ? await Promise.race([zoekLogo(domein).catch(() => null), new Promise<null>((ja) => setTimeout(() => ja(null), 10_000))]) : null
        const nieuw: Logo = gevonden ? { ...gevonden, tot: Date.now() + 7 * DAG } : { type: '', data: null, tot: Date.now() + DAG }
        if (CACHE.size >= MAX_CACHE) CACHE.delete(CACHE.keys().next().value!)
        CACHE.set(domein, nieuw)
        return nieuw
      })().finally(() => BEZIG.delete(domein))
      BEZIG.set(domein, bezig)
    }
    logo = await bezig
  }
  setHeader(event, 'cache-control', `private, max-age=${logo.data ? 7 * 86400 : 86400}`)
  setHeader(event, 'x-content-type-options', 'nosniff')
  if (!logo.data) { setResponseStatus(event, 204); return null }
  setHeader(event, 'content-type', logo.type)
  return logo.data
})
