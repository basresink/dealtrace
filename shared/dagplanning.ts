// De automatische dagplanning (F3 Dagplanner). Puur, met `nu` als parameter: de voorkeur per gebruiker
// ("Plan mijn dag automatisch" met een tijdstip), wanneer de geplande taak aan de beurt is, welke blokken
// uit planDag (shared/dagritme.ts) echte agenda-items worden, en wat er bij herplannen verandert. Wat niet
// meer past, schuift met een regel in "Wat schoof" naar het eerstvolgende passende moment; niets
// verdwijnt stil. De server (server/utils/dagplanning.ts en de agent in server/utils/agents/dagplanner.ts)
// schrijft en meldt.
import { isWerkdag, nlMoment, nlTijdstip, type WerkdagInstelling } from './datum'
import type { Dagplan, PlanBlok } from './dagritme'
import { naStilte, type MeldingInstelling } from './meldingsregels'
import { motivatieVanDeDag } from './motivatie'

export interface DagplanningVoorkeur { automatisch: boolean; tijd: string }
export const DAGPLANNING_STANDAARD: DagplanningVoorkeur = { automatisch: false, tijd: '07:00' }
/** Na dit uur plant de Dagplanner de dag niet meer automatisch in (de dag is dan grotendeels voorbij). */
export const PLAN_LAATSTE_UUR = 16
/** Hoeveel gesprekken in een belblok van een uur passen (6 minuten per gesprek met marge, zoals planDag). */
export const GESPREKKEN_PER_UUR = 10

const geldigeTijd = (t: unknown) => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t)

/** De voorkeur met de standaard eronder; een ongeldig tijdstip valt terug op 07:00. */
export function dagplanningVoorkeur(data: { automatisch?: unknown; tijd?: unknown } | null | undefined): DagplanningVoorkeur {
  return { automatisch: data?.automatisch === true, tijd: geldigeTijd(data?.tijd) ? String(data!.tijd) : DAGPLANNING_STANDAARD.tijd }
}

