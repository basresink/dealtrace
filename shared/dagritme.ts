// Het dagritme (P32, 8.13, uit dexRitme): de vorm van het moment, de focus (de eerste zet met de
// reden erbij) en de tip van de dag. Puur, met `nu` als parameter. Dealtrace rekent met de reis in
// plaats van met deals (B17).
import { GESPREKKEN_PER_UUR } from './dagplanning'
import { isWerkdag, nlMoment, nlTijdstip, plusDagen, type WerkdagInstelling } from './datum'
import type { Dag, Regel } from './dag'
import { NORMEN, tempo } from './team'

export type Vorm = 'weekstart' | 'weekafsluiting' | 'dagstart'
/** Maandag weekstart, vrijdag vanaf 15:00 weekafsluiting, anders dagstart (Nederlandse tijd). */
export function bepaalVorm(nu: Date): Vorm {
  const m = nlMoment(nu)
  const wd = new Date(`${m.datum}T12:00:00Z`).getUTCDay()
  if (wd === 1) return 'weekstart'
  if (wd === 5 && m.uur >= 15) return 'weekafsluiting'
  return 'dagstart'
}

export interface Focus {
  regel: '1-eerste-afspraak' | '2-afspraak' | '2b-verslag' | '2c-poging' | '3-achterstallig' | '4-overdragen' | '5-kans' | 'leeg'
  wat: string; waarom: string; wanneer: string | null; accountId: string | null; taakId: string | null; verslagVan: string | null
  knop: { soort: 'navigeer' | 'bel' | 'verslag' | 'open' | 'overdragen' | 'bellijst'; tekst: string; href: string | null }
}

/**
 * De eerste zet (Dex, uitgebreid met de reis): 1. komende eerste afspraak; 2. eerste komende of
 * lopende afspraak; 2b. alles geweest en een afspraak zonder verslag; 2c. de poging die vandaag moet
 * uit het hercontactritme; 3. de zwaarste achterstallige actie; 4. een gehouden eerste afspraak die
 * nog niet is overgedragen; 5. een kans langs de route (vanaf P14). Een afspraak op precies het
 * eindtijdstip is geweest.
 */
export function kiesFocus(dag: Pick<Dag, 'stapels' | 'isVandaag'>, nu: Date, kansen: { accountId: string; naam: string; waarom: string }[] = []): Focus | null {
  if (!dag.isVandaag) return null
  const t = nu.getTime()
  const { afspraken, bellen, acties, eersteAfspraken } = dag.stapels
  const komend = afspraken.filter((a) => a.eind && Date.parse(a.eind) > t)
  const naar = (a: Regel, regel: Focus['regel'], waarom: string): Focus => ({
    regel, wat: `${a.tijd ?? ''} ${a.accountNaam ?? a.titel}`.trim(), waarom, wanneer: a.start, accountId: a.accountId, taakId: a.taakId, verslagVan: null,
    knop: a.navigeer ? { soort: 'navigeer', tekst: `Navigeer naar ${a.accountNaam ?? 'de afspraak'}`, href: a.navigeer } : { soort: 'open', tekst: `Open ${a.accountNaam ?? 'de afspraak'}`, href: a.accountId ? `/accounts/${a.accountId}` : null },
  })
  const eerste = komend.find((a) => a.eerste)
  if (eerste) return naar(eerste, '1-eerste-afspraak', 'Je eerste afspraak met dit account. Bereid je voor op wie erbij zit en wat je wilt weten.')
  if (komend[0]) return naar(komend[0], '2-afspraak', Date.parse(komend[0].start ?? '') <= t ? 'Deze afspraak loopt nu.' : 'Je volgende afspraak vandaag.')
  const zonder = afspraken.find((a) => a.zonderVerslag)
  if (zonder) return { regel: '2b-verslag', wat: `Verslag van ${zonder.accountNaam ?? zonder.titel}`, waarom: 'De afspraak is geweest en het verslag ontbreekt nog.', wanneer: zonder.start, accountId: zonder.accountId, taakId: zonder.taakId, verslagVan: zonder.taakId, knop: { soort: 'verslag', tekst: 'Leg het verslag vast', href: null } }
  const bel = (r: Regel, regel: Focus['regel'], waarom: string): Focus => ({
    regel, wat: r.titel, waarom, wanneer: r.start, accountId: r.accountId, taakId: r.taakId, verslagVan: null,
    knop: r.contact?.tel ? { soort: 'bel', tekst: `Bel ${r.contact.naam}`, href: r.contact.tel } : { soort: 'open', tekst: 'Open de actie', href: r.accountId ? `/accounts/${r.accountId}` : null },
  })
  const poging = bellen.find((r) => r.poging && !r.achterstallig)
  if (poging) return bel(poging, '2c-poging', 'Deze poging uit het hercontactritme moet vandaag.')
  const zwaarste = [...bellen, ...acties].filter((r) => r.achterstallig).sort((a, b) => (a.priority === 'urgent' ? 0 : a.priority === 'hoog' ? 1 : 2) - (b.priority === 'urgent' ? 0 : b.priority === 'hoog' ? 1 : 2) || (a.start ?? '').localeCompare(b.start ?? ''))[0]
  if (zwaarste) return bel(zwaarste, '3-achterstallig', 'Je zwaarste achterstallige actie. Daarna wordt de rest kleiner.')
  const overdragen = eersteAfspraken.find((r) => r.knop === 'overdragen')
  if (overdragen) return { regel: '4-overdragen', wat: overdragen.titel, waarom: 'De eerste afspraak is gehouden; draag hem over zodat het vervolg niet blijft liggen.', wanneer: null, accountId: overdragen.accountId, taakId: null, verslagVan: null, knop: { soort: 'overdragen', tekst: `Open ${overdragen.accountNaam}`, href: `/accounts/${overdragen.accountId}` } }
  const kans = kansen[0]
  if (kans) return { regel: '5-kans', wat: kans.naam, waarom: kans.waarom, wanneer: null, accountId: kans.accountId, taakId: null, verslagVan: null, knop: { soort: 'open', tekst: `Open ${kans.naam}`, href: `/accounts/${kans.accountId}` } }
  const eerstvolgende = [...bellen, ...acties][0]
  if (eerstvolgende) return bel(eerstvolgende, '3-achterstallig', 'De eerste actie van vandaag.')
  return null
}

