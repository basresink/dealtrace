// Logo en website van een account (opzet uit DealDrive, useAccountLogo).
// Volgorde voor het logo: een eigen logo-URL wint; anders het favicon van het domein van de website
// (de gratis favicon-dienst van Google, zonder sleutel); bewust uitgezet of geen domein: de initialen.
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

/** De URL van het logo, of leeg: dan blijven de initialen staan. */
export function accountLogoUrl(a: { logoUrl?: string | null; website?: string | null; domein?: string | null; logoUit?: boolean | null }): string {
  const eigen = (a.logoUrl ?? '').trim()
  if (eigen) return eigen
  if (a.logoUit) return ''
  const domein = logoDomein(a.website) || logoDomein(a.domein)
  return domein ? `https://www.google.com/s2/favicons?sz=128&domain=${domein}` : ''
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
