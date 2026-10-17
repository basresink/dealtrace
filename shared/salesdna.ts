// SalesDNA-spiegel (P29, F25, ADR-002, ADR-017): pure functies voor de webhook (tijdvenster,
// dubbel, gat in de versies, inhoudelijke wijziging), de vertaling van een gespiegelde sublaag
// naar hetzelfde concept als de eigen inrichting (zodat de projectie één pad heeft) en het mappen
// op naam bij overstappen. De handtekening (crypto) staat in server/utils/salesdnaWebhook.ts.
import { CONCURRENT_SOORTEN, leesAlsDeKlantZegt, type Concepten, type Onderdeel } from './verkoopverhaal'

/** Onderwerp-id in SalesDNA naar het onderdeel in Dealtrace. De golden circle heet L0.11 (open vraag 19); L0.0 accepteren we ook. */
export const ONDERWERP_NAAR_ONDERDEEL: Record<string, Onderdeel> = {
  'L0.11': 'golden_circle', 'L0.0': 'golden_circle', 'L0.1': 'bedrijfsverhaal', 'L0.2': 'ambitie', 'L0.4': 'waarde',
  'L0.6': 'branches', 'L0.8': 'concurrenten', 'L2.1': 'winpunten', 'L3.14': 'terugkomregels',
}
export const ONDERDEEL_NAAR_ONDERWERP: Record<Onderdeel, string> = {
  golden_circle: 'L0.11', bedrijfsverhaal: 'L0.1', ambitie: 'L0.2', waarde: 'L0.4', branches: 'L0.6', concurrenten: 'L0.8', winpunten: 'L2.1', terugkomregels: 'L3.14',
}
/** Waar je het onderdeel in SalesDNA wijzigt ("Wijzigen doe je in SalesDNA, Salesbasis, Branches."). */
export const PLEK_IN_SALESDNA: Record<Onderdeel, string> = {
  golden_circle: 'Salesbasis, Golden circle', bedrijfsverhaal: 'Salesbasis, Bedrijfsverhaal', ambitie: 'Salesbasis, Ambitie en visie', waarde: 'Salesbasis, Waarde en belofte',
  branches: 'Salesbasis, Branches', concurrenten: 'Salesbasis, Concurrenten', winpunten: 'Verkoopaanpak, Winpunten', terugkomregels: 'Klantrelatie, Hercontact-ritme',
}
export const SOORTEN = ['sublaag.bevestigd', 'sublaag.verouderd', 'sublaag.verouderd-gesloten', 'sublaag.leeg', 'sublaag.overgeslagen', 'ping'] as const
export type Soort = typeof SOORTEN[number]

export const TIJDVENSTER_MS = 5 * 60 * 1000
/** Hooguit 5 minuten verschil met de servertijd, in beide richtingen. */
export function binnenTijdvenster(tijd: string | null | undefined, nu: Date): boolean {
  const t = Date.parse(tijd ?? '')
  return Number.isFinite(t) && Math.abs(nu.getTime() - t) <= TIJDVENSTER_MS
}

/** Dubbel op event-id, of hetzelfde onderwerp met dezelfde versie onder een ander event-id. */
export function isDubbel(e: { eventId: string; soort?: string; onderwerpId?: string | null; versie?: number | null }, bekend: { eventIds: Set<string> | string[]; versies: Set<string> | string[] }): boolean {
  const ids = bekend.eventIds instanceof Set ? bekend.eventIds : new Set(bekend.eventIds)
  const versies = bekend.versies instanceof Set ? bekend.versies : new Set(bekend.versies)
  if (ids.has(e.eventId)) return true
  return e.soort === 'sublaag.bevestigd' && !!e.onderwerpId && e.versie != null && versies.has(`${e.onderwerpId}:${e.versie}`)
}

/** Gat in de versies: meer dan één stap vooruit. De eerste ontvangst (0) is geen gat; een oudere versie ook niet (die negeren we). */
export const heeftGat = (huidig: number, nieuw: number) => huidig > 0 && nieuw > huidig + 1
export const isOud = (huidig: number, nieuw: number) => nieuw <= huidig