/** De focus op een lege dag (eerlijke lege staat). */
export const LEGE_FOCUS: Focus = {
  regel: 'leeg', wat: 'Niets dringends vandaag.', waarom: 'Een lege agenda is het beste moment om te prospecteren.', wanneer: null, accountId: null, taakId: null, verslagVan: null,
  knop: { soort: 'bellijst', tekst: 'Open de bellijst', href: '/bellen' },
}

const TIPS = [
  'Bel je lastigste gesprek voor 10:00; dan ben je het scherpst.',
  'Noem in elk gesprek één winpunt, niet vijf.',
  'Leg je verslag vast binnen een uur na de afspraak; dan weet je het nog precies.',
  'Vraag aan het eind van elk gesprek wanneer je terug mag bellen.',
  'Een nee met reden is ook een uitkomst. Leg hem vast, dan komt het account op tijd terug.',
]
/** Tip van de dag: na de werkdag niets; bij achterstand of een lege dag een passende tip; anders één per dag. */
export function kiesTip(p: { nu: Date; achterstallig: number; leeg: boolean; werkdagEind?: number }): string | null {
  const m = nlMoment(p.nu)
  if (m.uur >= (p.werkdagEind ?? 18)) return null
  if (p.achterstallig >= 3) return 'Begin met de oudste achterstallige actie. Elke afgeronde actie maakt de lijst korter.'
  if (p.leeg) return 'Geen afspraken vandaag: plan een belblok en bel je warmste prospects.'
  const dagNr = Math.floor(Date.parse(`${m.datum}T00:00:00Z`) / 864e5)
  return TIPS[dagNr % TIPS.length]!
}

/** Groet bij de vorm: "Goedemorgen, Jan. Een nieuwe week." */
export function groetMetVorm(groet: string, vorm: Vorm): string {
  return vorm === 'weekstart' ? `${groet} Een nieuwe week.` : vorm === 'weekafsluiting' ? `${groet} De week zit erop bijna.` : groet
}

// ── Weekstart (maandag) ────────────────────────────────────────────────────
// Het weekplan: afspraken en bezoeken per dag, de belblokken, de voornemens uit de weekreview van
// vrijdag met hun stand, wat er openstaat, het tempo tegen je doel en de belangrijkste aanleidingen.

