// Blokken op Dagstart en Weekstart (en kort in de mails): lege belblokken met een vulvoorstel, de
// belprioriteit naast je afspraken, kansen langs de route, lopende campagnes en lopende accountplannen.
// Alleen de eigen data van de ingelogde gebruiker. De pure kern staat hier; de server laadt de bron in
// server/utils/ritmeBlokken.ts. Het vulvoorstel gebruikt dezelfde rekenregels als de vuller van de
// belblokken (gesprekstijdIn, vulBlok, schatDuur uit shared/belblokken.ts).
import { gesprekstijdIn, MIN_GESPREK, SOORT_LABEL, STANDAARD_VERHOUDING, vulBlok, type BelKandidaat, type BlokSoort } from './belblokken'
import { nlMoment } from './datum'

export interface RitmeSessieBron {
  id: string; start: string; eind: string; status: string; soort: BlokSoort | null; verhouding: number | null
  /** Geschatte duur (minuten) van elk gesprek dat al aan het blok hangt. */
  duren: number[]
}
export interface VulKandidaat extends BelKandidaat { duur: number }
export interface VulRegel { accountId: string; accountNaam: string; reden: string; taskId: string | null; herkomst: 'koud' | 'opvolging' }
export interface BelblokVoorstel {
  id: string; datum: string; start: string; eind: string; status: string; soort: BlokSoort; soortLabel: string
  gesprekken: number; capaciteit: number; ruimte: number; leeg: boolean; stand: string; kanVullen: boolean; voorstel: VulRegel[]
}

const meervoud = (n: number, een: string, meer: string) => `${n} ${n === 1 ? een : meer}`

/** Hoe vol een blok is, in woorden: "Leeg, plek voor ongeveer 9 gesprekken" of "3 gesprekken, plek voor nog 2". */
export function belblokStand(gesprekken: number, ruimteMinuten: number): string {
  const nog = Math.floor(ruimteMinuten / MIN_GESPREK)
  if (!gesprekken) return `Leeg, plek voor ongeveer ${meervoud(nog, 'gesprek', 'gesprekken')}`
  return nog > 0 ? `${meervoud(gesprekken, 'gesprek', 'gesprekken')}, plek voor nog ${nog}` : `${meervoud(gesprekken, 'gesprek', 'gesprekken')}, vol`
}

/**
 * De belblokken die leeg zijn of te weinig gesprekken hebben (minstens één gesprek ruimte), met een
 * voorstel uit de bellijst dat past bij de soort van het blok. Elke kandidaat komt in hooguit één blok;
 * wie die dag een afspraak heeft (`bezetPerDag`), komt in een blok van die dag niet voor. Blokken die al
 * voorbij zijn, lopen of klaar zijn, doen niet mee.
 */
export function vulVoorstellen(sessies: RitmeSessieBron[], kandidaten: VulKandidaat[], nu: Date, bezetPerDag: Map<string, Set<string>> = new Map()): BelblokVoorstel[] {
  const gebruikt = new Set<string>()
  const uit: BelblokVoorstel[] = []
  for (const s of [...sessies].sort((a, b) => a.start.localeCompare(b.start))) {
    if (s.status !== 'gepland' || Date.parse(s.eind) <= nu.getTime()) continue
    const minuten = Math.round((Date.parse(s.eind) - Date.parse(s.start)) / 60_000)
    const capaciteit = gesprekstijdIn(minuten)
    const ruimte = Math.max(0, capaciteit - s.duren.reduce((t, d) => t + d, 0))
    if (ruimte < MIN_GESPREK) continue
    const datum = nlMoment(new Date(s.start)).datum
    const bezet = bezetPerDag.get(datum) ?? new Set<string>()
    const soort = s.soort ?? 'gemengd'
    const pool = kandidaten.filter((k) => !gebruikt.has(k.accountId) && !bezet.has(k.accountId))
    const kies = vulBlok(soort, pool, ruimte, s.verhouding ?? STANDAARD_VERHOUDING)
    for (const k of kies) gebruikt.add(k.accountId)
    uit.push({
      id: s.id, datum, start: s.start, eind: s.eind, status: s.status, soort, soortLabel: SOORT_LABEL[soort],
      gesprekken: s.duren.length, capaciteit, ruimte, leeg: !s.duren.length, stand: belblokStand(s.duren.length, ruimte),
      kanVullen: kies.length > 0,
      voorstel: kies.map((k) => ({ accountId: k.accountId, accountNaam: k.accountNaam, reden: k.reden, taskId: k.taskId ?? null, herkomst: k.herkomst })),
    })
  }
  return uit
}

// ── De vorm van de blokken (API en mail) ──────────────────────────────────

