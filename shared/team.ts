// Team, coaching en resultaten (P21, F20, hoofdstuk 16). Elk cijfer komt uit de activiteitenlog en heeft
// een noemer, zodat het herleidbaar is. Geen niveauvoorstellen of criteria voor een volgend niveau (B19).
import { isWerkdag, nlDag, plusDagen } from './datum'

export const CONTACT_SOORTEN = ['gebeld', 'mail', 'bericht', 'bezoek', 'linkedin', 'whatsapp', 'sms', 'kaart'] as const
const NIET_GESPROKEN = new Set(['geen_reactie', 'voicemail', 'verzonden', 'niet_bereikt', 'verkeerd_nummer', 'bezet', '', null, undefined])

/** Normen uit hoofdstuk 16; pogingen per werkdag per werkplek is een voorstel (niet vastgelegd). */
export const NORMEN = {
  pogingenPerDag: { binnendienst: 25, buitendienst: 10, hybride: 15 } as Record<string, number>,
  pogingenTotAfspraak: { min: 4, max: 5 },
  gesprekNaarAfspraak: 0.15,
  beslisserBereikt: 0.2,
  teamOpTempo: 0.7,
  coachingDagen: 14,
  afsprakenGehaald: 0.6,
  opSchema: 0.9,
}
export const MINIMUM = { script: 30, reisversie: 20, gesprekken: 10 } as const
export type MinimumSoort = keyof typeof MINIMUM
export const TE_WEINIG = 'Te weinig om te vergelijken'

export interface Periode { van: string; tot: string }
export type PeriodeSleutel = 'vandaag' | 'week' | 'maand' | 'kwartaal'
export const PERIODE_LABEL: Record<PeriodeSleutel, string> = { vandaag: 'Vandaag', week: 'Deze week', maand: 'Deze maand', kwartaal: 'Kwartaal' }
/** Periode in NL-datums: de week begint op maandag; het kwartaal op 1 januari, april, juli of oktober. */
export function periodeVoor(sleutel: PeriodeSleutel, vandaag: string): Periode {
  if (sleutel === 'vandaag') return { van: vandaag, tot: vandaag }
  if (sleutel === 'week') { const d = new Date(`${vandaag}T12:00:00Z`).getUTCDay(); return { van: plusDagen(vandaag, -((d + 6) % 7)), tot: vandaag } }
  if (sleutel === 'maand') return { van: `${vandaag.slice(0, 8)}01`, tot: vandaag }
  const m = Number(vandaag.slice(5, 7))
  return { van: `${vandaag.slice(0, 5)}${String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, '0')}-01`, tot: vandaag }
}
/** Werkdagen in een periode; feestdagen tellen niet (shared/datum.ts). */
export function werkdagen(p: Periode): number {
  let n = 0
  for (let d = p.van; d <= p.tot; d = plusDagen(d, 1)) if (isWerkdag(d)) n++
  return n
}

export interface KpiActiviteit { id?: string; door: string | null; op: string; soort: string; kanaal?: string | null; uitkomst?: string | null; accountId?: string | null; beslisser?: boolean; intern?: boolean }
export interface Metriek { waarde: number; noemer: number | null }
export interface Kpi {
  werkdagen: number; pogingen: number; gesprekken: number; beslisser: number; afspraken: number; accounts: number
  pogingenPerDag: Metriek; gesprekNaarAfspraak: Metriek; beslisserBereikt: Metriek; pogingenTotAfspraak: Metriek
}
const deel = (a: number, b: number): Metriek => ({ waarde: b ? Math.round((a / b) * 1000) / 1000 : 0, noemer: b })
const binnen = (op: string, p: Periode) => { const d = nlDag(op); return d >= p.van && d <= p.tot }
export const isContact = (a: Pick<KpiActiviteit, 'soort' | 'intern'>) => (CONTACT_SOORTEN as readonly string[]).includes(a.soort) && !a.intern
export const isGesproken = (a: Pick<KpiActiviteit, 'soort' | 'uitkomst' | 'intern'>) => isContact(a) && !NIET_GESPROKEN.has(a.uitkomst as any)

