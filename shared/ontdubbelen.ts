// Ontdubbelen (15.1): KvK gelijk is altijd een duplicaat; anders domein zonder
// www.; anders genormaliseerde naam met Sørensen-Dice (80 procent zeker, 60 mogelijk).

export interface AccountKandidaat { id?: string; name: string; kvk?: string | null; domein?: string | null; city?: string | null; postcode?: string | null; accountKind?: string }
export type Duplicaat = { soort: 'zeker' | 'mogelijk' | 'geen'; match?: AccountKandidaat; op?: 'kvk' | 'domein' | 'naam'; gelijkenis?: number }

const RECHTSVORMEN = /\b(b\.?\s?v\.?|n\.?\s?v\.?|v\.?o\.?f\.?|c\.?v\.?|holding|group|groep|beheer)\b/g

export function normaliseerNaam(naam: string): string {
  return naam.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(RECHTSVORMEN, ' ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')
}

export function normaliseerDomein(d: string | null | undefined): string | null {
  if (!d) return null
  const t = d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0]!
  return t || null
}

function bigrammen(t: string): Map<string, number> {
  const s = t.replace(/\s+/g, '')
  const m = new Map<string, number>()
  for (let i = 0; i < s.length - 1; i++) {
    const b = s.slice(i, i + 2)
    m.set(b, (m.get(b) ?? 0) + 1)
  }
  return m
}

/** Sørensen-Dice op letterparen, 0 tot 1. */
export function dice(a: string, b: string): number {
  if (a === b) return a.length ? 1 : 0
  const x = bigrammen(a)
  const y = bigrammen(b)
  let gedeeld = 0
  let totaal = 0
  for (const v of x.values()) totaal += v
  for (const v of y.values()) totaal += v
  for (const [k, v] of x) gedeeld += Math.min(v, y.get(k) ?? 0)
  return totaal ? (2 * gedeeld) / totaal : 0
}

export function zoekDuplicaat(kandidaat: AccountKandidaat, bestand: AccountKandidaat[]): Duplicaat {
  const anderen = bestand.filter((b) => !kandidaat.id || b.id !== kandidaat.id)
  const kvk = kandidaat.kvk?.replace(/\D/g, '')
  if (kvk) {
    const m = anderen.find((b) => b.kvk?.replace(/\D/g, '') === kvk)
    if (m) return { soort: 'zeker', match: m, op: 'kvk', gelijkenis: 1 }
  }
  const domein = normaliseerDomein(kandidaat.domein)
  if (domein) {
    const m = anderen.find((b) => normaliseerDomein(b.domein) === domein)
    if (m) return { soort: 'zeker', match: m, op: 'domein', gelijkenis: 1 }
  }
  const naam = normaliseerNaam(kandidaat.name)
  // Import (F02): heeft de kandidaat een postcode, dan geldt naam plus postcode
  // (80 procent zeker, 60 mogelijk); zonder postcode de naamregel uit 15.1.
  const pc = (p?: string | null) => (p ?? '').replace(/\s/g, '').toUpperCase()
  if (pc(kandidaat.postcode)) {
    let besteMetPc: { m: AccountKandidaat; g: number } | null = null
    for (const b of anderen) {
      if (pc(b.postcode) !== pc(kandidaat.postcode)) continue
      const g = dice(naam, normaliseerNaam(b.name))
      if (!besteMetPc || g > besteMetPc.g) besteMetPc = { m: b, g }
    }
    if (besteMetPc && besteMetPc.g >= 0.8) return { soort: 'zeker', match: besteMetPc.m, op: 'naam', gelijkenis: besteMetPc.g }
    if (besteMetPc && besteMetPc.g >= 0.6) return { soort: 'mogelijk', match: besteMetPc.m, op: 'naam', gelijkenis: besteMetPc.g }
    return { soort: 'geen' }
  }
  let beste: { m: AccountKandidaat; g: number } | null = null
  for (const b of anderen) {
    const g = dice(naam, normaliseerNaam(b.name))
    if (!beste || g > beste.g) beste = { m: b, g }
  }
  if (beste && beste.g >= 0.8) return { soort: 'zeker', match: beste.m, op: 'naam', gelijkenis: beste.g }
  if (beste && beste.g >= 0.6) return { soort: 'mogelijk', match: beste.m, op: 'naam', gelijkenis: beste.g }
  return { soort: 'geen' }
}

export interface ContactKandidaat { id?: string; accountId: string; firstName?: string | null; lastName: string; email?: string | null }

/** Contacten: exact op e-mail (in de hele organisatie), anders volledige naam binnen hetzelfde bedrijf. */
export function contactDuplicaat(nieuw: ContactKandidaat, bestaand: ContactKandidaat[]): ContactKandidaat | null {
  const anderen = bestaand.filter((b) => !nieuw.id || b.id !== nieuw.id)
  const email = nieuw.email?.trim().toLowerCase()
  if (email) {
    const m = anderen.find((b) => b.email?.trim().toLowerCase() === email)
    if (m) return m
  }
  const volledig = (c: ContactKandidaat) => normaliseerNaam(`${c.firstName ?? ''} ${c.lastName}`)
  return anderen.find((b) => b.accountId === nieuw.accountId && volledig(b) === volledig(nieuw)) ?? null
}
