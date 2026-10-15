// Route en kansen langs de route (P14, F10, ADR-016). Eén kansformule voor het scherm, de motor en
// de telefoon (gat 16): kansscore = basisscore + bronGewichten + tijdslotBonus - omrijMinuten.
// Reistijden komen van de routedienst; zonder routedienst de schatting (hemelsbreed maal 1,3 bij
// 60 km per uur) met het label "schatting".
import { PC2, PLAATSEN, type Punt } from './geoNL'
import { normPlaats, pc4 } from './gebieden'

export type { Punt }
export type GeoBron = 'adres' | 'postcode' | 'plaats'
export interface Reistijd { minuten: number; km: number; schatting: boolean }
export type ReistijdFn = (a: Punt, b: Punt) => Reistijd

/** Hemelsbrede afstand in kilometer (haversine). */
export function afstandKm(a: Punt, b: Punt): number {
  const r = 6371; const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad; const dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)))
}
/** De schatting zonder routedienst: hemelsbreed maal 1,3, bij 60 km per uur. */
export function schatReistijd(a: Punt, b: Punt): Reistijd {
  const km = afstandKm(a, b) * 1.3
  return { minuten: Math.round(km), km: Math.round(km * 10) / 10, schatting: true }
}

/** Een punt voor een account: eigen coördinaat (adres), anders postcode, anders plaats; buitenland zonder punt. */
export function geocodeerTerugval(account: { lat?: number | null; lng?: number | null; postcode?: string | null; plaats?: string | null; land?: string | null }, synoniemen: Record<string, string> = {}): (Punt & { bron: GeoBron }) | null {
  if (account.lat != null && account.lng != null) return { lat: account.lat, lng: account.lng, bron: 'adres' }
  if (account.land && !['nl', 'nederland', 'netherlands'].includes(account.land.toLowerCase())) return null
  const plaats = PLAATSEN[normPlaats(account.plaats, synoniemen)]
  const pc = pc4(account.postcode)
  // Een plaats uit het register is preciezer dan het middelpunt van een postcodegebied.
  if (pc !== null && !plaats) { const p = PC2[String(Math.floor(pc / 100))]; if (p) return { ...p, bron: 'postcode' } }
  if (plaats) return { ...plaats, bron: pc !== null ? 'postcode' : 'plaats' }
  return null
}

/** Extra reistijd om de kandidaat tussen twee opeenvolgende punten in te voegen; de beste plek wint. */
export function omrijMinuten(route: Punt[], kandidaat: Punt, reistijd: ReistijdFn = schatReistijd): { minuten: number; na: number; schatting: boolean } {
  if (!route.length) return { minuten: 0, na: -1, schatting: true }
  if (route.length === 1) { const t = reistijd(route[0]!, kandidaat); return { minuten: t.minuten * 2, na: 0, schatting: t.schatting } }
  let beste = { minuten: Infinity, na: 0, schatting: true }
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i]!; const b = route[i + 1]!
    const heen = reistijd(a, kandidaat); const terug = reistijd(kandidaat, b); const direct = reistijd(a, b)
    const m = Math.max(0, heen.minuten + terug.minuten - direct.minuten)
    if (m < beste.minuten) beste = { minuten: m, na: i, schatting: heen.schatting || terug.schatting || direct.schatting }
  }
  return beste
}

export interface RouteStop { id: string; start: string; eind: string; punt: Punt | null }
export interface Gat { start: string; eind: string; minuten: number; na: number }
/** Vrije momenten in de werkdag tussen de stops (gesorteerd op start); overlap telt als bezet. */
export function vrijeMomenten(stops: RouteStop[], werkdag: { start: string; eind: string }): Gat[] {
  const s = [...stops].sort((a, b) => a.start.localeCompare(b.start))
  const uit: Gat[] = []
  let vanaf = Date.parse(werkdag.start); let na = -1
  const tot = Date.parse(werkdag.eind)
  for (let i = 0; i < s.length; i++) {
    const b = Date.parse(s[i]!.start)
    if (b > vanaf) uit.push({ start: new Date(vanaf).toISOString(), eind: new Date(Math.min(b, tot)).toISOString(), minuten: Math.round((Math.min(b, tot) - vanaf) / 60_000), na })
    vanaf = Math.max(vanaf, Date.parse(s[i]!.eind)); na = i
  }
  if (tot > vanaf) uit.push({ start: new Date(vanaf).toISOString(), eind: new Date(tot).toISOString(), minuten: Math.round((tot - vanaf) / 60_000), na })
  return uit.filter((g) => g.minuten > 0)
}

