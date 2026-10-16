// Ontdubbelen (15.1): KvK gelijk is altijd een duplicaat; anders domein zonder
// www.; anders genormaliseerde naam met Sørensen-Dice (80 procent zeker, 60 mogelijk).
// Een naamtreffer met een ander getal in de naam of een andere plaats is hooguit
// "mogelijk dubbel" (B12): Vestiging 2 in Utrecht is niet zeker Vestiging 1 in Zwolle.

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

const getallen = (naam: string) => (normaliseerNaam(naam).match(/\d+/g) ?? []).join(' ')
const plaats = (p?: string | null) => normaliseerNaam(p ?? '')

/** Een naamtreffer is alleen zeker als de getallen in de naam gelijk zijn en de plaats niet verschilt (B12). */
function naamUitslag(kandidaat: AccountKandidaat, m: AccountKandidaat, g: number): Duplicaat {
  if (g < 0.6) return { soort: 'geen' }
  const zeker = g >= 0.8 && getallen(kandidaat.name) === getallen(m.name) && !(plaats(kandidaat.city) && plaats(m.city) && plaats(kandidaat.city) !== plaats(m.city))
  return { soort: zeker ? 'zeker' : 'mogelijk', match: m, op: 'naam', gelijkenis: g }
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
    return besteMetPc ? naamUitslag(kandidaat, besteMetPc.m, besteMetPc.g) : { soort: 'geen' }
  }
  let beste: { m: AccountKandidaat; g: number } | null = null
  for (const b of anderen) {
    const g = dice(naam, normaliseerNaam(b.name))
    if (!beste || g > beste.g) beste = { m: b, g }
  }
  return beste ? naamUitslag(kandidaat, beste.m, beste.g) : { soort: 'geen' }
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

export interface ContactNieuw { firstName?: string | null; lastName: string; email?: string | null; telefoon?: string | null; functie?: string | null; linkedin?: string | null }
/**
 * Nieuwe contacten (Datacollectief, import) tegen de contacten van een account (15.1): exacte
 * e-mail wint, anders de volledige naam. Een treffer met lege velden wordt bijgewerkt; wat al
 * gevuld is blijft (de bronprioriteit zit in magOverschrijven). Dubbelen in de nieuwe lijst tellen één keer.
 */
export function voegContactenSamen<B extends ContactKandidaat & { telefoon?: string | null; functie?: string | null }>(bestaand: B[], nieuw: ContactNieuw[]): { toevoegen: ContactNieuw[]; bijwerken: { id: string; velden: Partial<ContactNieuw> }[]; overslaan: ContactNieuw[] } {
  const uit = { toevoegen: [] as ContactNieuw[], bijwerken: [] as { id: string; velden: Partial<ContactNieuw> }[], overslaan: [] as ContactNieuw[] }
  const gezien: ContactKandidaat[] = [...bestaand]
  for (const n of nieuw) {
    const kandidaat: ContactKandidaat = { accountId: bestaand[0]?.accountId ?? '', firstName: n.firstName, lastName: n.lastName, email: n.email }
    const match = contactDuplicaat(kandidaat, gezien) as (B & { id?: string }) | null
    if (!match) { uit.toevoegen.push(n); gezien.push(kandidaat); continue }
    if (!match.id) { uit.overslaan.push(n); continue }
    const velden: Partial<ContactNieuw> = {}
    if (!match.email && n.email) velden.email = n.email
    if (!(match as any).telefoon && n.telefoon) velden.telefoon = n.telefoon
    if (!(match as any).functie && n.functie) velden.functie = n.functie
    if (Object.keys(velden).length) uit.bijwerken.push({ id: match.id, velden })
    else uit.overslaan.push(n)
  }
  return uit
}

/** Visitekaartje (P31): hoofdletters in namen, telefoon naar E.164, e-mail in kleine letters; lege velden weg. */
export function normaliseerVisitekaartje(k: { naam?: string | null; functie?: string | null; bedrijf?: string | null; telefoon?: string | null; email?: string | null }, telefoonNaarE164: (t: string) => string | null): { voornaam: string | null; achternaam: string; functie: string | null; bedrijf: string | null; telefoon: string | null; email: string | null } {
  const schoon = (s?: string | null) => (s ?? '').replace(/\s+/g, ' ').trim()
  const tussen = new Set(['van', 'de', 'der', 'den', 'het', 'ter', 'ten', 'te', "'t"])
  const delen = schoon(k.naam).split(' ').filter(Boolean).map((w, i) => (i > 0 && tussen.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
  const email = schoon(k.email).toLowerCase()
  return {
    voornaam: delen.length > 1 ? delen[0]! : null, achternaam: delen.length > 1 ? delen.slice(1).join(' ') : delen[0] ?? '',
    functie: schoon(k.functie) || null, bedrijf: schoon(k.bedrijf) || null,
    telefoon: k.telefoon ? telefoonNaarE164(k.telefoon) : null, email: /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(email) ? email : null,
  }
}

/** Is er al een contact bij dit account met dezelfde e-mail of hetzelfde nummer? */
export function visitekaartjeDuplicaat<C extends { id: string; email?: string | null; telefoon?: string | null; mobiel?: string | null }>(nieuw: { email: string | null; telefoon: string | null }, bestaand: C[]): C | null {
  return bestaand.find((c) => (nieuw.email && c.email?.toLowerCase() === nieuw.email) || (nieuw.telefoon && [c.telefoon, c.mobiel].includes(nieuw.telefoon))) ?? null
}