const stabiel = (v: unknown): string => Array.isArray(v) ? `[${v.map(stabiel).join(',')}]`
  : v && typeof v === 'object' ? `{${Object.keys(v as object).filter((k) => !k.startsWith('_toelichting')).sort().map((k) => `${JSON.stringify(k)}:${stabiel((v as any)[k])}`).join(',')}}`
    : JSON.stringify(v ?? null)
/** Inhoudelijk gewijzigd: alleen de inhoud telt, niet bijgewerktOp. Een gewijzigd blok per branche telt wel (C.9 punt 7). */
export function isInhoudelijkGewijzigd(oud: { inhoud?: unknown } | null | undefined, nieuw: { inhoud?: unknown }): boolean {
  return stabiel(oud?.inhoud ?? null) !== stabiel(nieuw.inhoud ?? null)
}

const SOORT: Record<string, keyof typeof CONCURRENT_SOORTEN> = { 'concurrent-direct': 'direct', 'concurrent-indirect': 'indirect', 'concurrent-intern': 'intern', 'niets-doen': 'niets' }
const KANAAL: Record<string, string> = { telefoon: 'Telefoon', 'e-mail': 'E-mail', email: 'E-mail', bezoek: 'Bezoek', linkedin: 'LinkedIn' }
export const TERMIJN_DAGEN: Record<string, number> = { direct: 0, 'over-een-maand': 30, 'over-2-maanden': 61, 'over-een-kwartaal': 91, 'over-een-halfjaar': 182, 'over-een-jaar': 365 }
/** "verloren-offerte" wordt "Verloren offerte"; een code zonder streepjes blijft staan. */
export const labelVanCode = (code: string | null | undefined) => { const t = (code ?? '').trim(); return t.includes('-') && t === t.toLowerCase() ? t.charAt(0).toUpperCase() + t.slice(1).replace(/-/g, ' ') : t }
const termijnLabel = (code: string) => (code === 'direct' ? 'direct' : labelVanCode(code))
const lijstVan = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : String(v ?? '').split(',')).map((x) => x.trim()).filter(Boolean)
const rolLabel = (r: string) => { const t = r.replace(/^rol-/, ''); return t.charAt(0).toUpperCase() + t.slice(1).replace(/-/g, ' ') }

export interface Spiegel { inhoud: any; context?: any }
/**
 * Een gespiegelde sublaag als concept, in dezelfde vorm als de eigen inrichting. Eigen aanvullingen
 * die SalesDNA niet kent (termijn in dagen, hoofdfase van de reis, weging, hercontactritme, wie het oppakt) komen uit
 * het huidige concept, op id.
 */
