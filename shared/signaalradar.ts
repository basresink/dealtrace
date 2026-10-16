// Signaalradar (F5): de inzichten met bron per branche en signaalsoort opgeteld en vergeleken met
// normaal. Normaal is het gemiddelde van de zes perioden van 30 dagen voor de laatste 30 dagen. Een
// golf is een cel met minstens 5 accounts en minstens 1,5 keer normaal. Alles hier is puur, zodat
// scherm, server en tests dezelfde regels gebruiken.
import { isWerkdag, nlMoment, plusDagen, type WerkdagInstelling } from './datum'
import { gesprekstijdIn, MIN_GESPREK, STANDAARD_VERHOUDING, type VastBlok } from './belblokken'
import { kiesWinpunt, winpuntVoor, type Winpunt } from './verkoopverhaal'

export const SIGNAALSOORTEN = ['vacatures', 'nieuwe-vestiging', 'nieuwbouw-vergunning', 'directiewissel', 'subsidie-regeling', 'overname', 'overig'] as const
export type Signaalsoort = typeof SIGNAALSOORTEN[number]

export interface SoortInfo {
  label: string
  /** Kort label voor de kolomkop van het raster. */
  kort: string
  /** Wat de accounts in de cel doen: "8 accounts in Installateurs zoeken personeel." */
  zin: string
  /** Waarom dit een aanleiding is om te bellen. */
  haak: string
  /** Woorden in een winpunt die bij deze soort passen. */
  winpuntWoorden: string[]
}

export const SOORT_INFO: Record<Signaalsoort, SoortInfo> = {
  vacatures: { kort: 'Vacatures', label: 'Vacatures', zin: 'zoeken personeel', haak: 'Wie mensen zoekt, groeit. Groei maakt snelheid en levering op tijd kritisch.', winpuntWoorden: ['levering', 'uur', 'tijd', 'snel', 'monteur', 'app'] },
  'nieuwe-vestiging': { kort: 'Vestiging', label: 'Nieuwe vestiging', zin: 'openen een nieuwe vestiging', haak: 'Een nieuwe vestiging zoekt nieuwe leveranciers in de buurt. De eerste weken worden de afspraken gemaakt.', winpuntWoorden: ['levering', 'uur', 'project', 'app'] },
  'nieuwbouw-vergunning': { kort: 'Nieuwbouw', label: 'Nieuwbouw of vergunning', zin: 'hebben nieuwbouw of een vergunning', haak: 'Een nieuw project betekent nieuwe leveranciers per project. Wie nu belt, staat op de lijst.', winpuntWoorden: ['project', 'schouw', 'bouw', 'levering'] },
  directiewissel: { kort: 'Directie', label: 'Directiewissel', zin: 'hebben een nieuwe directie', haak: 'Een nieuwe directeur kijkt opnieuw naar leveranciers. De eerste honderd dagen staat alles open.', winpuntWoorden: ['schouw', 'project', 'app'] },
  'subsidie-regeling': { kort: 'Subsidie', label: 'Subsidie of regeling', zin: 'krijgen een subsidie of regeling', haak: 'Een toekenning zet de inkoop in gang. Wie nu belt, zit aan tafel voordat de offertes worden gevraagd.', winpuntWoorden: ['schouw', 'project', 'gratis'] },
  overname: { kort: 'Overname', label: 'Overname', zin: 'zijn overgenomen of nemen over', haak: 'Na een overname worden leveranciers samengevoegd. Dat is het moment om te laten zien wat je anders doet.', winpuntWoorden: ['app', 'project', 'levering'] },
  overig: { kort: 'Overig', label: 'Overig', zin: 'hebben een ander signaal', haak: 'Een signaal zonder vaste soort. Lees de inzichten voor de aanleiding.', winpuntWoorden: [] },
}

export const RADAR = { periodeDagen: 30, perioden: 6, drempel: 1.5, minAccounts: 5, sterk: 3 } as const

const DAG = 864e5
const schoon = (t: string | null | undefined) => String(t ?? '').toLowerCase()