export interface WeekAfspraak { id: string; start: string; eind: string; titel: string; accountId: string | null; accountNaam: string | null; vorm: 'bezoek' | 'online' | 'telefoon' | string; eerste?: boolean }
export interface WeekBelblok { id: string; start: string; eind: string; status: string; gesprekken?: number }
export interface WeekstartBron {
  gebruiker: { id: string; naam: string; werkplek?: string | null }
  afspraken: WeekAfspraak[]
  belblokken: WeekBelblok[]
  voornemens: { id: string; tekst: string; soort: string; gedeeld: boolean; stand: { tekst: string; klaar: boolean } }[]
  open: { totaal: number; achterstallig: number; dezeWeek: number; blijvers: number }
  /** Pogingen in de werkdagen van deze week voor vandaag. */
  pogingen: number
  aanleidingen: { id: string; titel: string; accountId: string | null; accountNaam: string | null; relevantie: number; op: string }[]
  werkdagen?: WerkdagInstelling
}
export interface WeekItem { soort: 'afspraak' | 'bezoek' | 'belblok'; id: string; tijd: string; titel: string; sub: string | null; href: string }
export interface Weekstart {
  vorm: Vorm; kicker: string; titel: string; samenvatting: string
  week: { nummer: number; van: string; tot: string }
  dagen: { datum: string; label: string; vandaag: boolean; werkdag: boolean; items: WeekItem[] }[]
  voornemens: WeekstartBron['voornemens']
  open: WeekstartBron['open'] & { tekst: string }
  tempo: { doel: number; perDag: number; gedaan: number; procent: number; stand: 'op schema' | 'achter' | 'geen'; tekst: string }
  aanleidingen: WeekstartBron['aanleidingen']
}