export type BronSoort = 'bezoektaak' | 'klaargezet' | 'aanleiding' | 'ritme' | 'ongepland'
export interface KansBron { soort: BronSoort; label: string; relevantie?: number; dagenAchter?: number }
export interface KansGewichten { bezoektaak: number; klaargezet: number; aanleidingMin: number; aanleidingMax: number; ritmeMax: number; ongepland: number; tijdslot: number }
export const GEWICHTEN_STANDAARD: KansGewichten = { bezoektaak: 100, klaargezet: 90, aanleidingMin: 20, aanleidingMax: 40, ritmeMax: 30, ongepland: 10, tijdslot: 10 }
export interface KansRegels { gewichten: KansGewichten; maxOmrij: 10 | 20 | 30 | number; aantal: number | null; tijdslotMin: number; gatMin: number }
export const KANSREGELS_STANDAARD: KansRegels = { gewichten: GEWICHTEN_STANDAARD, maxOmrij: 20, aantal: 10, tijdslotMin: 30, gatMin: 75 }

export function bronGewicht(b: KansBron, g: KansGewichten): number {
  switch (b.soort) {
    case 'bezoektaak': return g.bezoektaak
    case 'klaargezet': return g.klaargezet
    case 'aanleiding': return Math.round(g.aanleidingMin + (g.aanleidingMax - g.aanleidingMin) * Math.max(0, Math.min(1, (b.relevantie ?? 50) / 100)))
    case 'ritme': return Math.min(g.ritmeMax, Math.max(0, Math.round(b.dagenAchter ?? 0)))
    case 'ongepland': return g.ongepland
  }
}
/** De kansscore met de opbouw; elke bijdrage staat terug in de opbouw. */
export function kansScore(basisscore: number, bronnen: KansBron[], omrij: number, tijdslot: boolean, g: KansGewichten = GEWICHTEN_STANDAARD): { score: number; opbouw: { label: string; punten: number }[] } {
  const opbouw = [
    { label: 'basisscore', punten: Math.round(basisscore) },
    ...bronnen.map((b) => ({ label: b.soort === 'ritme' ? 'ritme achter' : b.soort === 'aanleiding' ? 'hete aanleiding' : b.soort, punten: bronGewicht(b, g) })),
    ...(tijdslot ? [{ label: 'past in een vrij moment', punten: g.tijdslot }] : []),
    { label: `${Math.round(omrij)} min omrijden`, punten: -Math.round(omrij) },
  ]
  return { score: opbouw.reduce((s, x) => s + x.punten, 0), opbouw }
}

export interface Kandidaat {
  id: string; naam: string; punt: Punt | null; geoBron?: GeoBron | null; ownerId: string | null; soort: 'klant' | 'prospect'; nbStatus?: string | null
  afkoelingBezoekTot?: string | null; basisscore: number; klasse?: string | null; faseId?: string | null; regioId?: string | null; brancheId?: string | null
  bronnen: KansBron[]; contact?: { naam: string; rol: string | null } | null; laatsteContactOp?: string | null; taakId?: string | null
}
export interface KansFilters { ikId: string; alleenMijn: boolean; alleenProspects: boolean; maxOmrij: number; aantal: number | null; regioId?: string | null; bron?: BronSoort | null; klasse?: string | null; brancheId?: string | null; inRoute: Set<string>; overgeslagen: Set<string>; nu: Date }
export interface Kans extends Omit<Kandidaat, 'punt'> { punt: Punt; omrij: number; tussen: string; schatting: boolean; moment: string | null; momentStart: string | null; na: number; score: number; opbouw: { label: string; punten: number }[]; rang: number }

const tijd = (iso: string) => new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })

/**
 * Kansen langs de route. Route = start, de stops in volgorde, eind. Uitgesloten: al in de route,
 * nee, afkoeling op bezoek, van een collega (bij "Alleen mijn accounts"), overgeslagen, zonder bron.
 * Buiten de regio van de dag alleen binnen de maximale omrijtijd; in de regio tot tweemaal die tijd.
 */