/**
 * De signaalsoort van een inzicht: een vastgelegde soort gaat voor, anders afgeleid uit het type
 * van de agent en de woorden in titel en waarom. De volgorde is bewust: een overname of
 * directiewissel in een vacaturetekst blijft een overname of directiewissel.
 */
export function signaalsoortVan(s: { signaalsoort?: string | null; type?: string | null; title?: string | null; waarom?: string | null }): Signaalsoort {
  if (s.signaalsoort && (SIGNAALSOORTEN as readonly string[]).includes(s.signaalsoort)) return s.signaalsoort as Signaalsoort
  const t = `${schoon(s.title)} ${schoon(s.waarom)}`
  if (/\bovername\b|overgenomen|neemt .{1,40} over|\bfusie|fuseert/.test(t)) return 'overname'
  if (/directiewissel|nieuwe directeur|nieuwe directie|nieuwe ceo|benoemd tot|nieuwe eigenaar|bestuurswissel|treedt aan als/.test(t)) return 'directiewissel'
  if (schoon(s.type) === 'vacature' || /vacature|zoekt .{0,30}(monteur|medewerker|werkvoorbereider|planner|personeel|collega)|\bwerven\b/.test(t)) return 'vacatures'
  if (/subsidie|regeling|toekenning|\bisde\b|\bsde\b|verduurzaming|van het gas af/.test(t)) return 'subsidie-regeling'
  if (schoon(s.type) === 'aanbesteding' || /nieuwbouw|vergunning|bouwproject|woonproject|aanbesteding|bedrijfshal|uitbreiding van het pand/.test(t)) return 'nieuwbouw-vergunning'
  if (/nieuwe vestiging|vestiging in|opent .{0,30}(vestiging|kantoor|filiaal)|nieuw filiaal|nieuw kantoor|verhuist naar/.test(t)) return 'nieuwe-vestiging'
  return 'overig'
}

/** Telt mee: een inzicht met bron (extern, Waarnemer of handmatig met bron), niet afgewezen of tegengehouden. */
export function telbaar(s: { bron?: string | null; agent?: string | null; status: string }): boolean {
  if (['afgewezen', 'tegengehouden'].includes(s.status)) return false
  return s.bron === 'extern' || s.agent === 'waarnemer' || s.agent === 'handmatig'
}

/** De periode van een datum: 0 is de laatste 30 dagen, 1 tot en met 6 de perioden daarvoor, anders null. */
export function periodeVan(createdAt: string, nu: Date): number | null {
  const dagen = (nu.getTime() - Date.parse(createdAt)) / DAG
  if (!(dagen >= 0)) return dagen > -1 ? 0 : null
  const p = Math.floor(dagen / RADAR.periodeDagen)
  return p <= RADAR.perioden ? p : null
}

/** Normaal: het gemiddelde aantal accounts per periode over de vorige zes perioden. */
export function normaal(perPeriode: number[]): number {
  const v = perPeriode.slice(0, RADAR.perioden)
  while (v.length < RADAR.perioden) v.push(0)
  return v.reduce((s, n) => s + n, 0) / RADAR.perioden
}

export type Niveau = 'leeg' | 'normaal' | 'verhoogd' | 'golf' | 'sterk'
export interface GolfOordeel { golf: boolean; factor: number | null; niveau: Niveau; reden: string }