const meervoud = (n: number, een: string, meer: string) => `${n} ${n === 1 ? een : meer}`
const hhmm = (iso: string) => { const m = nlMoment(new Date(iso)); return `${String(m.uur).padStart(2, '0')}:${String(m.minuut).padStart(2, '0')}` }
const dagLabel = (datum: string) => new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${datum}T12:00:00Z`))
const hoofdletter = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** De week van de weekstart: maandag tot vrijdag; in het weekend al de week erna. */
export function weekVan(nu: Date): { van: string; tot: string } {
  const d = nlMoment(nu).datum
  const w = new Date(`${d}T12:00:00Z`).getUTCDay()
  const van = w === 6 ? plusDagen(d, 2) : w === 0 ? plusDagen(d, 1) : plusDagen(d, -((w + 6) % 7))
  return { van, tot: plusDagen(van, 4) }
}

export function bouwWeekstart(bron: WeekstartBron, nu: Date): Weekstart {
  const week = weekVan(nu)
  const vandaag = nlMoment(nu).datum
  const w = bron.werkdagen ?? {}
  const datums = [0, 1, 2, 3, 4].map((i) => plusDagen(week.van, i))
  const items = (datum: string): WeekItem[] => [
    ...bron.afspraken.filter((a) => nlMoment(new Date(a.start)).datum === datum).map((a): WeekItem => ({
      soort: a.vorm === 'bezoek' ? 'bezoek' : 'afspraak', id: a.id, tijd: hhmm(a.start), titel: a.accountNaam ? `${a.titel} met ${a.accountNaam}` : a.titel,
      sub: a.eerste ? 'Eerste afspraak' : a.vorm === 'bezoek' ? 'Op locatie' : a.vorm === 'telefoon' ? 'Telefonisch' : 'Online', href: `/agenda?weergave=dag&afspraak=${a.id}`,
    })),
    ...bron.belblokken.filter((b) => nlMoment(new Date(b.start)).datum === datum && b.status !== 'geannuleerd').map((b): WeekItem => ({
      soort: 'belblok', id: b.id, tijd: hhmm(b.start), titel: 'Belblok', sub: `${hhmm(b.start)} tot ${hhmm(b.eind)}${b.gesprekken ? ` · ${meervoud(b.gesprekken, 'gesprek', 'gesprekken')}` : ''}${b.status === 'klaar' ? ' · gehouden' : ''}`, href: '/belblokken',
    })),
  ].sort((a, b) => a.tijd.localeCompare(b.tijd))
  const dagen = datums.map((datum) => ({ datum, label: hoofdletter(dagLabel(datum)), vandaag: datum === vandaag, werkdag: isWerkdag(datum, w), items: items(datum) }))
  const bezoeken = bron.afspraken.filter((a) => a.vorm === 'bezoek').length
  const overig = bron.afspraken.length - bezoeken
  const blokken = bron.belblokken.filter((b) => b.status !== 'geannuleerd').length
  const werkdagenWeek = datums.filter((d) => isWerkdag(d, w)).length
  const perDag = NORMEN.pogingenPerDag[bron.gebruiker.werkplek ?? 'binnendienst'] ?? 25
  const doel = perDag * werkdagenWeek
  const verstreken = datums.filter((d) => d < vandaag && isWerkdag(d, w)).length
  const t = tempo({ pogingen: bron.pogingen, werkdagen: verstreken }, bron.gebruiker.werkplek)
  const tempoTekst = t.stand === 'geen'
    ? `Doel deze week: ${doel} pogingen, ${perDag} per werkdag.`
    : `${bron.pogingen} van ${doel} pogingen gedaan. ${t.stand === 'op schema' ? 'Je ligt op schema.' : `Je loopt achter: tot nu toe ${t.procent}% van het tempo.`}`
  const o = bron.open
  const openTekst = !o.totaal ? 'Er staat niets open.'
    : `${meervoud(o.totaal, 'taak staat', 'taken staan')} open, ${o.dezeWeek} met een datum deze week${o.achterstallig ? `, ${o.achterstallig} over tijd` : ''}${o.blijvers ? `, ${meervoud(o.blijvers, 'blijver', 'blijvers')}` : ''}.`
  const naam = bron.gebruiker.naam.replace(/^Testgebruiker /, '').split(' ')[0]
  return {
    vorm: 'weekstart',
    kicker: `Weekstart · week ${weekNr(week.van)}`,
    titel: bepaalVorm(nu) === 'weekstart' ? groetMetVorm(`${groetVoorUur(nu)}, ${naam}.`, 'weekstart') : `${groetVoorUur(nu)}, ${naam}. Je week in één blik.`,
    samenvatting: weekSamenvatting([[overig, 'afspraak', 'afspraken'], [bezoeken, 'bezoek', 'bezoeken'], [blokken, 'belblok', 'belblokken'], [bron.voornemens.length, 'voornemen', 'voornemens']]),
    week: { nummer: weekNr(week.van), ...week },
    dagen, voornemens: bron.voornemens,
    open: { ...o, tekst: openTekst },
    tempo: { doel, perDag, gedaan: bron.pogingen, procent: t.procent, stand: t.stand, tekst: tempoTekst },
    aanleidingen: [...bron.aanleidingen].sort((a, b) => b.relevantie - a.relevantie || b.op.localeCompare(a.op)).slice(0, 3),
  }
}

/** "3 afspraken, 2 belblokken en 1 voornemen." zonder nullen; een lege week zegt dat. */
export function weekSamenvatting(delen: [number, string, string][]): string {
  const l = delen.filter(([n]) => n > 0).map(([n, een, meer]) => meervoud(n, een, meer))
  if (!l.length) return 'Nog niets gepland deze week.'
  return `${l.length > 1 ? `${l.slice(0, -1).join(', ')} en ${l[l.length - 1]}` : l[0]}.`
}

function weekNr(datum: string): number {
  const d = new Date(`${datum}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3)
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  return 1 + Math.round(((d.getTime() - jan4.getTime()) / 864e5 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7)
}
const groetVoorUur = (nu: Date) => { const u = nlMoment(nu).uur; return u < 12 ? 'Goedemorgen' : u < 18 ? 'Goedemiddag' : 'Goedenavond' }

// ── Dagstart: de dagplanner (F3) ───────────────────────────────────────────
// Afspraken staan vast, bezoeken op route met de reistijd ervoor, belblokken in het uur waarop de
// doelgroep het vaakst opneemt (bereikbaarheid per branche en uur uit alle belpogingen), een
// voorbereidingsblok voor de eerste afspraak, lunch, en bij een wijziging "wat schoof".