export function kansenLangsRoute(route: { punten: Punt[]; stops: RouteStop[]; gaten: Gat[] }, kandidaten: Kandidaat[], f: KansFilters, regels: KansRegels = KANSREGELS_STANDAARD, reistijd: ReistijdFn = schatReistijd): Kans[] {
  const uit: Kans[] = []
  for (const k of kandidaten) {
    if (!k.punt || !k.bronnen.length) continue
    if (f.inRoute.has(k.id) || f.overgeslagen.has(k.id)) continue
    if (k.nbStatus === 'nee' || (k.afkoelingBezoekTot && Date.parse(k.afkoelingBezoekTot) > f.nu.getTime())) continue
    if (f.alleenMijn && k.ownerId !== f.ikId && !k.bronnen.some((b) => b.soort === 'klaargezet')) continue
    if (f.alleenProspects && k.soort !== 'prospect') continue
    if (f.bron && !k.bronnen.some((b) => b.soort === f.bron)) continue
    if (f.klasse && k.klasse !== f.klasse) continue
    if (f.brancheId && k.brancheId !== f.brancheId) continue
    const o = omrijMinuten(route.punten, k.punt, reistijd)
    const grens = f.regioId && k.regioId === f.regioId ? f.maxOmrij * 2 : f.maxOmrij
    if (o.minuten > grens) continue
    // Segment na = tussen punten[na] en punten[na + 1]: na stop na (0 is het startpunt); het gat erbij heeft na - 1.
    const gat = route.gaten.find((g) => g.na === o.na - 1) ?? null
    const past = !!gat && gat.minuten >= regels.tijdslotMin + o.minuten
    const { score, opbouw } = kansScore(k.basisscore, k.bronnen, o.minuten, past, regels.gewichten)
    const tussen = route.stops.length === 0 ? 'vanaf je startpunt' : o.na === 0 ? 'voor stop 1' : o.na >= route.stops.length ? `na stop ${route.stops.length}` : `tussen stop ${o.na} en ${o.na + 1}`
    uit.push({ ...k, punt: k.punt, omrij: o.minuten, tussen, schatting: o.schatting, moment: past && gat ? `${gat.minuten} min vrij tussen ${tijd(gat.start)} en ${tijd(gat.eind)}` : null, momentStart: past && gat ? new Date(Date.parse(gat.start) + o.minuten * 30_000).toISOString() : null, na: o.na, score, opbouw, rang: 0 })
  }
  uit.sort((a, b) => b.score - a.score || a.omrij - b.omrij || a.naam.localeCompare(b.naam))
  return (f.aantal ? uit.slice(0, f.aantal) : uit).map((k, i) => ({ ...k, rang: i + 1 }))
}

/** De bellijst naast je bezoeken: sluit alleen accounts uit die je op dezelfde dag bezoekt (gat 30). */
export function bellijstNaastBezoeken<T extends { accountId: string }>(kandidaten: T[], bezoekenVandaag: Set<string>, n: number): T[] {
  return kandidaten.filter((k) => !bezoekenVandaag.has(k.accountId)).slice(0, n)
}

/** Dagstatistiek: bezoeken, klantcontact, rijtijd en kilometers langs de route. */
export function dagStatistiek(punten: Punt[], stops: RouteStop[], reistijd: ReistijdFn = schatReistijd): { bezoeken: number; contactMin: number; rijMin: number; km: number; schatting: boolean } {
  let rij = 0; let km = 0; let schatting = false
  for (let i = 0; i < punten.length - 1; i++) { const t = reistijd(punten[i]!, punten[i + 1]!); rij += t.minuten; km += t.km; schatting ||= t.schatting }
  return { bezoeken: stops.length, contactMin: stops.reduce((s, x) => s + Math.round((Date.parse(x.eind) - Date.parse(x.start)) / 60_000), 0), rijMin: rij, km: Math.round(km), schatting }
}
export const duurLabel = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}u${min % 60 ? ` ${String(min % 60).padStart(2, '0')}` : ''}` : `${min} min`)

/** Redenen om een kans over te slaan; hij komt dan 7 dagen niet terug. */
export const OVERSLA_REDENEN = ['Geen tijd', 'Klopt niet', 'Al gesproken', 'Niet interessant', 'Anders']

export type Kaartapp = 'google' | 'apple' | 'waze'
/** Diepe link naar de kaartapp uit Mijn instellingen (8.6). */
export function kaartLink(doel: { adres?: string | null; punt?: Punt | null }, app: Kaartapp = 'google'): string | null {
  const q = doel.adres?.trim() ? encodeURIComponent(doel.adres.trim()) : doel.punt ? `${doel.punt.lat},${doel.punt.lng}` : null
  if (!q) return null
  if (app === 'apple') return `https://maps.apple.com/?daddr=${q}`
  if (app === 'waze') return doel.punt ? `https://waze.com/ul?ll=${doel.punt.lat},${doel.punt.lng}&navigate=yes` : `https://waze.com/ul?q=${q}&navigate=yes`
  return `https://www.google.com/maps/dir/?api=1&destination=${q}`
}

