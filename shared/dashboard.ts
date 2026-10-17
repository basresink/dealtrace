// Mijn dashboard en de funnel in de opzet van DealDrive /rapportage. Puur: de server levert activiteiten,
// prospects en de funnelstand; deze functies rekenen de periode, de tegels, de reeks per dag of week, de
// dekking, het doel en de normen uit. Normen komen uit shared/team (NORMEN), de funnel uit shared/funnel.
import { isWerkdag, plusDagen } from './datum'
import { FUNNEL_LABEL, type FunnelFase } from './funnel'
import { isContact, isGesproken, NORMEN, type Kpi, type KpiActiviteit, type Periode } from './team'

// ── Periode ─────────────────────────────────────────────────────────────────

export const DASHBOARD_PERIODES = ['week', 'maand', 'kwartaal', 'eigen'] as const
export type DashboardPeriodeSleutel = typeof DASHBOARD_PERIODES[number]
export const DASHBOARD_PERIODE_OPTIES: { id: Exclude<DashboardPeriodeSleutel, 'eigen'>; label: string }[] = [
  { id: 'week', label: 'Deze week' },
  { id: 'maand', label: 'Deze maand' },
  { id: 'kwartaal', label: 'Dit kwartaal' },
]
export const EIGEN_PERIODE_LABEL = 'Eigen periode'
/** Een eigen periode loopt hoogstens een jaar terug; langer zegt een dagreeks niets meer. */
export const MAX_DAGEN = 366

export interface DashboardPeriode {
  sleutel: DashboardPeriodeSleutel
  /** Eerste en laatste dag waarover geteld wordt (de laatste is hoogstens vandaag). */
  van: string; tot: string
  /** Het einde van de kalenderperiode (voor het doel); bij een eigen periode gelijk aan tot. */
  eind: string
  label: string
  /** Dezelfde dagen een periode eerder, voor de vergelijking op de tegels. */
  vorige: Periode
  vorigeLabel: string
}