export const BEREIK_UREN = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17] as const
/** Onder dit aantal belpogingen is de bereikbaarheid nog geen grond voor een keuze. */
export const BEREIK_MINIMUM = 30
export const BEREIK_MIN_PER_UUR = 5
export interface BereikPoging { op: string; brancheId: string | null; gesproken: boolean }
export interface BereikUur { uur: number; pogingen: number; opgenomen: number; procent: number | null }
export interface Bereikbaarheid { uren: BereikUur[]; pogingen: number; genoeg: boolean }

/** Bereikbaarheid per uur voor een doelgroep (branches); zonder branches alle pogingen. Alleen werkdagen. */
export function bereikbaarheid(pogingen: BereikPoging[], branches?: string[] | null): Bereikbaarheid {
  const set = branches?.length ? new Set(branches) : null
  const per = new Map<number, { p: number; o: number }>()
  let n = 0
  for (const x of pogingen) {
    if (set && (!x.brancheId || !set.has(x.brancheId))) continue
    const m = nlMoment(new Date(x.op))
    const w = new Date(`${m.datum}T12:00:00Z`).getUTCDay()
    if (w === 0 || w === 6 || m.uur < BEREIK_UREN[0] || m.uur > BEREIK_UREN[BEREIK_UREN.length - 1]!) continue
    const r = per.get(m.uur) ?? { p: 0, o: 0 }
    r.p++; if (x.gesproken) r.o++
    per.set(m.uur, r); n++
  }
  const uren = BEREIK_UREN.map((uur) => { const r = per.get(uur) ?? { p: 0, o: 0 }; return { uur, pogingen: r.p, opgenomen: r.o, procent: r.p >= BEREIK_MIN_PER_UUR ? Math.round((r.o / r.p) * 100) : null } })
  return { uren, pogingen: n, genoeg: n >= BEREIK_MINIMUM }
}

/** Per branche de bereikbaarheid; met te weinig pogingen in de doelgroep valt hij terug op alle branches. */
export function bereikVoorDoelgroep(pogingen: BereikPoging[], branches: string[]): Bereikbaarheid & { bron: 'doelgroep' | 'alle' } {
  const eigen = bereikbaarheid(pogingen, branches)
  if (branches.length && eigen.genoeg) return { ...eigen, bron: 'doelgroep' }
  return { ...bereikbaarheid(pogingen), bron: 'alle' }
}

export type PlanSoort = 'afspraak' | 'bezoek' | 'reis' | 'kans' | 'bel' | 'voorbereiding' | 'lunch' | 'focus' | 'bezet'
export interface PlanBlok { id: string; soort: PlanSoort; start: string; eind: string; titel: string; sub: string | null; vast: boolean; voorstel: boolean; accountId?: string | null; href?: string | null; dagplanner?: string | null }
/** Een vast punt: een afspraak of bezoek, of bezet in de gekoppelde agenda (privé, lunch, extern overleg). */
export interface VastPunt { id: string; soort: 'afspraak' | 'bezoek' | 'bezet'; start: string; eind: string; titel: string; sub?: string | null; accountId?: string | null; reisMinuten?: number | null; eerste?: boolean }
export interface PlanInput {
  dag: string; nu: Date; modus: 'buiten' | 'binnen'
  werkdag?: { start: number; eind: number }
  lunch?: { uur: number; minuut: number; minuten: number } | null
  vast: VastPunt[]
  kansen?: { id: string; naam: string; start: string | null; sub?: string | null; accountId?: string | null }[]
  belblokken: { id: string; start: string; eind: string; gesprekken?: number }[]
  belTaken: number
  acties?: number
  bereik: Bereikbaarheid
  /** Organisatie: je eigen belpogingen waren te weinig, het uur komt uit de belpogingen van de hele organisatie. */
  bereikBron?: 'eigen' | 'organisatie'
  /** Blokken die al vastliggen en niet opnieuw ingedeeld worden (wat de Dagplanner eerder vandaag al deed). */
  extra?: PlanBlok[]
}
export interface Dagplan { blokken: PlanBlok[]; belUur: number | null; belUitleg: string; voorstellen: PlanBlok[]; samenvatting: string }

const MIN = 60_000
const ts = (d: string, uur: number, minuut = 0) => nlTijdstip(d, uur, minuut).getTime()
const iso2 = (t: number) => new Date(t).toISOString()
const overlapt = (a: { s: number; e: number }, b: { s: number; e: number }) => a.s < b.e && b.s < a.e