// ── Onderweg (P30, 8.5.2): tijdlijn, vertrek, dichtstbijzijnd, aanwezig ────

export type StopStatus = 'gepland' | 'onderweg' | 'bezig' | 'afgerond' | 'zonder-verslag'
export interface DagStop { id: string; start: string; eind: string; status: 'gepland' | 'afgerond' | 'niet_verschenen' | 'geannuleerd' | string; punt: Punt | null; accountId?: string | null; [k: string]: unknown }
export type TijdlijnRij<S, K> = { soort: 'stop'; stop: S; status: StopStatus; reistijdNaar: number | null } | { soort: 'kans'; kans: K }

/** Vertrektijd naar een stop en of die rood is (vertrek binnen 15 minuten of al voorbij). */
export function vertrekMoment(stop: { start: string }, reistijdMin: number, nu: Date): { vertrek: string; rood: boolean; minutenTotVertrek: number } {
  const vertrek = Date.parse(stop.start) - reistijdMin * 60_000
  const min = Math.round((vertrek - nu.getTime()) / 60_000)
  return { vertrek: new Date(vertrek).toISOString(), rood: min <= 15, minutenTotVertrek: min }
}

/**
 * De tijdlijn van de dag: geannuleerde stops vallen weg, per stop een status (een voorbije stop
 * zonder afronding is "zonder-verslag"), de reistijd vanaf de vorige plek en kansen als tussenrij
 * na de stop waarachter ze passen (`na`: 0 is voor de eerste stop).
 */
export function routeVanDag<S extends DagStop, K extends { na?: number | null }>(stops: S[], kansen: K[], reistijden: (number | null)[], nu: Date): TijdlijnRij<S, K>[] {
  const actief = stops.filter((s) => s.status !== 'geannuleerd').sort((a, b) => a.start.localeCompare(b.start))
  const t = nu.getTime()
  const uit: TijdlijnRij<S, K>[] = []
  const volgende = actief.find((s) => s.status === 'gepland' && Date.parse(s.eind) > t)
  const kansNa = (i: number) => kansen.filter((k) => (k.na ?? actief.length) === i).forEach((k) => uit.push({ soort: 'kans', kans: k }))
  kansNa(0)
  actief.forEach((s, i) => {
    const bezig = s.status === 'gepland' && Date.parse(s.start) <= t && Date.parse(s.eind) > t
    const status: StopStatus = s.status === 'afgerond' ? 'afgerond' : s.status === 'niet_verschenen' ? 'afgerond' : bezig ? 'bezig' : Date.parse(s.eind) <= t ? 'zonder-verslag' : s === volgende && Date.parse(s.start) - t < 2 * 3600_000 ? 'onderweg' : 'gepland'
    uit.push({ soort: 'stop', stop: s, status, reistijdNaar: reistijden[i] ?? null })
    kansNa(i + 1)
  })
  return uit
}

/** De n dichtstbijzijnde accounts op hemelsbrede afstand; zonder punt telt niet mee. */
export function dichtstbijzijnd<T extends { punt?: Punt | null; naam?: string }>(plek: Punt, accounts: T[], n: number): (T & { km: number })[] {
  return accounts.filter((a) => a.punt).map((a) => ({ ...a, km: Math.round(afstandKm(plek, a.punt!) * 10) / 10 }))
    .sort((a, b) => a.km - b.km || String(a.naam ?? '').localeCompare(String(b.naam ?? ''))).slice(0, n)
}

/** Aanwezig bij een afspraak: binnen 300 m, van 15 minuten voor de start tot het einde. */
export function isAanwezig(plek: Punt, afspraak: { start: string; eind: string; punt: Punt | null }, nu: Date): boolean {
  if (!afspraak.punt) return false
  const t = nu.getTime()
  if (t < Date.parse(afspraak.start) - 15 * 60_000 || t > Date.parse(afspraak.eind)) return false
  return afstandKm(plek, afspraak.punt) <= 0.3
}

/** De maat van een verkleinde foto: de langste zijde hooguit `max`; kleiner blijft gelijk. */
export function verkleinMaat(breedte: number, hoogte: number, max = 1600): { breedte: number; hoogte: number } {
  const lang = Math.max(breedte, hoogte)
  if (lang <= max) return { breedte, hoogte }
  const f = max / lang
  return { breedte: Math.round(breedte * f), hoogte: Math.round(hoogte * f) }
}