/** Is het een golf? Minstens 5 accounts en minstens 1,5 keer normaal; zonder normaal telt elk aantal als boven normaal. */
export function golfOordeel(aantal: number, norm: number): GolfOordeel {
  const factor = norm > 0 ? aantal / norm : null
  const boven = aantal > 0 && (factor === null || factor >= RADAR.drempel)
  const genoeg = aantal >= RADAR.minAccounts
  const golf = boven && genoeg
  const niveau: Niveau = aantal === 0 ? 'leeg' : golf ? (factor === null || factor >= RADAR.sterk ? 'sterk' : 'golf') : boven ? 'verhoogd' : 'normaal'
  let reden: string
  if (aantal === 0) reden = 'Geen signalen in de laatste 30 dagen.'
  else if (golf) reden = `${aantal} accounts in de laatste 30 dagen, normaal ${getal(norm)} per periode. ${factor === null ? 'Eerder kwam dit signaal hier niet voor.' : `Dat is ${factorTekst(factor)}.`} Een golf begint bij 1,5 keer normaal en 5 accounts.`
  else if (!genoeg && boven) reden = `${aantal} ${aantal === 1 ? 'account' : 'accounts'}, ${factor === null ? 'eerder niet gezien' : factorTekst(factor)}. Geen golf: daarvoor zijn minstens 5 accounts nodig.`
  else if (!genoeg) reden = `${aantal} ${aantal === 1 ? 'account' : 'accounts'}, rond normaal (${getal(norm)} per periode). Geen golf: daarvoor zijn minstens 5 accounts en 1,5 keer normaal nodig.`
  else reden = `${aantal} accounts, ${factorTekst(factor!)}. Geen golf: daarvoor is minstens 1,5 keer normaal nodig.`
  return { golf, factor, niveau, reden }
}

/** "2,6 keer normaal" */
export function factorTekst(f: number | null): string {
  if (f === null) return 'nieuw'
  return `${getal(f)} keer normaal`
}
/** Eén decimaal met een komma; hele getallen zonder decimaal. */
export function getal(n: number): string {
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1).replace('.', ',')
}

export interface RadarSignaal { id: string; accountId: string; brancheId: string | null; soort: Signaalsoort; createdAt: string }
export interface Cel {
  brancheId: string | null
  soort: Signaalsoort
  /** Accounts in de laatste 30 dagen. */
  aantal: number
  /** Signalen in de laatste 30 dagen. */
  signalen: number
  /** Accounts per vorige periode: index 0 is 30 tot 60 dagen geleden. */
  perPeriode: number[]
  normaal: number
  accountIds: string[]
  oordeel: GolfOordeel
}
export const celSleutel = (brancheId: string | null, soort: string) => `${brancheId ?? 'zonder'}|${soort}`

/** Tel per branche en soort: accounts per periode (een account telt één keer per periode), normaal en het oordeel. */
export function telCellen(signalen: RadarSignaal[], nu: Date): Map<string, Cel> {
  const per = new Map<string, { brancheId: string | null; soort: Signaalsoort; perioden: Set<string>[]; signalen: number }>()
  for (const s of signalen) {
    const p = periodeVan(s.createdAt, nu)
    if (p === null) continue
    const k = celSleutel(s.brancheId, s.soort)
    let c = per.get(k)
    if (!c) { c = { brancheId: s.brancheId, soort: s.soort, perioden: Array.from({ length: RADAR.perioden + 1 }, () => new Set<string>()), signalen: 0 }; per.set(k, c) }
    c.perioden[p]!.add(s.accountId)
    if (p === 0) c.signalen++
  }
  const uit = new Map<string, Cel>()
  for (const [k, c] of per) {
    const perPeriode = c.perioden.slice(1).map((x) => x.size)
    const n = normaal(perPeriode)
    const aantal = c.perioden[0]!.size
    uit.set(k, { brancheId: c.brancheId, soort: c.soort, aantal, signalen: c.signalen, perPeriode, normaal: n, accountIds: [...c.perioden[0]!], oordeel: golfOordeel(aantal, n) })
  }
  return uit
}

/** Een lege cel, voor een cel zonder signalen in zeven perioden. */
export function legeCel(brancheId: string | null, soort: Signaalsoort): Cel {
  return { brancheId, soort, aantal: 0, signalen: 0, perPeriode: Array(RADAR.perioden).fill(0), normaal: 0, accountIds: [], oordeel: golfOordeel(0, 0) }
}

/**
 * Het winpunt dat past bij een golf: eerst een winpunt dat aan de branche hangt, dan een winpunt
 * waarvan de woorden bij de signaalsoort passen, dan de keuze van winpuntVoor (impact en weging).
 */