/** De indeling van één dag. Puur: dezelfde invoer geeft dezelfde dag. */
export function planDag(p: PlanInput): Dagplan {
  const wdag = p.werkdag ?? { start: 8, eind: 18 }
  const dagStart = ts(p.dag, wdag.start)
  const dagEind = ts(p.dag, wdag.eind)
  const isVandaag = nlMoment(p.nu).datum === p.dag
  const nuT = isVandaag ? p.nu.getTime() : 0
  const bezet: { s: number; e: number }[] = []
  const blokken: PlanBlok[] = []
  const zet = (b: PlanBlok) => { blokken.push(b); bezet.push({ s: Date.parse(b.start), e: Date.parse(b.eind) }) }
  const vrij = (s: number, e: number) => s >= dagStart && e <= dagEind && !bezet.some((x) => overlapt(x, { s, e }))

  const vast = [...p.vast].sort((a, b) => a.start.localeCompare(b.start))
  for (const v of vast) {
    if (v.soort === 'bezoek' && v.reisMinuten) {
      const s = Date.parse(v.start) - v.reisMinuten * MIN
      blokken.push({ id: `reis:${v.id}`, soort: 'reis', start: iso2(s), eind: v.start, titel: `Reistijd ${v.reisMinuten} min`, sub: null, vast: true, voorstel: false })
      bezet.push({ s, e: Date.parse(v.start) })
    }
    zet({ id: v.id, soort: v.soort, start: v.start, eind: v.eind, titel: v.titel, sub: v.sub ?? null, vast: true, voorstel: false, accountId: v.accountId ?? null, href: v.soort === 'bezet' ? null : `/agenda?weergave=dag&afspraak=${v.id}` })
  }
  for (const b of p.extra ?? []) zet(b)
  for (const b of p.belblokken) zet({ id: b.id, soort: 'bel', start: b.start, eind: b.eind, titel: 'Belblok', sub: b.gesprekken ? meervoud(b.gesprekken, 'gesprek', 'gesprekken') : 'Staat in je agenda', vast: true, voorstel: false, href: '/belblokken' })

  // Voorbereiding: 30 minuten voor de eerste afspraak (voor de reistijd), anders aan het begin van de dag.
  const eerste = vast.find((v) => v.soort !== 'bezet' && Date.parse(v.start) > nuT)
  if (eerste) {
    const voor = Date.parse(eerste.start) - (eerste.soort === 'bezoek' ? (eerste.reisMinuten ?? 0) : 0) * MIN
    const kandidaten = [voor - 30 * MIN, dagStart]
    const s = kandidaten.find((x) => x >= Math.max(dagStart, nuT) && vrij(x, x + 30 * MIN) && x + 30 * MIN <= voor)
    if (s != null) zet({ id: `voorbereiding:${eerste.id}`, soort: 'voorbereiding', start: iso2(s), eind: iso2(s + 30 * MIN), titel: `Voorbereiding ${eerste.titel}`, sub: 'Pitstop en briefing', vast: false, voorstel: false, accountId: eerste.accountId ?? null, href: eerste.accountId ? `/accounts/${eerste.accountId}` : null })
  }

  // Lunch: om 12:00 als het vrij is, anders het eerste vrije moment tussen 11:30 en 14:00.
  // Een lunch in de gekoppelde agenda (of eerder vandaag al ingedeeld) telt als de lunch.
  const heeftLunch = vast.some((v) => v.soort === 'bezet' && /lunch/i.test(v.titel)) || (p.extra ?? []).some((b) => b.soort === 'lunch')
  if (p.lunch !== null && !heeftLunch) {
    const l = p.lunch ?? { uur: 12, minuut: 0, minuten: 45 }
    const opties = [ts(p.dag, l.uur, l.minuut), ts(p.dag, 11, 30), ts(p.dag, 12, 30), ts(p.dag, 13, 0), ts(p.dag, 13, 15)]
    const s = opties.find((x) => vrij(x, x + l.minuten * MIN))
    if (s != null) zet({ id: 'lunch', soort: 'lunch', start: iso2(s), eind: iso2(s + l.minuten * MIN), titel: 'Lunch', sub: null, vast: false, voorstel: false })
  }

  // Kansen langs de route (buitendienst): een half uur in een gat, hooguit twee.
  if (p.modus === 'buiten') {
    let n = 0
    for (const k of p.kansen ?? []) {
      if (n >= 2 || !k.start) continue
      const s = Date.parse(k.start)
      if (s < nuT || !vrij(s, s + 30 * MIN)) continue
      zet({ id: `kans:${k.id}`, soort: 'kans', start: iso2(s), eind: iso2(s + 30 * MIN), titel: `Kans: ${k.naam}`, sub: k.sub ?? 'Langs de route', vast: false, voorstel: false, accountId: k.accountId ?? null, href: k.accountId ? `/accounts/${k.accountId}` : null })
      n++
    }
  }

  // Belblokken in het beste vrije uur. Binnendienst: genoeg uren voor de belacties (hooguit drie);
  // buitendienst: één blok als er gebeld moet worden.
  const alUren = p.belblokken.reduce((s, b) => s + (Date.parse(b.eind) - Date.parse(b.start)) / 3_600_000, 0)
  const nodig = p.modus === 'binnen' ? Math.min(3, Math.max(1, Math.ceil((p.belTaken * 6) / 60))) : p.belTaken > 0 ? 1 : 0
  const rang = (u: BereikUur) => (p.bereik.genoeg && u.procent != null ? u.procent : -1)
  const uren = [...p.bereik.uren].filter((u) => u.uur >= wdag.start && u.uur < wdag.eind).sort((a, b) => rang(b) - rang(a) || a.uur - b.uur)
  const voorstellen: PlanBlok[] = []
  const aantalVoorstel = Math.max(0, nodig - Math.floor(alUren))
  // Hooguit wat in een blok van een uur past (zoals de Dagplanner: GESPREKKEN_PER_UUR), nooit "66 gesprekken" in een uur.
  const perBlok = Math.min(GESPREKKEN_PER_UUR, Math.max(1, Math.ceil(p.belTaken / Math.max(1, aantalVoorstel))))
  for (let i = 0; i < aantalVoorstel; i++) {
    const u = uren.find((x) => { const s = ts(p.dag, x.uur); return s >= nuT && vrij(s, s + 60 * MIN) })
    if (!u) break
    const s = ts(p.dag, u.uur)
    const b: PlanBlok = { id: `voorstel:bel:${u.uur}`, soort: 'bel', start: iso2(s), eind: iso2(s + 60 * MIN), titel: p.belTaken ? `Belblok ${meervoud(Math.min(perBlok, p.belTaken), 'gesprek', 'gesprekken')}` : 'Belblok uit je bellijst',
      sub: u.procent != null && p.bereik.genoeg ? `${u.procent}% neemt dan op${voorstellen.length === 0 ? ' · beste uur' : ''}` : 'Eerste vrije uur', vast: false, voorstel: true, href: '/belblokken' }
    zet(b); voorstellen.push(b)
  }

  // Binnendienst: één focusblok voor de overige taken in het grootste gat van een uur of meer.
  if (p.modus === 'binnen' && (p.acties ?? 0) > 0) {
    for (let uur = wdag.start; uur < wdag.eind; uur++) {
      const s = ts(p.dag, uur)
      if (s >= nuT && vrij(s, s + 60 * MIN)) { zet({ id: 'focus', soort: 'focus', start: iso2(s), eind: iso2(s + 60 * MIN), titel: 'Taken afwerken', sub: meervoud(p.acties!, 'open taak', 'open taken'), vast: false, voorstel: false, href: '/taken' }); break }
    }
  }

  blokken.sort((a, b) => a.start.localeCompare(b.start) || Number(b.vast) - Number(a.vast))
  const besteVoorstel = voorstellen[0]
  const belUur = besteVoorstel ? nlMoment(new Date(besteVoorstel.start)).uur : null
  let belUitleg: string
  if (!p.bereik.genoeg) belUitleg = `Nog te weinig belpogingen (${p.bereik.pogingen} van ${BEREIK_MINIMUM}) om het beste uur te kiezen. Het belblok staat in het eerste vrije uur.`
  else if (belUur == null) belUitleg = nodig ? 'Er is vandaag geen vrij uur meer voor een belblok.' : 'Vandaag staan er geen belacties; er is geen belblok nodig.'
  else {
    const hier = p.bereik.uren.find((u) => u.uur === belUur)
    const laag = [...p.bereik.uren].filter((u) => u.procent != null && u.uur !== belUur).sort((a, b) => a.procent! - b.procent! || a.uur - b.uur)[0]
    const top = [...p.bereik.uren].filter((u) => u.procent != null).sort((a, b) => b.procent! - a.procent! || a.uur - b.uur)[0]
    const uurT = (u: number) => `${String(u).padStart(2, '0')}:00`
    const verschil = `${hier?.procent ?? 0}% neemt dan op${laag ? ` tegen ${laag.procent}% om ${uurT(laag.uur)}` : ''}.`
    belUitleg = top?.uur === belUur ? `Daarom ligt het belblok om ${uurT(belUur)}: ${verschil}` : `Het belblok ligt om ${uurT(belUur)}, het beste vrije uur: ${verschil} Om ${uurT(top!.uur)} (${top!.procent}%) staat al iets.`
    if (p.bereikBron === 'organisatie') belUitleg += ' Je hebt zelf nog te weinig belpogingen; dit uur komt uit de belpogingen van je organisatie.'
  }
  const afs = blokken.filter((b) => b.soort === 'afspraak').length
  const bez = blokken.filter((b) => b.soort === 'bezoek').length
  const bel = blokken.filter((b) => b.soort === 'bel').length
  const delen = [afs ? meervoud(afs, 'afspraak', 'afspraken') : null, bez ? meervoud(bez, 'bezoek', 'bezoeken') : null, bel ? meervoud(bel, 'belblok', 'belblokken') : null].filter(Boolean)
  return { blokken, belUur, belUitleg, voorstellen, samenvatting: delen.length ? delen.join(', ') : 'Een lege dag' }
}