const isDatum = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`))
const maandEind = (j: number, m: number) => new Date(Date.UTC(j, m, 0)).getUTCDate()
/** Zelfde dag n maanden eerder, begrensd op de laatste dag van die maand (31 maart min een maand is 28 of 29 februari). */
export function maandenTerug(datum: string, n: number): string {
  const [j, m, d] = datum.split('-').map(Number) as [number, number, number]
  const t = (j * 12 + (m - 1)) - n
  const nj = Math.floor(t / 12); const nm = (t % 12) + 1
  return `${nj}-${String(nm).padStart(2, '0')}-${String(Math.min(d, maandEind(nj, nm))).padStart(2, '0')}`
}
export const dagenIn = (p: Periode) => Math.round((Date.parse(`${p.tot}T12:00:00Z`) - Date.parse(`${p.van}T12:00:00Z`)) / 864e5) + 1
const datumKort = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: 'UTC' })

/**
 * De periode uit de URL. Week, maand en kwartaal zijn kalenderperiodes tot en met vandaag (net als
 * Vandaag en shared/team); eigen loopt van van tot tot, hoogstens een jaar en nooit voorbij vandaag.
 * De vergelijking is dezelfde stuk periode een week, maand of kwartaal eerder; bij eigen het even lange
 * stuk ervoor. Een onbekende of onvolledige keuze valt terug op deze maand.
 */
export function dashboardPeriode(q: { periode?: unknown; van?: unknown; tot?: unknown }, vandaag: string): DashboardPeriode {
  const sleutel = (DASHBOARD_PERIODES as readonly unknown[]).includes(q.periode) ? q.periode as DashboardPeriodeSleutel : 'maand'
  if (sleutel === 'eigen' && isDatum(q.van)) {
    let tot = isDatum(q.tot) ? q.tot : vandaag
    if (tot > vandaag) tot = vandaag
    let van = q.van > tot ? tot : q.van
    if (dagenIn({ van, tot }) > MAX_DAGEN) van = plusDagen(tot, -(MAX_DAGEN - 1))
    const n = dagenIn({ van, tot })
    const vorige = { van: plusDagen(van, -n), tot: plusDagen(van, -1) }
    return { sleutel, van, tot, eind: tot, label: `${datumKort(van)} t/m ${datumKort(tot)}`, vorige, vorigeLabel: `de ${n} ${n === 1 ? 'dag' : 'dagen'} ervoor` }
  }
  if (sleutel === 'week') {
    const d = new Date(`${vandaag}T12:00:00Z`).getUTCDay()
    const van = plusDagen(vandaag, -((d + 6) % 7))
    return { sleutel, van, tot: vandaag, eind: plusDagen(van, 6), label: 'Deze week', vorige: { van: plusDagen(van, -7), tot: plusDagen(vandaag, -7) }, vorigeLabel: 'dezelfde dagen vorige week' }
  }
  if (sleutel === 'kwartaal') {
    const m = Number(vandaag.slice(5, 7)); const j = Number(vandaag.slice(0, 4))
    const qm = Math.floor((m - 1) / 3) * 3 + 1
    const van = `${j}-${String(qm).padStart(2, '0')}-01`
    const eind = `${j}-${String(qm + 2).padStart(2, '0')}-${maandEind(j, qm + 2)}`
    return { sleutel, van, tot: vandaag, eind, label: 'Dit kwartaal', vorige: { van: maandenTerug(van, 3), tot: maandenTerug(vandaag, 3) }, vorigeLabel: 'dezelfde dagen vorig kwartaal' }
  }
  const van = `${vandaag.slice(0, 8)}01`
  const eind = `${vandaag.slice(0, 8)}${maandEind(Number(vandaag.slice(0, 4)), Number(vandaag.slice(5, 7)))}`
  return { sleutel: 'maand', van, tot: vandaag, eind, label: 'Deze maand', vorige: { van: maandenTerug(van, 1), tot: maandenTerug(vandaag, 1) }, vorigeLabel: 'dezelfde dagen vorige maand' }
}

// ── Vergelijking ────────────────────────────────────────────────────────────

export interface Delta { verschil: number; richting: 'op' | 'neer' | 'gelijk'; tekst: string }
/** Verschil met de vorige periode als zin: "+3 t.o.v. ...", zonder procent (kleine aantallen liegen in procenten). */
export function delta(nu: number, vorige: number, wanneer: string): Delta {
  const v = Math.round((nu - vorige) * 10) / 10
  const getal = v.toLocaleString('nl-NL')
  return { verschil: v, richting: v > 0 ? 'op' : v < 0 ? 'neer' : 'gelijk', tekst: v === 0 ? `gelijk aan ${wanneer}` : `${v > 0 ? '+' : ''}${getal} t.o.v. ${wanneer}` }
}

// ── Activiteiten per dag of week ────────────────────────────────────────────

/**
 * Kanalen in "Activiteiten per dag". WhatsApp (taaktype `bericht`) en SMS staan los; een bezoek dat als
 * contactpoging is afgerond telt als Bezoek, en wat geen eigen kanaal heeft (een kaart) als Overig.
 */
export const DASH_KANALEN = ['bellen', 'mail', 'linkedin', 'whatsapp', 'sms', 'bezoek', 'overig'] as const
export type Kanaal = typeof DASH_KANALEN[number]
export const KANAAL_LABEL: Record<Kanaal, string> = { bellen: 'Bellen', mail: 'Mail', linkedin: 'LinkedIn', whatsapp: 'WhatsApp', sms: 'SMS', bezoek: 'Bezoek', overig: 'Overig' }
/** Kanalen die alleen in de legenda staan als er in de periode iets in zit. */
export const KANAAL_ALLEEN_GEVULD: readonly Kanaal[] = ['bezoek', 'overig']
/**
 * De kanaalgroep van een contactpoging. Een afgeronde taak schrijft soort `bericht` met het kanaal erbij
 * (whatsapp, sms of linkedin); een `bericht` zonder kanaal is van voor de splitsing en was WhatsApp.
 */
export function kanaalVan(a: Pick<KpiActiviteit, 'soort' | 'kanaal'>): Kanaal {
  if (a.soort === 'gebeld') return 'bellen'
  if (a.soort === 'mail') return 'mail'
  if (a.soort === 'bezoek') return 'bezoek'
  if (a.soort === 'linkedin' || a.kanaal === 'linkedin') return 'linkedin'
  if (a.soort === 'sms' || a.kanaal === 'sms') return 'sms'
  if (a.soort === 'whatsapp' || a.kanaal === 'whatsapp' || a.soort === 'bericht') return 'whatsapp'
  return 'overig'
}

export interface ReeksPunt { sleutel: string; label: string; titel: string; kern: boolean; totaal: number; gesprekken: number; delen: Record<Kanaal, number> }
export interface Reeks { per: 'dag' | 'week'; punten: ReeksPunt[]; max: number; totaal: number }
const leeg = (): Record<Kanaal, number> => ({ bellen: 0, mail: 0, linkedin: 0, whatsapp: 0, sms: 0, bezoek: 0, overig: 0 })
const maandagVan = (d: string) => plusDagen(d, -((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7))

/**
 * Contactpogingen per dag (tot en met 31 dagen) of per week (langer), gestapeld per kanaal. Intern overleg
 * telt niet. Elke dag of week in de periode staat erin, ook zonder activiteit, zodat de as klopt. `kern`
 * markeert de labels die op de telefoon blijven staan (maandagen bij dagen, om de week bij veel weken).
 */
export function activiteitReeks(acts: KpiActiviteit[], p: Periode, gebruiker?: string): Reeks {
  const n = dagenIn(p)
  const per: Reeks['per'] = n > 31 ? 'week' : 'dag'
  const punten: ReeksPunt[] = []
  if (per === 'dag') {
    for (let d = p.van; d <= p.tot; d = plusDagen(d, 1)) {
      const wd = new Date(`${d}T12:00:00Z`).getUTCDay()
      punten.push({ sleutel: d, label: String(Number(d.slice(8))), titel: new Date(`${d}T12:00:00Z`).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }), kern: d === p.van || wd === 1, totaal: 0, gesprekken: 0, delen: leeg() })
    }
  } else {
    let i = 0
    for (let d = maandagVan(p.van); d <= p.tot; d = plusDagen(d, 7), i++) {
      punten.push({ sleutel: d, label: datumKort(d < p.van ? p.van : d), titel: `Week van ${datumKort(d < p.van ? p.van : d)}`, kern: i % 2 === 0, totaal: 0, gesprekken: 0, delen: leeg() })
    }
  }
  const index = new Map(punten.map((x, i) => [x.sleutel, i]))
  for (const a of acts) {
    if (gebruiker && a.door !== gebruiker) continue
    const dag = a.op.slice(0, 10)
    if (dag < p.van || dag > p.tot || !isContact(a)) continue
    const i = index.get(per === 'dag' ? dag : maandagVan(dag))
    if (i == null) continue
    const x = punten[i]!
    x.delen[kanaalVan(a)]++; x.totaal++
    if (isGesproken(a)) x.gesprekken++
  }
  return { per, punten, max: Math.max(0, ...punten.map((x) => x.totaal)), totaal: punten.reduce((s, x) => s + x.totaal, 0) }
}

/** Een nette bovenkant voor de y-as: 1, 2, 5 of 10 maal een macht van tien, minstens het maximum. */
export function asMax(max: number): number {
  if (max <= 0) return 1
  const macht = 10 ** Math.floor(Math.log10(max))
  for (const f of [1, 2, 5, 10]) if (f * macht >= max) return f * macht
  return 10 * macht
}

// ── Uitkomsten van contactpogingen ──────────────────────────────────────────

const UITKOMST_GROEP: Record<string, { sleutel: string; label: string }> = {
  afspraak: { sleutel: 'afspraak', label: 'Afspraak' },
  gesproken: { sleutel: 'gesproken', label: 'Gesproken' },
  later: { sleutel: 'later', label: 'Later terugbellen' },
  terugbellen: { sleutel: 'later', label: 'Later terugbellen' },
  geen_interesse: { sleutel: 'nee', label: 'Geen interesse' },
  niet_geschikt: { sleutel: 'nee', label: 'Geen interesse' },
  geen_reactie: { sleutel: 'geen', label: 'Geen gehoor' },
  niet_bereikt: { sleutel: 'geen', label: 'Geen gehoor' },
  bezet: { sleutel: 'geen', label: 'Geen gehoor' },
  voicemail: { sleutel: 'voicemail', label: 'Voicemail' },
  verzonden: { sleutel: 'verzonden', label: 'Verzonden' },
  verkeerd_nummer: { sleutel: 'fout', label: 'Verkeerd nummer' },
}
const UITKOMST_VOLGORDE = ['afspraak', 'gesproken', 'later', 'nee', 'geen', 'voicemail', 'verzonden', 'fout', 'overig']
/** De groep van een uitkomst (sleutel en label); onbekend of leeg is "Zonder uitkomst". */
export const uitkomstGroep = (uitkomst: string | null | undefined): { sleutel: string; label: string } => UITKOMST_GROEP[uitkomst ?? ''] ?? { sleutel: 'overig', label: 'Zonder uitkomst' }
/** Waar de pogingen op uitliepen, gegroepeerd en in vaste volgorde; lege groepen vallen weg. */
export function uitkomsten(acts: KpiActiviteit[], p: Periode, gebruiker?: string): { sleutel: string; label: string; aantal: number }[] {
  const tel = new Map<string, { sleutel: string; label: string; aantal: number }>()
  for (const a of acts) {
    if (gebruiker && a.door !== gebruiker) continue
    const dag = a.op.slice(0, 10)
    if (dag < p.van || dag > p.tot || !isContact(a)) continue
    const g = uitkomstGroep(a.uitkomst)
    const x = tel.get(g.sleutel) ?? { ...g, aantal: 0 }
    x.aantal++; tel.set(g.sleutel, x)
  }
  return [...tel.values()].sort((a, b) => UITKOMST_VOLGORDE.indexOf(a.sleutel) - UITKOMST_VOLGORDE.indexOf(b.sleutel))
}

// ── Prospectdekking ─────────────────────────────────────────────────────────

export const DEKKING_BAKKEN = [
  { sleutel: '7', label: '< 7d', tot: 7, toon: 'vers' },
  { sleutel: '14', label: '7-14d', tot: 14, toon: 'recent' },
  { sleutel: '30', label: '14-30d', tot: 30, toon: 'aandacht' },
  { sleutel: '60', label: '30-60d', tot: 60, toon: 'oplopend' },
  { sleutel: '90', label: '60-90d', tot: 90, toon: 'koud' },
  { sleutel: 'meer', label: '> 90d', tot: Infinity, toon: 'ijskoud' },
] as const
export interface DekkingBak { sleutel: string; label: string; toon: string; aantal: number }
/**
 * Actieve prospects per laatste contact, zoals de dekkingsblokken van DealDrive. Zonder contactmoment
 * valt een prospect in de koudste bak. Recent is contact korter dan 30 dagen geleden.
 */
/** De dekkingsbak van één prospect: dagen sinds het laatste contact; zonder contact de koudste bak. */
export function dekkingBak(laatsteContact: string | null | undefined, nu: Date): (typeof DEKKING_BAKKEN)[number] {
  if (!laatsteContact) return DEKKING_BAKKEN[DEKKING_BAKKEN.length - 1]!
  const dagen = (nu.getTime() - Date.parse(laatsteContact)) / 864e5
  return DEKKING_BAKKEN.find((b) => dagen < b.tot) ?? DEKKING_BAKKEN[DEKKING_BAKKEN.length - 1]!
}
export function prospectDekking(laatsteContact: (string | null)[], nu: Date): { bakken: DekkingBak[]; recent: number; actief: number; zonderContact: number; procent: number } {
  const bakken: DekkingBak[] = DEKKING_BAKKEN.map((b) => ({ sleutel: b.sleutel, label: b.label, toon: b.toon, aantal: 0 }))
  let recent = 0; let zonder = 0
  for (const l of laatsteContact) {
    if (!l) { zonder++; bakken[bakken.length - 1]!.aantal++; continue }
    const dagen = (nu.getTime() - Date.parse(l)) / 864e5
    const i = DEKKING_BAKKEN.findIndex((b) => dagen < b.tot)
    bakken[i < 0 ? bakken.length - 1 : i]!.aantal++
    if (dagen < 30) recent++
  }
  const actief = laatsteContact.length
  return { bakken, recent, actief, zonderContact: zonder, procent: actief ? Math.round((recent / actief) * 100) : 0 }
}

// ── Doel en normen ──────────────────────────────────────────────────────────

export interface DoelStand {
  gerealiseerd: number; doel: number; verwacht: number; pct: number; verwachtPct: number; prognose: number
  resterend: number; werkdagenRest: number; perDag: number; normPerDag: number; stand: 'voor' | 'op schema' | 'achter' | 'geen'; afgerond: boolean
}
const telWerkdagen = (van: string, tot: string) => { let n = 0; for (let d = van; d <= tot; d = plusDagen(d, 1)) if (isWerkdag(d)) n++; return n }
/**
 * Het pogingendoel over de hele kalenderperiode (norm per werkdag uit shared/team maal de werkdagen tot het
 * einde), tegenover waar je op deze dag zou staan. Prognose: het tempo tot nu doorgetrokken naar het einde.
 * Op schema vanaf 90 procent van het verwachte aantal, voor vanaf 100 procent.
 */
export function doelStand(pogingen: number, p: Pick<DashboardPeriode, 'van' | 'tot' | 'eind'>, werkplek: string | null | undefined, vandaag: string): DoelStand {
  const perDag = NORMEN.pogingenPerDag[werkplek ?? 'binnendienst'] ?? 25
  const totaal = telWerkdagen(p.van, p.eind)
  const verstreken = telWerkdagen(p.van, p.tot < vandaag ? p.tot : vandaag)
  const doel = perDag * totaal
  const verwacht = perDag * verstreken
  const afgerond = p.eind <= vandaag
  const werkdagenRest = afgerond ? 0 : telWerkdagen(plusDagen(vandaag, 1), p.eind)
  const resterend = Math.max(0, doel - pogingen)
  const prognose = verstreken ? Math.round((pogingen / verstreken) * totaal) : 0
  const pct = doel ? Math.round((pogingen / doel) * 100) : 0
  const verwachtPct = doel ? Math.round((verwacht / doel) * 100) : 0
  const stand: DoelStand['stand'] = !verwacht ? 'geen' : pogingen >= verwacht ? 'voor' : pogingen >= verwacht * NORMEN.opSchema ? 'op schema' : 'achter'
  return { gerealiseerd: pogingen, doel, verwacht, pct, verwachtPct, prognose, resterend, werkdagenRest, perDag: werkdagenRest ? Math.ceil(resterend / werkdagenRest) : 0, normPerDag: perDag, stand, afgerond }
}

export interface NormRegel { sleutel: string; label: string; waarde: string; norm: string; procent: number | null; stand: 'boven' | 'onder' | 'geen'; hint: string }
/** De normen uit hoofdstuk 16 naast je eigen cijfer; zonder noemer geen oordeel. */
export function normRegels(k: Kpi, extra: { gepland: number; gehouden: number }): NormRegel[] {
  const pct = (m: { waarde: number; noemer: number | null }) => Math.round(m.waarde * 100)
  const r: NormRegel[] = []
  const g2a = k.gesprekNaarAfspraak
  r.push({ sleutel: 'gesprekNaarAfspraak', label: 'Gesprek naar afspraak', waarde: g2a.noemer ? `${pct(g2a)}%` : '-', norm: `${Math.round(NORMEN.gesprekNaarAfspraak * 100)}%`, procent: g2a.noemer ? pct(g2a) : null, stand: !g2a.noemer ? 'geen' : g2a.waarde >= NORMEN.gesprekNaarAfspraak ? 'boven' : 'onder', hint: `${k.afspraken} van ${k.gesprekken} gesprekken` })
  const bes = k.beslisserBereikt
  r.push({ sleutel: 'beslisserBereikt', label: 'Beslisser bereikt', waarde: bes.noemer ? `${pct(bes)}%` : '-', norm: `${Math.round(NORMEN.beslisserBereikt * 100)}%`, procent: bes.noemer ? pct(bes) : null, stand: !bes.noemer ? 'geen' : bes.waarde >= NORMEN.beslisserBereikt ? 'boven' : 'onder', hint: `${k.beslisser} van ${k.gesprekken} gesprekken` })
  const pta = k.pogingenTotAfspraak
  const { min, max } = NORMEN.pogingenTotAfspraak
  r.push({ sleutel: 'pogingenTotAfspraak', label: 'Pogingen per afspraak', waarde: pta.noemer ? pta.waarde.toLocaleString('nl-NL') : '-', norm: `${min} tot ${max}`, procent: pta.noemer ? Math.min(100, Math.round((max / Math.max(pta.waarde, 0.1)) * 100)) : null, stand: !pta.noemer ? 'geen' : pta.waarde <= max ? 'boven' : 'onder', hint: pta.noemer ? `${k.pogingen} pogingen voor ${k.afspraken} ${k.afspraken === 1 ? 'afspraak' : 'afspraken'}` : 'nog geen afspraak' })
  const gh = extra.gepland ? extra.gehouden / extra.gepland : 0
  r.push({ sleutel: 'geplandNaarGehouden', label: 'Gepland naar gehouden', waarde: extra.gepland ? `${Math.round(gh * 100)}%` : '-', norm: `${Math.round(NORMEN.afsprakenGehaald * 100)}%`, procent: extra.gepland ? Math.round(gh * 100) : null, stand: !extra.gepland ? 'geen' : gh >= NORMEN.afsprakenGehaald ? 'boven' : 'onder', hint: `${extra.gehouden} gehouden van ${extra.gepland} gemaakt` })
  return r
}

/** Kop en duiding van Mijn dashboard: één zin over de stand, één over de hefboom. */
export function dashboardTitel(s: { pogingen: number; gesprekken: number; afspraken: number; doel: DoelStand; conversie: { waarde: number; noemer: number | null }; verlopen: number; label: string }): { titel: string; duiding: string } {
  const mv = (n: number, een: string, meer: string) => `${n} ${n === 1 ? een : meer}`
  const wanneer = s.label.toLowerCase()
  const titel = !s.pogingen
    ? `Nog geen contactpogingen ${wanneer}.`
    : `${mv(s.pogingen, 'poging', 'pogingen')}, ${mv(s.gesprekken, 'gesprek', 'gesprekken')} en ${mv(s.afspraken, 'afspraak', 'afspraken')} ${wanneer}.`
  const duiding = s.doel.stand === 'achter'
    ? `Je loopt achter op je pogingendoel: nog ${s.doel.resterend} te gaan${s.doel.werkdagenRest ? `, ${s.doel.perDag} per werkdag` : ''}.`
    : s.verlopen > 0
      ? `${mv(s.verlopen, 'taak staat', 'taken staan')} over tijd. Wie die wegwerkt, begint schoon.`
      : s.conversie.noemer && s.conversie.waarde >= NORMEN.gesprekNaarAfspraak
        ? `Je zet ${Math.round(s.conversie.waarde * 100)}% van je gesprekken om in een afspraak, boven de norm van ${Math.round(NORMEN.gesprekNaarAfspraak * 100)}%. Meer gesprekken is nu de hefboom.`
        : s.conversie.noemer
          ? `Van gesprek naar afspraak zit je onder de norm van ${Math.round(NORMEN.gesprekNaarAfspraak * 100)}%. Daar zit je winst.`
          : 'Regelmaat wint van losse uitschieters. Elke dag dat je je pogingen doet, telt.'
  return { titel, duiding }
}

// ── Funnel ──────────────────────────────────────────────────────────────────

export interface FunnelFaseUit { faseId: FunnelFase | string; aantal: number; doorgestroomd: number; uitgevallen: number; aanwezig: number; conversie?: number | null; doorlooptijd?: number | null; norm?: { conversie?: number | null; doorlooptijd?: number | null } | null; uitval?: { reden: string; aantal: number }[] }
const f = (fases: FunnelFaseUit[], id: string) => fases.find((x) => x.faseId === id)
/**
 * De tegels boven de funnel: instroom, afspraken, overdrachten, de conversie van instroom naar eerste
 * afspraak en naar overdracht, uitval en de doorlooptijd tot de eerste afspraak (som van de gemiddelde
 * doorlooptijden van de fases ervoor, alleen waar die bekend is).
 */
export function funnelTegels(fases: FunnelFaseUit[], aantalAccounts: number) {
  const gepland = f(fases, 'afspraak-gepland')?.aantal ?? 0
  const gehouden = f(fases, 'afspraak-gehouden')?.aantal ?? 0
  const over = f(fases, 'overgedragen')?.aantal ?? 0
  const uitval = fases.reduce((s, x) => s + x.uitgevallen, 0)
  const tot = (n: number) => (aantalAccounts ? Math.round((n / aantalAccounts) * 100) : null)
  const voorAfspraak = fases.slice(0, Math.max(0, fases.findIndex((x) => x.faseId === 'afspraak-gepland')))
  const tijden = voorAfspraak.map((x) => x.doorlooptijd).filter((x): x is number => typeof x === 'number')
  const redenen = new Map<string, number>()
  for (const x of fases) for (const u of x.uitval ?? []) redenen.set(u.reden, (redenen.get(u.reden) ?? 0) + u.aantal)
  const top = [...redenen].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? null
  return {
    instroom: aantalAccounts, gepland, gehouden, overgedragen: over, uitval,
    naarAfspraak: tot(gepland), naarOverdracht: tot(over),
    gehoudenVanGepland: gepland ? Math.round((gehouden / gepland) * 100) : null,
    doorlooptijdTotAfspraak: tijden.length ? Math.round(tijden.reduce((s, x) => s + x, 0) * 10) / 10 : null,
    topReden: top ? { reden: top[0], aantal: top[1] } : null,
  }
}

/** Alle uitvalredenen over de fases heen, meest eerst, met de fase waar ze het meest voorkomen. */
export function uitvalTotaal(fases: FunnelFaseUit[]): { reden: string; aantal: number; fase: string }[] {
  const per = new Map<string, { aantal: number; fases: Map<string, number> }>()
  for (const x of fases) for (const u of x.uitval ?? []) {
    const r = per.get(u.reden) ?? { aantal: 0, fases: new Map() }
    r.aantal += u.aantal; r.fases.set(String(x.faseId), (r.fases.get(String(x.faseId)) ?? 0) + u.aantal); per.set(u.reden, r)
  }
  return [...per].map(([reden, r]) => ({ reden, aantal: r.aantal, fase: FUNNEL_LABEL[[...r.fases].sort((a, b) => b[1] - a[1])[0]![0] as FunnelFase] ?? '' }))
    .sort((a, b) => b.aantal - a.aantal || a.reden.localeCompare(b.reden))
}