export interface RitmeAfspraak { id: string; start: string; eind: string; titel: string; vorm: string; accountId: string | null; accountNaam: string | null }
export interface BelPrioriteit { accountId: string; accountNaam: string; contactNaam: string | null; telefoon: string | null; reden: string; score: number; heet: boolean; taskId: string | null; inBelblok: boolean }
export interface RouteKans { accountId: string; naam: string; omrij: number; score: number; reden: string | null; taakId: string | null; momentStart: string | null }
export interface CampagneStand {
  id: string; naam: string; eindOp: string | null; dagenOver: number | null; tempo: { voortgang: number; verwacht: number; pil: string } | null
  kaarten: { gedaan: number; totaal: number }; aanDeBeurt: number; taken: { id: string; titel: string; accountNaam: string | null; due: string | null; teLaat: boolean }[]
}
export interface PlanStand {
  id: string; titel: string; accountId: string; accountNaam: string; geldigTot: string | null
  voortgang: { totaal: number; klaar: number; percentage: number }; open: number
  acties: { id: string; titel: string; due: string | null; teLaat: boolean }[]; volgende: { id: string; titel: string; due: string | null } | null
}
export interface BelblokDagVoorstel { datum: string; start: string; eind: string; uitleg: string | null }
export interface RitmeBlokken {
  periode: 'dag' | 'week'
  /** null: de functie staat voor deze gebruiker uit. */
  belblokken: { blokken: BelblokVoorstel[]; voorstellen: BelblokDagVoorstel[]; totaal: number } | null
  belprioriteit: { afspraken: RitmeAfspraak[]; lijst: BelPrioriteit[] } | null
  kansen: { dagen: { datum: string; bezoeken: number; kansen: RouteKans[] }[] } | null
  campagnes: { lopend: CampagneStand[] } | null
  accountplannen: { lopend: PlanStand[] } | null
}

/** De functies achter elk blok (shared/functies.ts). */
export const RITME_BLOK_FUNCTIE = {
  belblokken: 'belblok.uitvoeren',
  belprioriteit: 'bezoeken.bellijst',
  kansen: 'bezoeken.route',
  campagnes: 'campagnes.meedoen',
  accountplannen: 'nav.accountplannen',
} as const

const hhmm = (iso: string) => { const m = nlMoment(new Date(iso)); return `${String(m.uur).padStart(2, '0')}:${String(m.minuut).padStart(2, '0')}` }
const dagKort = (d: string) => new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`))

/** De blokken kort, als regels voor de dagstart- en weekstartmail. Een blok zonder inhoud valt weg. */
export function ritmeBlokkenMail(b: RitmeBlokken | null | undefined): string[] {
  if (!b) return []
  const week = b.periode === 'week'
  const wanneer = (iso: string) => (week ? `${dagKort(nlMoment(new Date(iso)).datum)} ${hhmm(iso)}` : hhmm(iso))
  const uit: string[] = []
  const blok = (kop: string, regels: string[]) => { if (regels.length) uit.push('', kop, ...regels) }
  if (b.belblokken) {
    blok('Belblokken om te vullen', [
      ...b.belblokken.blokken.slice(0, 4).map((x) => `- ${wanneer(x.start)} ${x.soortLabel}: ${x.stand}${x.voorstel.length ? `. Past: ${x.voorstel.slice(0, 3).map((v) => v.accountNaam).join(', ')}` : ''}`),
      ...b.belblokken.voorstellen.slice(0, 3).map((v) => `- Nog geen belblok${week ? ` op ${dagKort(v.datum)}` : ''}. Voorstel: ${hhmm(v.start)} tot ${hhmm(v.eind)}`),
    ])
  }
  if (b.belprioriteit) blok('Bel eerst', b.belprioriteit.lijst.slice(0, 3).map((x) => `- ${x.accountNaam}: ${x.reden}`))
  if (b.kansen) blok('Kansen langs de route', b.kansen.dagen.flatMap((d) => d.kansen.slice(0, 3).map((k) => `- ${week ? `${dagKort(d.datum)}: ` : ''}${k.naam} (${k.omrij} min omrijden)`)))
  if (b.campagnes) blok('Lopende campagnes', b.campagnes.lopend.slice(0, 4).map((c) => `- ${c.naam}: ${c.kaarten.gedaan} van ${c.kaarten.totaal} kaarten gedaan${c.aanDeBeurt ? `, ${c.aanDeBeurt} aan de beurt` : ''}`))
  if (b.accountplannen) blok('Lopende accountplannen', b.accountplannen.lopend.slice(0, 4).map((p) => `- ${p.accountNaam}: ${p.voortgang.klaar} van ${p.voortgang.totaal} acties klaar${p.open ? `, ${p.open} open ${week ? 'deze week' : 'vandaag'}` : ''}`))
  return uit
}