/** Wat schoof sinds de eerste indeling van de dag: verzette, vervallen en nieuwe afspraken en belblokken. */
export function watSchoof(vorige: Pick<PlanBlok, 'id' | 'soort' | 'start' | 'titel' | 'voorstel'>[] | null | undefined, nu: Pick<PlanBlok, 'id' | 'soort' | 'start' | 'titel' | 'voorstel'>[]): string[] {
  if (!vorige?.length) return []
  const uit: string[] = []
  const telt = (b: { soort: string }) => b.soort === 'afspraak' || b.soort === 'bezoek'
  const nieuw = new Map(nu.filter(telt).map((b) => [b.id, b]))
  const oud = new Map(vorige.filter(telt).map((b) => [b.id, b]))
  for (const [id, b] of oud) {
    const n = nieuw.get(id)
    if (!n) uit.push(`${b.titel} staat niet meer in je agenda.`)
    else if (n.start !== b.start) uit.push(`${b.titel} is verzet van ${hhmm(b.start)} naar ${nlMoment(new Date(n.start)).datum === nlMoment(new Date(b.start)).datum ? hhmm(n.start) : `${dagLabel(nlMoment(new Date(n.start)).datum)} ${hhmm(n.start)}`}.`)
  }
  for (const [id, b] of nieuw) if (!oud.has(id)) uit.push(`Nieuw: ${b.titel} om ${hhmm(b.start)}.`)
  const belOud = vorige.filter((b) => b.soort === 'bel' && b.voorstel).map((b) => hhmm(b.start)).sort()
  const belNu = nu.filter((b) => b.soort === 'bel' && b.voorstel).map((b) => hhmm(b.start)).sort()
  if (belOud.length && belOud.join() !== belNu.join()) uit.push(belNu.length ? `Het belblok schoof van ${belOud.join(' en ')} naar ${belNu.join(' en ')}.` : `Het belblok van ${belOud.join(' en ')} past niet meer vandaag.`)
  return uit
}

/** Buiten- of binnendienst voor de dagplanner: de keuze in de URL, anders de werkplek (hybride: buiten als er bezoeken zijn). */
export function planModus(werkplek: string | null | undefined, gekozen: string | null | undefined, bezoeken: number): 'buiten' | 'binnen' {
  if (gekozen === 'buiten' || gekozen === 'binnen') return gekozen
  if (werkplek === 'buitendienst') return 'buiten'
  if (werkplek === 'hybride') return bezoeken ? 'buiten' : 'binnen'
  return 'binnen'
}