export function spiegelNaarConcept<O extends Onderdeel>(onderdeel: O, s: Spiegel, huidig?: Partial<Concepten[O]> | null): Concepten[O] {
  const i = s.inhoud ?? {}
  const veld = (k: string) => (i.velden ?? []).find((v: any) => v.sleutel === k)?.tekst ?? undefined
  const h = (huidig ?? {}) as any
  const opId = <T extends { id: string }>(lijst: T[] | undefined, id: string) => (lijst ?? []).find((x) => x.id === id)
  let c: any
  switch (onderdeel) {
    case 'golden_circle': c = { waarom: veld('waarom'), hoe: veld('hoe'), wat: veld('wat') }; break
    case 'bedrijfsverhaal': c = { wieZijnWij: veld('bedrijfsverhaal') ?? veld('wieZijnWij'), kernzin: veld('kernzin') ?? h.kernzin ?? null, perBranche: Object.fromEntries((i.perBranche ?? []).filter((b: any) => b.verhaal).map((b: any) => [b.branche, b.verhaal])) }; break
    case 'ambitie': c = { ambitie: veld('ambitie'), visie: veld('visie'), missie: veld('missie') }; break
    case 'waarde': c = { kernbelofte: veld('kernbelofte'), waardestatement: veld('waardestatement'), perBranche: Object.fromEntries((i.perBranche ?? []).map((b: any) => [b.branche, { kernbelofte: b.kernbelofte, waardestatement: b.waardestatement }])) }; break
    case 'branches': c = { items: (i.rijen ?? []).map((b: any) => ({ id: b._id, naam: b.branche ?? b.naam, focus: b.focus, horizon: b.horizon ?? undefined, termijn: b.termijn ?? null, prioriteit: b.prioriteit ?? null, actief: true })) }; break
    case 'concurrenten': c = { items: (i.rijen ?? []).map((x: any) => ({
      id: x._id, naam: x.concurrent ?? x.naam, soort: SOORT[x.soortConcurrent] ?? 'direct', sterk: x.sterk, zwak: x.zwak, onderscheid: x.onderscheid, zoZegJeHet: x.zoZegJeHet,
      alsDeKlantZegt: x.alsDeKlantZegt, antwoord: leesAlsDeKlantZegt(x.alsDeKlantZegt)?.antwoord, bewijs: x.bewijs, wanneerVerliezen: x.wanneerVerliezen, actief: true,
    })) }; break
    case 'winpunten': {
      const fasen = (s.context?.fasen ?? h.fasen ?? []).map((f: any, n: number) => ({ id: f._id ?? f.id, naam: f.naam, soort: f.soort, volgorde: f.volgorde ?? n + 1, reisHoofdfase: f.reisHoofdfase ?? opId<any>(h.fasen, f._id ?? f.id)?.reisHoofdfase ?? null }))
      c = { fasen, items: (i.rijen ?? []).map((w: any) => { const oud = opId<any>(h.items, w._id); return { id: w._id, faseId: w.fase ?? null, titel: w.titel, omschrijving: w.omschrijving, waarom: w.onderscheidend ?? w.waarom, impact: w.impact ?? 'midden', concurrentIds: lijstVan(w.concurrenten), weging: oud?.weging ?? 1, context: oud?.context ?? {}, actief: true } }) }
      break
    }
    case 'terugkomregels': {
      const regel = (r: any, lijst: 'verloren' | 'slapend') => {
        const oud = opId<any>(h.items, r._id)
        return { id: r._id, lijst, reden: labelVanCode(lijst === 'slapend' ? r.redenSlapen ?? r.reden : r.reden), termijn: termijnLabel(r.termijn), termijnDagen: oud?.termijnDagen ?? TERMIJN_DAGEN[r.termijn] ?? 91, kanaal: KANAAL[r.kanaal] ?? labelVanCode(r.kanaal), klassen: lijstVan(r.accountklasse), rollen: oud?.oppakker ? (oud.rollen ?? []) : lijstVan(r.rollen).map(rolLabel), aanpak: r.aanpak, hercontactritmeId: oud?.hercontactritmeId ?? null, ...(oud?.oppakker ? { oppakker: oud.oppakker } : {}) }
      }
      c = { items: [...(i.rijen ?? []).map((r: any) => regel(r, 'verloren')), ...(i.extra ?? []).map((r: any) => regel(r, 'slapend'))] }
      break
    }
  }
  return c as Concepten[O]
}

export interface Koppelregel { eigenId: string; eigenNaam: string; salesdnaId: string | null; salesdnaNaam: string | null; op: 'id' | 'naam' | 'geen' }
const norm = (s: string) => s.trim().toLocaleLowerCase('nl').replace(/\s+/g, ' ')
/** Voorstel per eigen rij: eerst dezelfde id, dan dezelfde naam (hoofdletters en spaties tellen niet); anders geen. */
export function mapOpNaam(eigen: { id: string; naam: string }[], salesdna: { id: string; naam: string }[]): Koppelregel[] {
  const bezet = new Set<string>()
  const uit = eigen.map((e) => {
    const s = salesdna.find((x) => x.id === e.id)
    if (s) bezet.add(s.id)
    return { e, s, op: s ? 'id' as const : 'geen' as const }
  })
  return uit.map(({ e, s, op }) => {
    if (s) return { eigenId: e.id, eigenNaam: e.naam, salesdnaId: s.id, salesdnaNaam: s.naam, op }
    const n = salesdna.find((x) => !bezet.has(x.id) && norm(x.naam) === norm(e.naam))
    if (n) { bezet.add(n.id); return { eigenId: e.id, eigenNaam: e.naam, salesdnaId: n.id, salesdnaNaam: n.naam, op: 'naam' as const } }
    return { eigenId: e.id, eigenNaam: e.naam, salesdnaId: null, salesdnaNaam: null, op: 'geen' as const }
  })
}

/** Nieuwe ids in een lijst ten opzichte van wat er was (voor de taak "nog geen SBI-koppeling"). */
export const nieuweIds = (oud: { id: string }[], nieuw: { id: string }[]) => nieuw.filter((x) => !oud.some((o) => o.id === x.id))
