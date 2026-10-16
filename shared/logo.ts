// Logo en website van een account (opzet uit DealDrive, useAccountLogo).
// Volgorde voor het logo: een eigen logo-URL wint; anders het favicon van het domein van de website, via
// onze eigen route /api/logo (die haalt het bij het domein zelf en bewaart het; geen dienst van derden, B11);
// bewust uitgezet, geen domein of een testdomein: de initialen.
// De website van een nieuwe prospect komt uit de invoer of uit het e-maildomein van een contact,
// behalve bij een gratis maildienst (gmail, hotmail en dergelijke): dat domein is niet van het bedrijf.

/** Maildiensten voor iedereen: hun domein zegt niets over het bedrijf. */
export const VRIJE_MAILDOMEINEN = new Set([
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.nl', 'outlook.com', 'outlook.nl', 'live.com', 'live.nl', 'msn.com',
  'yahoo.com', 'yahoo.nl', 'icloud.com', 'me.com', 'mac.com', 'aol.com', 'protonmail.com', 'proton.me', 'gmx.com', 'gmx.net',
  'kpnmail.nl', 'kpnplanet.nl', 'planet.nl', 'ziggo.nl', 'home.nl', 'hetnet.nl', 'xs4all.nl', 'chello.nl', 'telfort.nl',
  'tele2.nl', 'online.nl', 'quicknet.nl', 'zeelandnet.nl', 'casema.nl', 'upcmail.nl', 'mail.com', 'web.de', 'skynet.be', 'telenet.be',
])

/** Kaal domein uit een website-veld, ook zonder https:// ervoor; leeg als het geen domein is. */
export function logoDomein(website?: string | null): string {
  const ruw = (website ?? '').trim()
  if (!ruw) return ''
  const domein = ruw.replace(/^[a-z]+:\/\//i, '').split(/[/?#]/)[0]?.replace(/^www\./i, '') ?? ''
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(domein) ? domein.toLowerCase() : ''
}

/** Gereserveerde topdomeinen (RFC 2606 en 6761): daar bestaat nooit een website, dus ook geen logo. */
const TESTDOMEINEN = /\.(test|example|invalid|localhost|local|internal)$/i

/** Of we bij dit domein een favicon mogen proberen op te halen. */
export function logoOphaalbaar(domein: string): boolean {
  return !!domein && !TESTDOMEINEN.test(domein)
}

/** De URL van het logo, of leeg: dan blijven de initialen staan. */
export function accountLogoUrl(a: { logoUrl?: string | null; website?: string | null; domein?: string | null; logoUit?: boolean | null }): string {
  const eigen = (a.logoUrl ?? '').trim()
  if (eigen) return eigen
  if (a.logoUit) return ''
  const domein = logoDomein(a.website) || logoDomein(a.domein)
  return logoOphaalbaar(domein) ? `/api/logo?domein=${encodeURIComponent(domein)}` : ''
}

/** Kandidaten uit de voorpagina: apple-touch-icon en icon-links, grootste eerst. */
export function iconLinks(html: string, basis: string): string[] {
  const uit: { href: string; maat: number }[] = []
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0]
    const rel = /\brel\s*=\s*["']?([^"'>]+)/i.exec(tag)?.[1]?.toLowerCase() ?? ''
    if (!/(^|\s)(icon|apple-touch-icon|apple-touch-icon-precomposed)(\s|$)/.test(rel)) continue
    const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]
    if (!href || href.startsWith('data:')) continue
    const maat = Number(/\bsizes\s*=\s*["']?(\d+)x\d+/i.exec(tag)?.[1] ?? (rel.includes('apple') ? 180 : 32))
    try { uit.push({ href: new URL(href, basis).toString(), maat }) } catch { /* ongeldige href */ }
  }
  return uit.sort((a, b) => b.maat - a.maat).map((x) => x.href)
}

/** Het domein uit een e-mailadres, behalve van een gratis maildienst. */
export function domeinUitEmail(email?: string | null): string {
  const d = String(email ?? '').trim().toLowerCase().split('@')[1] ?? ''
  if (!d || VRIJE_MAILDOMEINEN.has(d)) return ''
  return logoDomein(d)
}

/** Een website uit de eerste bruikbare e-mail (https://domein), of null. */
export function websiteUitEmail(...emails: (string | null | undefined)[]): string | null {
  for (const e of emails) {
    const d = domeinUitEmail(e)
    if (d) return `https://${d}`
  }
  return null
}