/** Een tijdstip tussen 06:00 en 12:00 in kwartieren. */
export function controleerPlanTijd(tijd: unknown): string | null {
  if (!geldigeTijd(tijd)) return 'Kies een tijdstip als 07:00'
  const [u, m] = String(tijd).split(':').map(Number)
  if (u! < 6 || u! > 12 || (u === 12 && m! > 0)) return 'Kies een tijdstip tussen 06:00 en 12:00'
  if (m! % 15) return 'Kies een kwartier: 00, 15, 30 of 45'
  return null
}
export const PLAN_TIJDEN = Array.from({ length: 25 }, (_, i) => { const m = 6 * 60 + i * 15; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` })

/**
 * Is de automatische planning nu aan de beurt? Alleen op een werkdag, op of na het tijdstip, na de
 * stille uren van de gebruiker (valt het tijdstip erin, dan erna), en niet meer na PLAN_LAATSTE_UUR.
 * Geeft het moment waarop hij hoort, of null. Of de dag al gepland is, weet de server (unieke sleutel).
 */
export function planAanDeBeurt(v: DagplanningVoorkeur, nu: Date, stilte: Pick<MeldingInstelling, 'stilVan' | 'stilTot' | 'weekendStil'>, w: WerkdagInstelling = {}): Date | null {
  if (!v.automatisch) return null
  const vandaag = nlMoment(nu).datum
  if (!isWerkdag(vandaag, w)) return null
  const [u, m] = v.tijd.split(':').map(Number)
  const moment = naStilte(nlTijdstip(vandaag, u!, m!), stilte)
  if (nlMoment(moment).datum !== vandaag) return null
  if (nu.getTime() < moment.getTime() || nlMoment(nu).uur >= PLAN_LAATSTE_UUR) return null
  return moment
}

// ── Wat de Dagplanner schrijft ─────────────────────────────────────────────

export type ItemSoort = 'belblok' | 'voorbereiding' | 'kans' | 'lunch' | 'focus'
export const ITEM_LABEL: Record<ItemSoort, string> = { belblok: 'Belblok', voorbereiding: 'Voorbereiding', kans: 'Kans langs de route', lunch: 'Lunch', focus: 'Taken afwerken' }
/** Belblokken, voorbereiding en kansen worden echte agenda-items (sessie of taak); lunch en focus houden alleen de tijd vrij. */
export const SCHRIJFT_IN_AGENDA: ItemSoort[] = ['belblok', 'voorbereiding', 'kans']

export interface PlanItem {
  /** Vaste sleutel om bij herplannen te herkennen: bel:1, voorbereiding:<afspraak>, kans:<account>, lunch, focus. */
  sleutel: string
  soort: ItemSoort
  start: string
  eind: string
  titel: string
  sub: string | null
  accountId?: string | null
  afspraakId?: string | null
  /** Belblok: hoeveel belacties erin horen. */
  aantal?: number
  status: 'actief' | 'ongedaan' | 'vervallen'
  sessieId?: string | null
  taakId?: string | null
  /** De taak bestond al (bezoektaak): ongedaan maken zet de oude datum terug in plaats van te annuleren. */
  taakBestond?: boolean
  /** Belblok: de taken die eraan hangen met hun datum van daarvoor. */
  taken?: { id: string; due: string | null }[]
  /** Kans: de datum van de bestaande bezoektaak van daarvoor. */
  vorigeDue?: string | null
}

export interface ItemOpties { belacties: number; capaciteit: number; kansenMax: number; /** Belblokken die vandaag al voorbij of begonnen zijn: de nummering loopt door. */ belVanaf?: number }

/**
 * Welke blokken uit de indeling de Dagplanner zelf zet: de voorgestelde belblokken (met een eerlijk
 * deel van de belacties, binnen de capaciteit en wat in het blok past), de voorbereiding, kansen langs
 * de route (binnen de capaciteit voor bezoeken), lunch en het focusblok. Vaste punten nooit.
 */
export function itemsUitPlan(plan: Pick<Dagplan, 'blokken'>, o: ItemOpties): PlanItem[] {
  const uit: PlanItem[] = []
  const bel = plan.blokken.filter((b) => b.soort === 'bel' && b.voorstel && !b.vast)
  const past = bel.reduce((s, b) => s + Math.max(1, Math.round((Date.parse(b.eind) - Date.parse(b.start)) / 3_600_000 * GESPREKKEN_PER_UUR)), 0)
  let over = Math.max(0, Math.min(o.belacties, o.capaciteit, past))
  bel.forEach((b, i) => {
    const ruimte = Math.max(1, Math.round((Date.parse(b.eind) - Date.parse(b.start)) / 3_600_000 * GESPREKKEN_PER_UUR))
    const aantal = Math.min(ruimte, Math.ceil(over / (bel.length - i)))
    over -= aantal
    uit.push({ sleutel: `bel:${(o.belVanaf ?? 0) + i + 1}`, soort: 'belblok', start: b.start, eind: b.eind, titel: aantal ? `Belblok ${aantal === 1 ? '1 gesprek' : `${aantal} gesprekken`}` : 'Belblok uit je bellijst', sub: b.sub, aantal, status: 'actief' })
  })
  let kansen = 0
  for (const b of plan.blokken) {
    if (b.vast || b.voorstel) continue
    if (b.soort === 'voorbereiding') uit.push({ sleutel: b.id, soort: 'voorbereiding', start: b.start, eind: b.eind, titel: b.titel, sub: b.sub, accountId: b.accountId ?? null, afspraakId: b.id.split(':')[1] ?? null, status: 'actief' })
    else if (b.soort === 'kans' && kansen < o.kansenMax && b.accountId) { kansen++; uit.push({ sleutel: `kans:${b.accountId}`, soort: 'kans', start: b.start, eind: b.eind, titel: b.titel, sub: b.sub, accountId: b.accountId, status: 'actief' }) }
    else if (b.soort === 'lunch') uit.push({ sleutel: 'lunch', soort: 'lunch', start: b.start, eind: b.eind, titel: 'Lunch', sub: null, status: 'actief' })
    else if (b.soort === 'focus') uit.push({ sleutel: 'focus', soort: 'focus', start: b.start, eind: b.eind, titel: b.titel, sub: b.sub, status: 'actief' })
  }
  return uit.sort((a, b) => a.start.localeCompare(b.start))
}

/** De blokken om te tonen: vaste punten en reistijd uit de indeling, en de items van de Dagplanner zoals hij ze schreef. */
export function blokkenMetItems(plan: Pick<Dagplan, 'blokken'>, items: PlanItem[]): PlanBlok[] {
  const vast = plan.blokken.filter((b) => b.vast && !items.some((i) => i.sessieId && i.sessieId === b.id))
  const eigen = items.filter((i) => i.status === 'actief').map((i): PlanBlok => ({
    id: i.sleutel, soort: i.soort === 'belblok' ? 'bel' : i.soort, start: i.start, eind: i.eind, titel: i.titel, sub: i.sub, vast: false, voorstel: false, accountId: i.accountId ?? null,
    href: i.soort === 'belblok' ? (i.sessieId ? `/belblokken/${i.sessieId}` : '/belblokken') : i.soort === 'focus' ? '/taken' : i.accountId ? `/accounts/${i.accountId}` : null, dagplanner: i.sleutel,
  }))
  return [...vast, ...eigen].sort((a, b) => a.start.localeCompare(b.start) || Number(b.vast) - Number(a.vast))
}

// ── Herplannen ─────────────────────────────────────────────────────────────

export interface VastStand { id: string; soort: string; start: string; eind: string; titel: string; status?: string }

const hhmm = (iso: string) => { const m = nlMoment(new Date(iso)); return `${String(m.uur).padStart(2, '0')}:${String(m.minuut).padStart(2, '0')}` }
const dagLabel = (iso: string) => new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' }).format(new Date(iso))
/** "16:00" vandaag, anders "do 22 okt 10:00". */
export function momentTekst(iso: string, vandaag: string): string {
  return nlMoment(new Date(iso)).datum === vandaag ? hhmm(iso) : `${dagLabel(iso)} ${hhmm(iso)}`
}

/** Wat er aan de vaste punten veranderde sinds de vorige (her)planning: de aanleiding om opnieuw in te delen. */
export function vastVerschil(oud: VastStand[] | null | undefined, nu: VastStand[], vandaag: string): string[] {
  if (!oud) return []
  const uit: string[] = []
  const nieuw = new Map(nu.map((v) => [v.id, v]))
  for (const o of oud) {
    if (o.status === 'geannuleerd' || o.status === 'niet_verschenen') continue
    const n = nieuw.get(o.id)
    if (o.soort === 'bezet') { if (!n) uit.push(`Het bezette moment om ${hhmm(o.start)} staat niet meer in je agenda.`); continue }
    if (!n) uit.push(`${o.titel} staat niet meer in je agenda.`)
    else if (n.status === 'geannuleerd') uit.push(`${o.titel} is geannuleerd.`)
    else if (n.status === 'niet_verschenen') uit.push(`${o.titel}: niet verschenen.`)
    else if (n.start !== o.start) uit.push(`${o.titel} is verzet naar ${momentTekst(n.start, vandaag)}.`)
    else if (Date.parse(n.eind) > Date.parse(o.eind)) uit.push(`${o.titel} loopt uit tot ${hhmm(n.eind)}.`)
    else if (Date.parse(n.eind) < Date.parse(o.eind)) uit.push(`${o.titel} is eerder klaar, om ${hhmm(n.eind)}.`)
  }
  const oudIds = new Set(oud.map((o) => o.id))
  for (const n of nu) {
    if (oudIds.has(n.id) || n.status === 'geannuleerd' || n.status === 'niet_verschenen') continue
    uit.push(n.soort === 'bezet' ? `Nieuw bezet in je agenda om ${hhmm(n.start)}.` : `Nieuw: ${n.titel} om ${hhmm(n.start)}.`)
  }
  return uit
}

/** Een vingerafdruk van de vaste punten: verandert die, dan plant de Dagplanner opnieuw. Afronden telt niet als wijziging. */
export const vastSleutel = (v: VastStand[]) => v.map((x) => `${x.id}|${x.start}|${x.eind}|${x.status === 'afgerond' ? 'gepland' : x.status ?? ''}`).sort().join(';')

export interface Doorschuiven { belacties: string; bezoek: string }
export interface Herplan {
  blijft: PlanItem[]
  verplaatst: { oud: PlanItem; nieuw: PlanItem }[]
  vervalt: PlanItem[]
  nieuw: PlanItem[]
  regels: string[]
}

/**
 * Herplannen: vergelijk wat de Dagplanner nog voor de rest van de dag had staan (alleen items die nog
 * niet begonnen) met een nieuwe indeling vanaf nu. Gelijke sleutel en tijd blijft, gelijke sleutel met
 * een andere tijd verschuift, een oude sleutel zonder plek vervalt en schuift door naar het
 * eerstvolgende passende moment, een nieuwe sleutel komt erbij. Elke verandering krijgt een regel.
 */
export function herplan(oud: PlanItem[], nieuw: PlanItem[], nu: Date, naar: Doorschuiven): Herplan {
  const flex = oud.filter((i) => i.status === 'actief' && Date.parse(i.start) >= nu.getTime())
  const uit: Herplan = { blijft: [], verplaatst: [], vervalt: [], nieuw: [], regels: [] }
  const gebruikt = new Set<string>()
  for (const o of flex) {
    const n = nieuw.find((x) => x.sleutel === o.sleutel && !gebruikt.has(x.sleutel))
    if (!n) { uit.vervalt.push(o); continue }
    gebruikt.add(n.sleutel)
    if (n.start === o.start && n.eind === o.eind) uit.blijft.push({ ...o, titel: n.titel, sub: n.sub, aantal: n.aantal ?? o.aantal })
    else uit.verplaatst.push({ oud: o, nieuw: { ...o, start: n.start, eind: n.eind, titel: n.titel, sub: n.sub, aantal: n.aantal ?? o.aantal } })
  }
  uit.nieuw = nieuw.filter((x) => !gebruikt.has(x.sleutel))
  const naam = (i: PlanItem) => i.soort === 'belblok' ? 'Het belblok' : i.soort === 'lunch' ? 'De lunch' : i.soort === 'focus' ? 'Het blok Taken afwerken' : i.titel
  for (const v of uit.verplaatst) uit.regels.push(`${naam(v.oud)} schoof van ${hhmm(v.oud.start)} naar ${hhmm(v.nieuw.start)}.`)
  for (const v of uit.vervalt) {
    if (v.soort === 'belblok') uit.regels.push(`Het belblok van ${hhmm(v.start)} past niet meer vandaag.${v.aantal ? ` ${v.aantal === 1 ? 'De belactie schuift' : `De ${v.aantal} belacties schuiven`} naar ${naar.belacties}.` : ''}`)
    else if (v.soort === 'kans') uit.regels.push(`${v.titel} past niet meer vandaag en schuift naar ${naar.bezoek}.`)
    else if (v.soort === 'voorbereiding') uit.regels.push(`${v.titel} vervalt: de afspraak staat niet meer op dit moment.`)
    else if (v.soort === 'lunch') uit.regels.push('Er is geen plek meer voor de lunch van 45 minuten. Neem hem waar het kan.')
    else uit.regels.push(`${naam(v)} past niet meer vandaag. Je open taken blijven op je lijst.`)
  }
  for (const n of uit.nieuw) {
    if (n.soort === 'kans') uit.regels.push(`Op de vrijgekomen plek: ${n.titel.replace(/^Kans: /, 'kans ')} om ${hhmm(n.start)}${n.sub ? `, ${n.sub}` : ''}.`)
    else if (n.soort === 'belblok') uit.regels.push(`Nieuw belblok om ${hhmm(n.start)}${n.aantal ? ` met ${n.aantal === 1 ? '1 gesprek' : `${n.aantal} gesprekken`}` : ''}.`)
    else if (n.soort === 'voorbereiding') uit.regels.push(`${n.titel} om ${hhmm(n.start)}.`)
    else uit.regels.push(`${ITEM_LABEL[n.soort]} om ${hhmm(n.start)}.`)
  }
  if (uit.regels.length && !uit.vervalt.some((v) => v.soort === 'belblok' || v.soort === 'kans')) uit.regels.push('Niets schoof naar een andere dag.')
  return uit
}

/** De kop van de dagstart als de Dagplanner de dag indeelde. Zonder wijzigingen staat onder de titel de motiverende zin van de dag. */
export function dagplanningKop(p: { dag: string; herplandOp?: string | null; wijzigingen: number }): { titel: string; lede: string; motivatie: boolean } {
  if (p.herplandOp && p.wijzigingen) return { titel: 'Je dag is opnieuw ingedeeld.', lede: `Herpland om ${hhmm(p.herplandOp)} · ${p.wijzigingen === 1 ? '1 wijziging' : `${p.wijzigingen} wijzigingen`}`, motivatie: false }
  return { titel: 'Je dag staat klaar.', lede: motivatieVanDeDag(p.dag), motivatie: true }
}
