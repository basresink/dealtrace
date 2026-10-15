// Belblokken en belmodus (F07). Eén rangorde voor de bellijst, de belmodus en de vuller
// (gat 35), de soort van een blok stuurt de vulling (gat 36), en duur, marge en
// uitkomstcodes staan hier één keer (gat 16).
import { isWerkdag, nlMoment, nlTijdstip, plusDagen, type WerkdagInstelling } from './datum'
import type { UitkomstCode } from './hercontact'

export type BlokSoort = 'koud' | 'opvolging' | 'gemengd'
export const BLOK_SOORTEN: BlokSoort[] = ['koud', 'opvolging', 'gemengd']
export const SOORT_LABEL: Record<BlokSoort, string> = { koud: 'Koude acquisitie', opvolging: 'Opvolging en ritme', gemengd: 'Gemengd' }
export const PLEKKEN = ['Thuis', 'Kantoor', 'Onderweg (handsfree)'] as const
export const MAX_BLOKKEN = 20
export const MIN_GESPREK = 8
export const STANDAARD_VERHOUDING = 70

export interface VastBlok {
  id: string
  /** 1 = maandag tot en met 5 = vrijdag. */
  dagen: number[]
  /** 'HH:MM' */
  start: string
  minuten: number
  plek: string
  soort: BlokSoort
  /** Gemengd: aandeel koude acquisitie in procenten (standaard 70). */
  verhouding?: number
  scriptId?: string | null
  /** "Vult zichzelf" (Expert) of "Ik vul zelf". */
  automatisch: boolean
}
export interface BelVoorkeuren { lunch: { start: string; minuten: number } }
export const STANDAARD_VOORKEUREN: BelVoorkeuren = { lunch: { start: '12:00', minuten: 45 } }

/** De standaard vaste blokken voor een nieuwe gebruiker (F07). */
export function standaardBlokken(werkplek: 'binnendienst' | 'buitendienst'): VastBlok[] {
  if (werkplek === 'buitendienst') return [{ id: 'vb-vrijdag', dagen: [5], start: '09:00', minuten: 60, plek: 'Kantoor', soort: 'gemengd', verhouding: STANDAARD_VERHOUDING, automatisch: false }]
  return [
    { id: 'vb-ochtend', dagen: [1, 2, 3, 4], start: '09:00', minuten: 90, plek: 'Kantoor', soort: 'koud', automatisch: true },
    { id: 'vb-middag', dagen: [1, 2, 3, 4], start: '14:00', minuten: 60, plek: 'Kantoor', soort: 'opvolging', automatisch: false },
  ]
}

