// Gebieden en regiodagen (P14, F18). Een regio is een set postcodereeksen van vier cijfers met
// plaatsen als vangnet; postcode gaat voor plaats, een buitenlandse postcode valt nooit in een
// Nederlandse reeks, overlap wordt bij invoer geblokkeerd (gat 45) en plaatsnamen hebben synoniemen.
import { SYNONIEMEN_STANDAARD } from './geoNL'

export type Weken = 'alle' | 'even' | 'oneven'
export interface Reeks { van: number; tot: number }
export interface Regiodag { gebruikerId: string; weekdag: number; weken: Weken }
export interface Regio { id: string; naam: string; reeksen: Reeks[]; plaatsen: string[]; eigenaren: { buitendienst: string[]; binnendienst: string[] }; dagen: Regiodag[] }

/** Plaatsnaam normaliseren: kleine letters, zonder dubbele spaties, met het synoniem uit de lijst. */
export function normPlaats(plaats: string | null | undefined, synoniemen: Record<string, string> = {}): string {
  const p = String(plaats ?? '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/^'?s\s?-?\s?/, (m) => (m.includes('s') ? "'s-" : m))
  const alle = { ...SYNONIEMEN_STANDAARD, ...Object.fromEntries(Object.entries(synoniemen).map(([k, v]) => [k.toLowerCase(), v.toLowerCase()])) }
  return alle[p] ?? alle[p.replace(/^'s-/, 's-')] ?? p
}

/** De vier cijfers van een Nederlandse postcode, of null (buitenland, leeg, onzin). */
export function pc4(postcode: string | null | undefined, land?: string | null): number | null {
  if (land && !['nl', 'nederland', 'netherlands'].includes(land.toLowerCase())) return null
  const m = /^\s*([1-9]\d{3})\s?[a-z]{2}\s*$/i.exec(String(postcode ?? '')) ?? /^\s*([1-9]\d{3})\s*$/.exec(String(postcode ?? ''))
  return m ? Number(m[1]) : null
}

/** De regio van een account: eerst op postcode, dan op plaats (met synoniem). */
export function regioVan(account: { postcode?: string | null; plaats?: string | null; land?: string | null }, regios: Regio[], synoniemen: Record<string, string> = {}): string | null {
  const pc = pc4(account.postcode, account.land)
  if (pc !== null) {
    const r = regios.find((x) => x.reeksen.some((s) => pc >= s.van && pc <= s.tot))
    if (r) return r.id
  }
  if (account.land && !['nl', 'nederland', 'netherlands'].includes(account.land.toLowerCase())) return null
  const p = normPlaats(account.plaats, synoniemen)
  if (!p) return null
  return regios.find((x) => x.plaatsen.some((q) => normPlaats(q, synoniemen) === p))?.id ?? null
}

/** Overlappende reeksen tussen regio's; aangrenzende reeksen (3799 en 3800) zijn geen overlap. Ook dubbele plaatsen. */
export function overlap(regios: Regio[], synoniemen: Record<string, string> = {}): { a: string; b: string; tekst: string }[] {
  const uit: { a: string; b: string; tekst: string }[] = []
  for (let i = 0; i < regios.length; i++) for (let j = i + 1; j < regios.length; j++) {
    const a = regios[i]!; const b = regios[j]!
    for (const x of a.reeksen) for (const y of b.reeksen) {
      if (x.van <= y.tot && y.van <= x.tot) uit.push({ a: a.id, b: b.id, tekst: `Postcode ${Math.max(x.van, y.van)} valt al in ${a.naam}. Haal hem daar eerst weg of kies een andere reeks.` })
    }
    const pa = new Set(a.plaatsen.map((p) => normPlaats(p, synoniemen)))
    for (const p of b.plaatsen) if (pa.has(normPlaats(p, synoniemen))) uit.push({ a: a.id, b: b.id, tekst: `${p} staat al bij ${a.naam}. Haal de plaats daar eerst weg.` })
  }
  return uit
}

/** Reeksen controleren: vier cijfers, van niet groter dan tot. */
export function valideerRegios(regios: Regio[]): string[] {
  const f: string[] = []
  for (const r of regios) {
    if (!String(r.naam ?? '').trim()) f.push('Elke regio heeft een naam')
    for (const s of r.reeksen ?? []) if (!(Number.isInteger(s.van) && Number.isInteger(s.tot) && s.van >= 1000 && s.tot <= 9999 && s.van <= s.tot)) f.push(`${r.naam}: een reeks is van vier cijfers, van tot en met tot`)
    for (const d of r.dagen ?? []) if (!(d.weekdag >= 1 && d.weekdag <= 5)) f.push(`${r.naam}: een regiodag valt op maandag tot en met vrijdag`)
  }
  return f
}

/** ISO-weeknummer van een datum (JJJJ-MM-DD). */
export function weeknummer(datum: string): number {
  const d = new Date(`${datum}T12:00:00Z`)
  const dag = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dag + 3)
  const eersteDonderdag = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  return 1 + Math.round(((d.getTime() - eersteDonderdag.getTime()) / 864e5 - 3 + ((eersteDonderdag.getUTCDay() + 6) % 7)) / 7)
}

/** De regio van een gebruiker op een datum (even en oneven weken, feestdagen vallen af). */
export function regiodagVan(gebruikerId: string, datum: string, regios: Regio[], feestdagen: string[] = []): Regio | null {
  if (feestdagen.includes(datum)) return null
  const wd = new Date(`${datum}T12:00:00Z`).getUTCDay()
  const wk = weeknummer(datum)
  return regios.find((r) => r.dagen.some((d) => d.gebruikerId === gebruikerId && d.weekdag === wd && (d.weken === 'alle' || (d.weken === 'even') === (wk % 2 === 0)))) ?? null
}

/** Regiodagen van alle gebruikers voor de komende dagen, voor de landing in de motor. */
export function regiodagenVoor(regios: Regio[], vanaf: string, dagen: number, feestdagen: string[] = []): { gebiedId: string; gebruikerId: string; datum: string }[] {
  const uit: { gebiedId: string; gebruikerId: string; datum: string }[] = []
  for (let i = 0; i < dagen; i++) {
    const d = new Date(Date.parse(`${vanaf}T12:00:00Z`) + i * 864e5).toISOString().slice(0, 10)
    for (const r of regios) for (const g of new Set(r.dagen.map((x) => x.gebruikerId))) if (regiodagVan(g, d, [r], feestdagen)) uit.push({ gebiedId: r.id, gebruikerId: g, datum: d })
  }
  return uit
}

/** Een voorstel uit de portefeuille: groepeer op het eerste cijfer van de postcode. */
export function voorstelUitAccounts(accounts: { postcode?: string | null; plaats?: string | null }[]): Regio[] {
  const groepen = new Map<number, { aantal: number; plaatsen: Map<string, number> }>()
  for (const a of accounts) {
    const pc = pc4(a.postcode)
    if (pc === null) continue
    const k = Math.floor(pc / 1000)
    const g = groepen.get(k) ?? { aantal: 0, plaatsen: new Map() }
    g.aantal++
    if (a.plaats) g.plaatsen.set(a.plaats, (g.plaatsen.get(a.plaats) ?? 0) + 1)
    groepen.set(k, g)
  }
  return [...groepen.entries()].sort((a, b) => a[0] - b[0]).map(([k, g]) => {
    const grootste = [...g.plaatsen.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    return { id: `regio-${k}`, naam: `Regio ${grootste ?? k}`, reeksen: [{ van: k * 1000, tot: k * 1000 + 999 }], plaatsen: [], eigenaren: { buitendienst: [], binnendienst: [] }, dagen: [] }
  })
}

export interface DekkingRij { regioId: string | null; naam: string; regiodag: string | null; klanten: number; prospects: number; nietBenaderd: number; bezocht: number; stil: number; nooit: number; dekking: number }
const WEEKDAG = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag']
/** Dekking per regio: hoeveel accounts in de periode bezocht zijn, stil (langer dan 90 dagen) of nooit; altijd een rij "Zonder regio". */
export function dekking(accounts: { id: string; regioId: string | null; soort: 'klant' | 'prospect'; nbStatus?: string | null }[], bezoeken: { accountId: string; op: string }[], regios: Regio[], nu: Date, periodeDagen = 90): DekkingRij[] {
  const laatste = new Map<string, number>()
  for (const b of bezoeken) laatste.set(b.accountId, Math.max(laatste.get(b.accountId) ?? 0, Date.parse(b.op)))
  const grens = nu.getTime() - periodeDagen * 864e5
  const rij = (regioId: string | null, naam: string, regiodag: string | null): DekkingRij => {
    const hier = accounts.filter((a) => a.regioId === regioId)
    const bezocht = hier.filter((a) => (laatste.get(a.id) ?? 0) >= grens).length
    const nooit = hier.filter((a) => !laatste.has(a.id)).length
    return { regioId, naam, regiodag, klanten: hier.filter((a) => a.soort === 'klant').length, prospects: hier.filter((a) => a.soort === 'prospect').length, nietBenaderd: hier.filter((a) => a.soort === 'prospect' && (a.nbStatus ?? 'nieuw') === 'nieuw').length, bezocht, stil: hier.length - bezocht - nooit, nooit, dekking: hier.length ? Math.round((bezocht / hier.length) * 100) : 0 }
  }
  return [...regios.map((r) => rij(r.id, r.naam, [...new Set(r.dagen.map((d) => WEEKDAG[d.weekdag]))].join(', ') || null)), rij(null, 'Zonder regio', null)]
}