export function winpuntVoorGolf(soort: Signaalsoort, brancheId: string | null, winpunten: Winpunt[], winpuntBranche: { winpuntId: string; brancheId: string }[] = []): { winpunt: Winpunt | null; reden: string | null } {
  const actief = winpunten.filter((w) => w.actief)
  if (!actief.length) return { winpunt: null, reden: null }
  const bijBranche = actief.filter((w) => winpuntBranche.some((x) => x.winpuntId === w.id && x.brancheId === brancheId))
  if (bijBranche.length) return { winpunt: kiesWinpunt(bijBranche), reden: 'Hoort bij deze branche in je verkoopverhaal.' }
  const woorden = SOORT_INFO[soort].winpuntWoorden
  const score = (w: Winpunt) => woorden.filter((x) => schoon(`${w.titel} ${w.omschrijving} ${w.waarom ?? ''}`).includes(x)).length
  const besten = actief.map((w) => ({ w, s: score(w) })).filter((x) => x.s > 0)
  if (besten.length) {
    const max = Math.max(...besten.map((x) => x.s))
    return { winpunt: kiesWinpunt(besten.filter((x) => x.s === max).map((x) => x.w)), reden: `Past bij ${SOORT_INFO[soort].label.toLowerCase()}.` }
  }
  return { winpunt: winpuntVoor(null, null, { winpunten: actief }).winpunt, reden: 'Het sterkste winpunt uit je verkoopverhaal.' }
}

/**
 * Plekken in de komende belblokken voor koude acquisitie: elk vast blok (niet opvolging) op een
 * werkdag in de komende dagen, gesprekstijd zonder marge, gedeeld door de kortste gespreksduur.
 */
export function plekkenInBlokken(blokken: VastBlok[], nu: Date, dagen = 14, inst: WerkdagInstelling = {}): { momenten: number; plekken: number } {
  let momenten = 0
  let plekken = 0
  const begin = nlMoment(nu).datum
  for (let i = 0; i < dagen; i++) {
    const dag = plusDagen(begin, i)
    if (!isWerkdag(dag, inst)) continue
    const weekdag = new Date(`${dag}T12:00:00Z`).getUTCDay()
    for (const b of blokken) {
      if (b.soort === 'opvolging' || !b.dagen.includes(weekdag)) continue
      const aandeel = b.soort === 'gemengd' ? (b.verhouding ?? STANDAARD_VERHOUDING) / 100 : 1
      momenten++
      plekken += Math.floor((gesprekstijdIn(b.minuten) * aandeel) / MIN_GESPREK)
    }
  }
  return { momenten, plekken }
}

/** De zin onder een golf over de capaciteit in de komende belblokken. */
export function capaciteitTekst(c: { eigen: number; collegas: number; plekken: number; bezet: number }): { tekst: string; past: 'ja' | 'deels' | 'nee' } {
  const vrij = Math.max(0, c.plekken - c.bezet)
  const anderen = c.collegas ? ` ${c.collegas} ${c.collegas === 1 ? 'account is' : 'accounts zijn'} van collega's.` : ''
  if (!c.eigen) return { tekst: `Geen van deze accounts staat op jouw naam.${anderen} Een belronde zet de taken bij de eigenaars.`, past: 'nee' }
  if (!c.plekken) return { tekst: `Je hebt de komende twee weken geen belblok voor koude acquisitie. Zet er een bij Belblokken.${anderen}`, past: 'nee' }
  if (c.eigen <= vrij) return { tekst: `Past in je belblokken van de komende twee weken: ${vrij} van ${c.plekken} plekken vrij voor ${c.eigen} ${c.eigen === 1 ? 'account' : 'accounts'}.${anderen}`, past: 'ja' }
  return { tekst: `Past deels: ${vrij} van ${c.eigen} accounts in je belblokken van de komende twee weken (${c.plekken} plekken, ${c.bezet} bezet).${anderen}`, past: vrij ? 'deels' : 'nee' }
}