export const DAGNAMEN = ['', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag']
const hoofd = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const minVan = (hhmm: string) => { const [u, m] = hhmm.split(':').map(Number); return (u ?? 0) * 60 + (m ?? 0) }
const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
export const eindTijd = (b: Pick<VastBlok, 'start' | 'minuten'>) => hhmm(minVan(b.start) + b.minuten)

export function dagenLabel(dagen: number[]): string {
  const d = [...new Set(dagen)].sort()
  if (d.length === 4 && d.join('') === '1234') return 'Maandag tot en met donderdag'
  if (d.length === 5) return 'Elke werkdag'
  const namen = d.map((x) => DAGNAMEN[x] ?? '?')
  return hoofd(namen.length === 1 ? namen[0]! : `${namen.slice(0, -1).join(', ')} en ${namen.at(-1)}`)
}
/** "Maandag en woensdag 09:00 tot 10:00" */
export const blokMoment = (b: VastBlok) => `${dagenLabel(b.dagen)} ${b.start} tot ${eindTijd(b)}`
/** "Gemengd 70/30" */
export const soortLabel = (b: Pick<VastBlok, 'soort' | 'verhouding'>) => b.soort === 'gemengd' ? `Gemengd ${b.verhouding ?? STANDAARD_VERHOUDING}/${100 - (b.verhouding ?? STANDAARD_VERHOUDING)}` : SOORT_LABEL[b.soort]

export function blokFouten(b: unknown): string[] {
  const x = (b ?? {}) as Partial<VastBlok>
  const f: string[] = []
  if (typeof x.id !== 'string' || !x.id) f.push('id ontbreekt')
  if (!Array.isArray(x.dagen) || !x.dagen.length || x.dagen.some((d) => !Number.isInteger(d) || d < 1 || d > 5)) f.push('Kies minstens één werkdag')
  if (typeof x.start !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(x.start)) f.push('Begintijd als UU:MM')
  if (!Number.isInteger(x.minuten) || x.minuten! < 30 || x.minuten! > 240) f.push('Duur tussen 30 en 240 minuten')
  else if (x.start && /^\d\d:\d\d$/.test(x.start) && minVan(x.start) + x.minuten! > 20 * 60) f.push('Een blok eindigt uiterlijk om 20:00')
  if (!BLOK_SOORTEN.includes(x.soort as BlokSoort)) f.push('Onbekende soort')
  if (x.verhouding !== undefined && (!Number.isInteger(x.verhouding) || x.verhouding < 0 || x.verhouding > 100)) f.push('Verhouding tussen 0 en 100')
  if (typeof x.automatisch !== 'boolean') f.push('Kies "Vult zichzelf" of "Ik vul zelf"')
  return f
}
export function valideerBlokken(blokken: unknown): string[] {
  if (!Array.isArray(blokken)) return ['Geef een lijst blokken']
  if (blokken.length > MAX_BLOKKEN) return [`Maximaal ${MAX_BLOKKEN} blokken`]
  return blokken.flatMap((b, i) => blokFouten(b).map((f) => `Blok ${i + 1}: ${f}`))
}

// ── Rangorde ────────────────────────────────────────────────────────────────

export type Prioriteit = 'urgent' | 'hoog' | 'middel' | 'laag'
export interface BelKandidaat {
  accountId: string
  accountNaam: string
  contactId?: string | null
  contactNaam?: string | null
  telefoon?: string | null
  /** Een open beltaak; zonder taak is het een aanvulling. */
  taskId?: string | null
  due?: string | null
  prioriteit?: Prioriteit | null
  score: number
  aanleidingen?: number
  openTaken?: number
  heet?: boolean
  waarschuwing?: boolean
  /** Koude acquisitie of opvolging (ritme, afspraak bevestigen). */
  herkomst: 'koud' | 'opvolging'
  reden: string
  belMeNiet?: boolean
  belblokId?: string | null
}

const URGENTIE = { achterstallig: 100, vandaag: 80, later: 50, zonderDatum: 40 }
const PRIO: Record<Prioriteit, number> = { urgent: 4, hoog: 3, middel: 2, laag: 1 }

export function urgentie(due: string | null | undefined, nu: Date): number {
  if (!due) return URGENTIE.zonderDatum
  const d = nlMoment(new Date(due)).datum
  const v = nlMoment(nu).datum
  return d < v ? URGENTIE.achterstallig : d === v ? URGENTIE.vandaag : URGENTIE.later
}

/**
 * De rangorde voor bellijst, belmodus en vuller: open beltaken eerst (1000 + urgentie x 10
 * + prioriteit x 20 + score), daarna aanvulling zonder beltaak (score + aanleidingen + open
 * taken + hete aanleiding of waarschuwing).
 */
export function rangorde(k: BelKandidaat, nu: Date): number {
  if (k.taskId) return 1000 + urgentie(k.due, nu) * 10 + PRIO[k.prioriteit ?? 'middel'] * 20 + k.score
  return k.score + Math.min(20, (k.aanleidingen ?? 0) * 5) + Math.min(15, (k.openTaken ?? 0) * 4) + (k.heet ? 15 : k.waarschuwing ? 5 : 0)
}

export const TOP = [5, 10, 15] as const

/**
 * De bellijst: bel-me-niet eruit, per account de hoogste, gesorteerd op rangorde.
 * Met `soort` alleen de kandidaten die bij die soort blok horen.
 */
export function bouwBellijst(kandidaten: BelKandidaat[], nu: Date, opties: { soort?: BlokSoort; top?: number; alleenVandaag?: boolean } = {}): (BelKandidaat & { rang: number; duur: number })[] {
  const vandaag = nlMoment(nu).datum
  const beste = new Map<string, BelKandidaat & { rang: number; duur: number }>()
  for (const k of kandidaten) {
    if (k.belMeNiet) continue
    if (opties.soort === 'koud' && k.herkomst !== 'koud') continue
    if (opties.soort === 'opvolging' && k.herkomst !== 'opvolging') continue
    if (opties.alleenVandaag && (!k.due || nlMoment(new Date(k.due)).datum > vandaag)) continue
    const r = { ...k, rang: rangorde(k, nu), duur: schatDuur(k) }
    const b = beste.get(k.accountId)
    if (!b || r.rang > b.rang) beste.set(k.accountId, r)
  }
  const lijst = [...beste.values()].sort((a, b) => b.rang - a.rang || a.accountNaam.localeCompare(b.accountNaam, 'nl'))
  return opties.top ? lijst.slice(0, opties.top) : lijst
}

/** De kop zegt eerlijk wat de lijst is (gat 35). */
export const bellijstKop = (alleenVandaag: boolean) => (alleenVandaag ? 'Bellijst van vandaag' : 'Bellijst')

// ── Duur, marge, blok ──────────────────────────────────────────────────────

/** 8 minuten, 12 bij urgent, plus 2 bij score 70 of meer, plus 2 bij meer dan één taak; na 20 gesprekken het eigen gemiddelde. */
export function schatDuur(k: Pick<BelKandidaat, 'prioriteit' | 'score' | 'openTaken'>, historie?: { gesprekken: number; gemiddeldeMinuten: number } | null): number {
  if (historie && historie.gesprekken >= 20 && historie.gemiddeldeMinuten > 0) return Math.max(3, Math.round(historie.gemiddeldeMinuten))
  return (k.prioriteit === 'urgent' ? 12 : 8) + (k.score >= 70 ? 2 : 0) + ((k.openTaken ?? 0) > 1 ? 2 : 0)
}
/** Een kwart van de gesprekstijd, naar boven afgerond op 5 minuten. */
export const marge = (gesprekstijd: number) => (gesprekstijd <= 0 ? 0 : Math.ceil(gesprekstijd / 4 / 5) * 5)
/** Gesprekstijd plus marge, naar boven afgerond op een half uur, minimaal 30 minuten. */
export const blokduur = (gesprekstijd: number) => Math.max(30, Math.ceil((gesprekstijd + marge(gesprekstijd)) / 30) * 30)
/** Hoeveel gesprekstijd past er in een blok van zoveel minuten (marge eraf). */
export function gesprekstijdIn(blokMinuten: number): number {
  let t = blokMinuten
  while (t > 0 && t + marge(t) > blokMinuten) t--
  return t
}

/**
 * Verdeel de lijst over een blok: wat past (gesprekstijd plus marge binnen het blok) gaat
 * erin, de rest schuift naar het volgende vaste blok of blijft in de bellijst.
 */
export function verdeelOverBlok<K extends { duur: number }>(kandidaten: K[], blokMinuten: number, volgendBlok?: { label: string; start: string } | null) {
  const ruimte = gesprekstijdIn(blokMinuten)
  const inBlok: K[] = []
  const rest: K[] = []
  let gebruikt = 0
  for (const k of kandidaten) {
    if (gebruikt + k.duur <= ruimte) { inBlok.push(k); gebruikt += k.duur } else rest.push(k)
  }
  return {
    inBlok, gesprekstijd: gebruikt, marge: marge(gebruikt), blok: blokMinuten,
    geschoven: volgendBlok ? rest : [], inLijst: volgendBlok ? [] : rest, naar: volgendBlok ?? null,
    melding: rest.length ? (volgendBlok ? `${inBlok.length} in dit blok, ${rest.length} naar ${volgendBlok.label}` : `${inBlok.length} in dit blok, ${rest.length} blijven in je bellijst`) : null,
  }
}

/**
 * Vul een blok volgens zijn soort (gat 36): koud alleen koud, opvolging alleen opvolging,
 * gemengd in de verhouding (standaard 70 procent koud). Ruimte onder 8 minuten wordt
 * overgeslagen. De kandidaten komen al op rangorde binnen.
 */
export function vulBlok<K extends { herkomst: 'koud' | 'opvolging'; duur: number }>(soort: BlokSoort, kandidaten: K[], ruimteMinuten: number, verhouding = STANDAARD_VERHOUDING): K[] {
  const koud = kandidaten.filter((k) => k.herkomst === 'koud')
  const opv = kandidaten.filter((k) => k.herkomst === 'opvolging')
  const uit: K[] = []
  let ruimte = ruimteMinuten
  const neem = (rij: K[]) => {
    const i = rij.findIndex((k) => k.duur <= ruimte)
    if (i < 0) return false
    const [k] = rij.splice(i, 1)
    uit.push(k!); ruimte -= k!.duur
    return true
  }
  if (soort !== 'gemengd') {
    const rij = soort === 'koud' ? koud : opv
    while (ruimte >= MIN_GESPREK && neem(rij));
    return uit
  }
  const doel = Math.min(100, Math.max(0, verhouding)) / 100
  while (ruimte >= MIN_GESPREK) {
    const nKoud = uit.filter((k) => k.herkomst === 'koud').length
    // Kies de soort die het verst onder zijn aandeel zit; bij gelijkspel koud (nooit verdringen).
    const koudAanDeBeurt = nKoud < Math.ceil(doel * (uit.length + 1) - 1e-9) || !opv.length
    if (!(koudAanDeBeurt ? neem(koud) || neem(opv) : neem(opv) || neem(koud))) break
  }
  return uit
}

// ── Advies uit de agenda ───────────────────────────────────────────────────

export interface AgendaBezet { start: string; eind: string }
export interface AdviesMoment { start: string; eind: string; bron: 'vast' | 'vrij'; label: string; blokId?: string }

const momentLabel = (d: Date) => new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(d)

/**
 * Hooguit vijf momenten voor een blok van `duur` minuten: eerst de vaste blokken, dan vrije
 * gaten tussen 08:00 en 18:00, nooit in de lunch, het weekend of op een feestdag, en nooit
 * over een bezette afspraak.
 */
export function adviesMomenten(bezet: AgendaBezet[], blokken: VastBlok[], nu: Date, opties: { duur: number; lunch?: BelVoorkeuren['lunch']; inst?: WerkdagInstelling; dagen?: number } = { duur: 60 }): AdviesMoment[] {
  const lunch = opties.lunch ?? STANDAARD_VOORKEUREN.lunch
  const duur = Math.max(30, opties.duur)
  const vrij = (s: Date, e: Date) => bezet.every((b) => Date.parse(b.eind) <= s.getTime() || Date.parse(b.start) >= e.getTime())
  const inLunch = (sMin: number, eMin: number) => sMin < minVan(lunch.start) + lunch.minuten && eMin > minVan(lunch.start)
  const uit: AdviesMoment[] = []
  let dag = nlMoment(nu).datum
  for (let i = 0; i < (opties.dagen ?? 10) && uit.length < 5; i++, dag = plusDagen(dag, 1)) {
    if (!isWerkdag(dag, opties.inst ?? {})) continue
    const weekdag = new Date(`${dag}T12:00:00Z`).getUTCDay()
    const kandidaten: { sMin: number; dMin: number; bron: 'vast' | 'vrij'; blokId?: string }[] = blokken.filter((b) => b.dagen.includes(weekdag)).map((b) => ({ sMin: minVan(b.start), dMin: b.minuten, bron: 'vast' as const, blokId: b.id }))
    for (let s = 8 * 60; s + duur <= 18 * 60; s += 30) kandidaten.push({ sMin: s, dMin: duur, bron: 'vrij' })
    kandidaten.sort((a, b) => (a.bron === b.bron ? a.sMin - b.sMin : a.bron === 'vast' ? -1 : 1))
    for (const k of kandidaten) {
      if (uit.length >= 5) break
      const s = nlTijdstip(dag, Math.floor(k.sMin / 60), k.sMin % 60)
      const e = new Date(s.getTime() + k.dMin * 60_000)
      if (s.getTime() < nu.getTime() || inLunch(k.sMin, k.sMin + k.dMin) || !vrij(s, e)) continue
      if (uit.some((u) => Date.parse(u.start) < e.getTime() && Date.parse(u.eind) > s.getTime())) continue
      uit.push({ start: s.toISOString(), eind: e.toISOString(), bron: k.bron, blokId: k.blokId, label: `${hoofd(momentLabel(s))}${k.bron === 'vast' ? ' (vast blok)' : ''}` })
      // Per dag hooguit één vrij moment, zodat het advies over de week spreidt.
      if (k.bron === 'vrij') break
    }
  }
  return uit.sort((a, b) => a.start.localeCompare(b.start)).slice(0, 5)
}

/** De eerstvolgende keer dat een vast blok begint (voor "wat niet past schuift"). */
export function volgendVastBlok(blokken: VastBlok[], na: Date, inst: WerkdagInstelling = {}): { blok: VastBlok; start: Date; label: string } | null {
  const begin = nlMoment(na).datum
  for (let i = 0; i < 14; i++) {
    const dag = plusDagen(begin, i)
    if (!isWerkdag(dag, inst)) continue
    const weekdag = new Date(`${dag}T12:00:00Z`).getUTCDay()
    const opties = blokken.filter((b) => b.dagen.includes(weekdag)).map((b) => ({ blok: b, start: nlTijdstip(dag, Math.floor(minVan(b.start) / 60), minVan(b.start) % 60) }))
      .filter((o) => o.start.getTime() > na.getTime()).sort((a, b) => a.start.getTime() - b.start.getTime())
    if (opties[0]) return { ...opties[0], label: momentLabel(opties[0].start) }
  }
  return null
}

// ── Uitkomsten ─────────────────────────────────────────────────────────────

export type KnopSleutel = 'afspraak' | 'later' | 'geen_gehoor' | 'voicemail' | 'poortwachter' | 'doorverbonden' | 'verkeerd_nummer' | 'niet_geschikt' | 'geen_interesse'
export const UITKOMST_KNOPPEN: { sleutel: KnopSleutel; label: string }[] = [
  { sleutel: 'afspraak', label: 'Gesproken, afspraak' },
  { sleutel: 'later', label: 'Gesproken, later' },
  { sleutel: 'geen_gehoor', label: 'Geen gehoor' },
  { sleutel: 'voicemail', label: 'Voicemail ingesproken' },
  { sleutel: 'poortwachter', label: 'Poortwachter: terugbellen' },
  { sleutel: 'doorverbonden', label: 'Doorverbonden, nieuw contact' },
  { sleutel: 'verkeerd_nummer', label: 'Verkeerd nummer' },
  { sleutel: 'niet_geschikt', label: 'Niet geschikt' },
  { sleutel: 'geen_interesse', label: 'Geen interesse' },
]
export type TegelSleutel = 'gesproken' | 'niet_bereikt' | 'voicemail' | 'terugbellen'
export const HOE_GING_HET: { sleutel: TegelSleutel; label: string }[] = [
  { sleutel: 'gesproken', label: 'Gesproken' }, { sleutel: 'niet_bereikt', label: 'Niet bereikt' },
  { sleutel: 'voicemail', label: 'Voicemail' }, { sleutel: 'terugbellen', label: 'Terugbellen' },
]

export interface UitkomstVertaling {
  code: UitkomstCode
  /** Er moet een datum bij (later, terugbellen). */
  vraagtDatum: boolean
  /** Er moet een reden bij (geen interesse). */
  vraagtReden: boolean
  /** Een extra taak naast de vervolgpoging. */
  extraTaak?: { title: string; actionType: string }
  /** Gesproken met iemand (bereik). */
  bereikt: boolean
}

/**
 * De negen knoppen van de belmodus en de tegels van "Hoe ging het?" naar de codes uit 7.3.
 * Poortwachter is later met een datum, naar hetzelfde contact. Verkeerd nummer verbruikt
 * geen stap (dezelfde poging opnieuw) en zet "Nummer controleren" klaar.
 */
export function uitkomstNaarCode(knop: KnopSleutel | TegelSleutel): UitkomstVertaling | null {
  switch (knop) {
    case 'afspraak': return { code: 'afspraak', vraagtDatum: false, vraagtReden: false, bereikt: true }
    case 'later': case 'terugbellen': return { code: 'later', vraagtDatum: true, vraagtReden: false, bereikt: knop === 'later' }
    case 'poortwachter': return { code: 'later', vraagtDatum: true, vraagtReden: false, bereikt: false }
    case 'geen_gehoor': case 'niet_bereikt': return { code: 'geen_reactie', vraagtDatum: false, vraagtReden: false, bereikt: false }
    case 'voicemail': return { code: 'voicemail', vraagtDatum: false, vraagtReden: false, bereikt: false }
    case 'doorverbonden': return { code: 'nieuw_contact', vraagtDatum: false, vraagtReden: false, bereikt: true }
    case 'verkeerd_nummer': return { code: 'nieuw_contact', vraagtDatum: false, vraagtReden: false, bereikt: false, extraTaak: { title: 'Nummer controleren', actionType: 'taak' } }
    case 'niet_geschikt': return { code: 'niet_geschikt', vraagtDatum: false, vraagtReden: false, bereikt: true }
    case 'geen_interesse': return { code: 'geen_interesse', vraagtDatum: false, vraagtReden: true, bereikt: true }
    case 'gesproken': return null // daarna de uitkomst uit het script
  }
}

export interface Gesprek { taskId?: string | null; accountId: string; contactRol?: string | null; knop: KnopSleutel | TegelSleutel; duurSec: number; scriptId?: string | null; versie?: number | null; geschatMin?: number }

/** Blokresultaat: gevoerd, bereikt, beslisser bereikt, afspraken, terugbellen, gemiddelde duur tegen de schatting. */
export function blokResultaat(gesprekken: Gesprek[]) {
  const n = gesprekken.length
  const v = gesprekken.map((g) => ({ g, u: uitkomstNaarCode(g.knop) }))
  const bereikt = v.filter((x) => x.u?.bereikt).length
  const duur = n ? Math.round(gesprekken.reduce((s, g) => s + g.duurSec, 0) / n) : 0
  const schatting = n ? Math.round((gesprekken.reduce((s, g) => s + (g.geschatMin ?? 8), 0) / n) * 60) : 0
  return {
    gevoerd: n, bereikt, beslisserBereikt: v.filter((x) => x.u?.bereikt && x.g.contactRol === 'beslisser').length,
    afspraken: v.filter((x) => x.u?.code === 'afspraak').length, terugbellen: v.filter((x) => x.u?.code === 'later').length,
    gemiddeldeDuurSec: duur, geschatSec: schatting, verschilSec: duur - schatting,
  }
}

// ── De vuller ──────────────────────────────────────────────────────────────

export interface VulOpdracht<K> { blokId: string; start: string; eind: string; toevoegen: K[]; alGepland: number; ruimte: number }

/**
 * Wat de vuller vandaag doet voor één gebruiker (na elke motorrun, alleen werkdagen):
 * alleen blokken met "Vult zichzelf" van vandaag die nog niet voorbij zijn; wat er al in
 * staat blijft (handmatig wint); nooit een kandidaat die al in een blok zit; geen leeg
 * blok; ruimte onder 8 minuten wordt overgeslagen; de soort stuurt de vulling.
 */
export function planVuller<K extends BelKandidaat & { duur: number }>(
  blokken: VastBlok[], kandidaten: K[], bestaand: { blokId: string; accountId: string; duur: number }[], nu: Date, inst: WerkdagInstelling = {},
): VulOpdracht<K>[] {
  const dag = nlMoment(nu).datum
  if (!isWerkdag(dag, inst)) return []
  const weekdag = new Date(`${dag}T12:00:00Z`).getUTCDay()
  const alIn = new Set(bestaand.map((b) => b.accountId))
  const uit: VulOpdracht<K>[] = []
  const vrij = [...kandidaten].filter((k) => !k.belMeNiet).sort((a, b) => rangorde(b, nu) - rangorde(a, nu))
  for (const b of blokken.filter((x) => x.automatisch && x.dagen.includes(weekdag)).sort((x, y) => x.start.localeCompare(y.start))) {
    const start = nlTijdstip(dag, Math.floor(minVan(b.start) / 60), minVan(b.start) % 60)
    const eind = new Date(start.getTime() + b.minuten * 60_000)
    if (eind.getTime() <= nu.getTime()) continue
    const hier = bestaand.filter((x) => x.blokId === b.id)
    const bezet = hier.reduce((s, x) => s + x.duur, 0)
    const ruimte = gesprekstijdIn(b.minuten) - bezet
    if (ruimte < MIN_GESPREK) continue
    const keuze = vulBlok(b.soort, vrij.filter((k) => !alIn.has(k.accountId)), ruimte, b.verhouding)
    if (!keuze.length) continue
    for (const k of keuze) alIn.add(k.accountId)
    uit.push({ blokId: b.id, start: start.toISOString(), eind: eind.toISOString(), toevoegen: keuze, alGepland: hier.length, ruimte })
  }
  return uit
}