/** Metrieken met noemer voor één gebruiker. Intern overleg telt niet als klantcontact. */
export function kpi(gebruiker: string, periode: Periode, activiteiten: KpiActiviteit[]): Kpi {
  const eigen = activiteiten.filter((a) => a.door === gebruiker && binnen(a.op, periode) && isContact(a))
  const gesproken = eigen.filter(isGesproken)
  const afspraken = eigen.filter((a) => a.uitkomst === 'afspraak').length
  const wd = werkdagen(periode)
  return {
    werkdagen: wd, pogingen: eigen.length, gesprekken: gesproken.length, beslisser: gesproken.filter((a) => a.beslisser).length, afspraken,
    accounts: new Set(eigen.map((a) => a.accountId).filter(Boolean)).size,
    pogingenPerDag: { waarde: wd ? Math.round((eigen.length / wd) * 10) / 10 : 0, noemer: wd },
    gesprekNaarAfspraak: deel(afspraken, gesproken.length),
    beslisserBereikt: deel(gesproken.filter((a) => a.beslisser).length, gesproken.length),
    pogingenTotAfspraak: { waarde: afspraken ? Math.round((eigen.length / afspraken) * 10) / 10 : 0, noemer: afspraken },
  }
}

/** Tempo-pil: pogingen tegen de norm van de werkplek; op schema vanaf 90 procent. Zonder werkdagen geen oordeel. */
export function tempo(k: Pick<Kpi, 'pogingen' | 'werkdagen'>, werkplek: string | null | undefined): { stand: 'op schema' | 'achter' | 'geen'; procent: number; norm: number } {
  const norm = (NORMEN.pogingenPerDag[werkplek ?? 'binnendienst'] ?? 25) * k.werkdagen
  if (!norm) return { stand: 'geen', procent: 0, norm }
  const procent = Math.round((k.pogingen / norm) * 100)
  return { stand: procent >= NORMEN.opSchema * 100 ? 'op schema' : 'achter', procent, norm }
}

/** Is er genoeg om te vergelijken? 30 gesprekken per script, 20 accounts per reisversie. */
export function genoegOmTeVergelijken(n: number, soort: MinimumSoort): { genoeg: boolean; melding: string | null } {
  return n >= MINIMUM[soort] ? { genoeg: true, melding: null } : { genoeg: false, melding: TE_WEINIG }
}

export interface TeamRij { id: string; naam: string; werkplek?: string | null; kpi: Kpi; achterstallig: number; belblokkenGehouden: number; belblokkenGepland: number; conceptenWachten: number }
export interface Aandachtspunt { soort: string; tekst: string; ernst: number; gebruikerId?: string }
const nl = (n: number) => String(n).replace('.', ',')
const kort = (naam: string) => naam.replace(/^Testgebruiker /, '').split(' ')[0]!
/** Maximaal vijf aandachtspunten, uitgerekend; gelijke ernst in vaste volgorde (soort, dan naam). */
export function aandachtspunten(rijen: TeamRij[], extra: { campagnesAchter?: number; terugDezeWeek?: number } = {}): Aandachtspunt[] {
  const uit: Aandachtspunt[] = []
  // Zelfde maat als per persoon: pogingen per account (som pogingen gedeeld door som accounts).
  const teamAccounts = rijen.reduce((s, r) => s + r.kpi.accounts, 0)
  const teamPta = teamAccounts ? rijen.reduce((s, r) => s + r.kpi.pogingen, 0) / teamAccounts : 0
  for (const r of rijen) {
    const pta = r.kpi.accounts ? r.kpi.pogingen / r.kpi.accounts : 0
    if (r.kpi.accounts >= 3 && pta < NORMEN.pogingenTotAfspraak.min * 0.6) uit.push({ soort: 'pogingen', gebruikerId: r.id, ernst: 3, tekst: `${kort(r.naam)} stopt gemiddeld na ${nl(Math.round(pta * 10) / 10)} pogingen${teamPta ? ` (team ${nl(Math.round(teamPta * 10) / 10)})` : ''}` })
    if (r.achterstallig >= 10) uit.push({ soort: 'achterstallig', gebruikerId: r.id, ernst: 4, tekst: `${kort(r.naam)} heeft ${r.achterstallig} taken achterstallig` })
    if (r.werkplek !== 'buitendienst' && r.kpi.werkdagen >= 3 && r.belblokkenGehouden === 0) uit.push({ soort: 'belblok', gebruikerId: r.id, ernst: 2, tekst: `${kort(r.naam)} heeft deze periode geen belblok gehouden` })
    if (r.kpi.gesprekken >= MINIMUM.gesprekken && r.kpi.gesprekNaarAfspraak.waarde < NORMEN.gesprekNaarAfspraak) uit.push({ soort: 'conversie', gebruikerId: r.id, ernst: 2, tekst: `${kort(r.naam)} maakt van ${r.kpi.gesprekken} gesprekken ${r.kpi.afspraken} ${r.kpi.afspraken === 1 ? 'afspraak' : 'afspraken'} (norm 15 procent)` })
  }
  if (extra.campagnesAchter) uit.push({ soort: 'campagnes', ernst: 2, tekst: `${extra.campagnesAchter} ${extra.campagnesAchter === 1 ? 'campagne loopt' : 'campagnes lopen'} achter` })
  if (extra.terugDezeWeek) uit.push({ soort: 'terug', ernst: 1, tekst: `${extra.terugDezeWeek} geparkeerde ${extra.terugDezeWeek === 1 ? 'account komt' : 'accounts komen'} deze week terug` })
  const volg = ['achterstallig', 'pogingen', 'conversie', 'belblok', 'campagnes', 'terug']
  return uit.sort((a, b) => b.ernst - a.ernst || volg.indexOf(a.soort) - volg.indexOf(b.soort) || a.tekst.localeCompare(b.tekst)).slice(0, 5)
}

/** Het teamgemiddelde per persoon, zonder namen (Mijn resultaten vanaf Gevorderd). */
export function teamGemiddelde(rijen: Pick<TeamRij, 'kpi'>[]): { pogingen: number; gesprekken: number; afspraken: number; gesprekNaarAfspraak: number; beslisserBereikt: number; personen: number } {
  const n = rijen.length || 1
  const som = (f: (k: Kpi) => number) => rijen.reduce((s, r) => s + f(r.kpi), 0)
  const g = som((k) => k.gesprekken)
  return {
    pogingen: Math.round((som((k) => k.pogingen) / n) * 10) / 10, gesprekken: Math.round((g / n) * 10) / 10, afspraken: Math.round((som((k) => k.afspraken) / n) * 10) / 10,
    gesprekNaarAfspraak: g ? Math.round((som((k) => k.afspraken) / g) * 1000) / 1000 : 0, beslisserBereikt: g ? Math.round((som((k) => k.beslisser) / g) * 1000) / 1000 : 0, personen: rijen.length,
  }
}

export interface CoachPunt { tekst: string; onderbouwing: { cijfers: string[]; bron: string }; artikelSleutel: string }
/** Een coachingpunt telt alleen met cijfers en een bestaand artikel (heeftGrond); hoogstens drie. */
export function coachPunten(punten: CoachPunt[], artikelen: string[]): CoachPunt[] {
  const bestaand = new Set(artikelen)
  return punten.filter((p) => p.tekst?.trim() && (p.onderbouwing?.cijfers ?? []).some((c) => /\d/.test(c)) && bestaand.has(p.artikelSleutel)).slice(0, 3)
}

/** Drie gesprekken om te bespreken: een goede, een verloren en een met het vaakst terugkomende bezwaar. */
export function kiesGesprekken<T extends { id: string; uitkomst?: string | null; tekst?: string | null; op: string; bezwaar?: string | null }>(lijst: T[]): { soort: 'goed' | 'verloren' | 'bezwaar'; item: T }[] {
  const nieuwst = [...lijst].sort((a, b) => b.op.localeCompare(a.op))
  const uit: { soort: 'goed' | 'verloren' | 'bezwaar'; item: T }[] = []
  const goed = nieuwst.find((a) => a.uitkomst === 'afspraak')
  if (goed) uit.push({ soort: 'goed', item: goed })
  const verloren = nieuwst.find((a) => (a.uitkomst === 'geen_interesse' || a.uitkomst === 'niet_geschikt') && !uit.some((u) => u.item.id === a.id))
  if (verloren) uit.push({ soort: 'verloren', item: verloren })
  const tel = new Map<string, number>()
  for (const a of nieuwst) if (a.bezwaar) tel.set(a.bezwaar, (tel.get(a.bezwaar) ?? 0) + 1)
  const top = [...tel].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0]
  const bezwaar = top ? nieuwst.find((a) => a.bezwaar === top && !uit.some((u) => u.item.id === a.id)) : undefined
  if (bezwaar) uit.push({ soort: 'bezwaar', item: bezwaar })
  return uit
}

/** CSV met precies de getoonde rijen; puntkomma als scheiding (Nederlandse Excel). */
export function naarCsv(kolommen: { sleutel: string; label: string }[], rijen: Record<string, unknown>[]): string {
  const cel = (v: unknown) => { const s = v == null ? '' : String(v); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  return [kolommen.map((k) => cel(k.label)).join(';'), ...rijen.map((r) => kolommen.map((k) => cel(r[k.sleutel])).join(';'))].join('\n')
}
