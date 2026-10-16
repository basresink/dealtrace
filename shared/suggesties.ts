// Suggesties terug naar SalesDNA (P23, F25 kader 2, ADR-002). Kandidaten komen uit pure functies op
// verslagen en afgeleide cijfers; altijd met aantallen, citaten alleen na het namenfilter, hooguit 10
// per sublaag per week, en nooit een nieuwe winpunttekst (11.2): over winpunten alleen resultaten.
import { filterNamen } from './verkoopverhaal'

export const SUGGESTIE_SUBLAGEN = [
  { onderwerpId: 'L0.8', label: 'Concurrenten' },
  { onderwerpId: 'L2.1', label: 'Winpunten' },
  { onderwerpId: 'L0.4', label: 'Waarde en belofte' },
  { onderwerpId: 'L3.14', label: 'Terugkomregels' },
  { onderwerpId: 'L0.6', label: 'Branches' },
] as const
export const MAX_PER_SUBLAAG = 10
export const DREMPELS = { concurrentVerslagen: 5, concurrentDagen: 90, bezwaarGesprekken: 30, brancheGesprekken: 20, terugkomAccounts: 5, winpuntGesprekken: 30 } as const

export const SUGGESTIE_STATUS = ['concept', 'vrijgegeven', 'verstuurd', 'overgenomen', 'afgewezen_salesdna', 'afgewezen', 'mislukt'] as const
export type SuggestieStatus = typeof SUGGESTIE_STATUS[number]
export const STATUS_LABEL: Record<SuggestieStatus, string> = {
  concept: 'Concept', vrijgegeven: 'Vrijgegeven', verstuurd: 'Verstuurd', overgenomen: 'Overgenomen in SalesDNA', afgewezen_salesdna: 'Afgewezen in SalesDNA', afgewezen: 'Afgewezen', mislukt: 'Mislukt',
}

export interface Bewijs { aantallen: { label: string; waarde: number }[]; citaten: string[] }
export interface Kandidaat { onderwerpId: string; veld: string; regelExternId: string | null; soort: string; tekst: string; bewijs: Bewijs; kracht: number; sleutel: string }

/** ISO-week, bijvoorbeeld 2026-W46 (maandag als eerste dag). */
export function isoWeek(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dag = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - dag)
  const jaar = t.getUTCFullYear()
  const week = Math.ceil(((t.getTime() - Date.UTC(jaar, 0, 1)) / 864e5 + 1) / 7)
  return `${jaar}-W${String(week).padStart(2, '0')}`
}
/** De week erna (voor de suggesties boven het maximum). */
export function volgendeWeek(week: string): string {
  const [j, w] = week.split('-W').map(Number)
  const jan4 = new Date(Date.UTC(j!, 0, 4))
  const maandag = new Date(jan4.getTime() - ((jan4.getUTCDay() || 7) - 1) * 864e5 + (w! - 1) * 7 * 864e5)
  return isoWeek(new Date(maandag.getTime() + 7 * 864e5))
}

/** Bevat de tekst een naam van een persoon of prospect? Dan geeft aanpassen 422 (11.2, C.9 punt 9). */
export function bevatNaam(tekst: string, namen: { naam: string }[]): boolean {
  return filterNamen(tekst, namen.map((n) => ({ naam: n.naam, rol: '\u0000' }))) !== tekst
}
/** Citaten door het namenfilter; lege citaten vallen weg. */
export function anonimiseer(citaten: string[], namen: { naam: string; rol?: string }[]): string[] {
  return citaten.map((c) => filterNamen(c, namen).trim()).filter(Boolean).slice(0, 3)
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\b(b\.?v\.?|n\.?v\.?)\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

/** Concurrenten die in verslagen voorkomen maar niet in het leesmodel staan: minimaal 5 verslagen in 90 dagen. */
export function kandidatenConcurrent(verslagen: { op: string; concurrenten: string[]; citaat?: string | null }[], bekend: { naam: string }[], nu: Date): Kandidaat[] {
  const grens = nu.getTime() - DREMPELS.concurrentDagen * 864e5
  const bekendSet = new Set(bekend.map((b) => norm(b.naam)))
  const tel = new Map<string, { naam: string; n: number; citaten: string[] }>()
  for (const v of verslagen) {
    if (Date.parse(v.op) < grens) continue
    for (const naam of new Set(v.concurrenten.map((c) => c.trim()).filter(Boolean))) {
      const k = norm(naam)
      if (!k || bekendSet.has(k)) continue
      const t = tel.get(k) ?? { naam, n: 0, citaten: [] }
      t.n++
      if (v.citaat) t.citaten.push(v.citaat)
      tel.set(k, t)
    }
  }
  return [...tel.entries()].filter(([, t]) => t.n >= DREMPELS.concurrentVerslagen).map(([k, t]) => ({
    onderwerpId: 'L0.8', veld: 'concurrenten', regelExternId: null, soort: 'ontbrekende concurrent',
    tekst: `${t.naam} kwam in ${t.n} verslagen van de laatste 90 dagen voor, maar staat nog niet bij de concurrenten.`,
    bewijs: { aantallen: [{ label: 'verslagen in 90 dagen', waarde: t.n }], citaten: t.citaten }, kracht: t.n, sleutel: `concurrent:${k}`,
  }))
}

/** Bezwaarantwoorden die aantoonbaar werken: minimaal 30 gesprekken met het bezwaar en een hogere afspraakconversie dan zonder. */
export function kandidatenBezwaar(bezwaren: { bezwaar: string; gesprekken: number; afspraken: number; argumentRef?: string | null }[], basis: { gesprekken: number; afspraken: number }): Kandidaat[] {
  const basisRatio = basis.gesprekken ? basis.afspraken / basis.gesprekken : 0
  return bezwaren.filter((b) => b.gesprekken >= DREMPELS.bezwaarGesprekken && b.afspraken / b.gesprekken > basisRatio).map((b) => {
    const pct = Math.round((b.afspraken / b.gesprekken) * 100)
    return {
      onderwerpId: 'L0.8', veld: 'alsDeKlantZegt', regelExternId: b.argumentRef ?? null, soort: 'bezwaarantwoord dat werkt',
      tekst: `Het antwoord op "${b.bezwaar}" werkt: ${b.gesprekken} gesprekken met dit bezwaar gaven ${b.afspraken} afspraken (${pct} procent, zonder dit bezwaar ${Math.round(basisRatio * 100)} procent).`,
      bewijs: { aantallen: [{ label: 'gesprekken met dit bezwaar', waarde: b.gesprekken }, { label: 'afspraken', waarde: b.afspraken }], citaten: [] },
      kracht: b.gesprekken * (b.afspraken / b.gesprekken - basisRatio), sleutel: `bezwaar:${norm(b.bezwaar).slice(0, 60)}`,
    }
  })
}

/** Branches met minimaal 20 gesprekken in het kwartaal en zonder eigen blok in L0.4 (Voltvast br-02, C.5). */
export function kandidatenBrancheBelofte(stand: { brancheId: string; naam: string; gesprekken: number; kwartaal: string }[], teksten: { sublaag: string; brancheId: string | null }[]): Kandidaat[] {
  const metBelofte = new Set(teksten.filter((t) => t.sublaag === 'L0.4' && t.brancheId).map((t) => t.brancheId))
  return stand.filter((b) => b.gesprekken >= DREMPELS.brancheGesprekken && !metBelofte.has(b.brancheId)).map((b) => ({
    onderwerpId: 'L0.4', veld: 'blokken', regelExternId: b.brancheId, soort: 'branche zonder eigen belofte',
    tekst: `${b.gesprekken} gesprekken in ${b.naam} dit kwartaal, nog geen eigen belofte`,
    bewijs: { aantallen: [{ label: `gesprekken in ${b.kwartaal}`, waarde: b.gesprekken }], citaten: [] }, kracht: b.gesprekken, sleutel: `branche:${b.brancheId}:${b.kwartaal}`,
  }))
}

/** Opbrengst per terugkomregel: hoeveel accounts kwamen terug en wat leverde het op. */
export function kandidatenTerugkomregel(regels: { regelId: string; reden: string; terug: number; afspraken: number }[]): Kandidaat[] {
  return regels.filter((r) => r.terug >= DREMPELS.terugkomAccounts).map((r) => ({
    onderwerpId: 'L3.14', veld: 'regels', regelExternId: r.regelId, soort: 'opbrengst terugkomregel',
    tekst: `Terugkomregel "${r.reden}": ${r.terug} accounts kwamen terug, ${r.afspraken} ${r.afspraken === 1 ? 'afspraak' : 'afspraken'}.`,
    bewijs: { aantallen: [{ label: 'accounts terug', waarde: r.terug }, { label: 'afspraken', waarde: r.afspraken }], citaten: [] }, kracht: r.terug, sleutel: `terugkom:${r.regelId}`,
  }))
}

/** Winpuntresultaten: alleen cijfers, nooit een nieuwe winpunttekst (11.2). */
export function kandidatenWinpunt(winpunten: { winpuntId: string; titel: string; gesprekken: number; afspraken: number }[]): Kandidaat[] {
  return winpunten.filter((w) => w.gesprekken >= DREMPELS.winpuntGesprekken).map((w) => ({
    onderwerpId: 'L2.1', veld: 'resultaten', regelExternId: w.winpuntId, soort: 'winpuntresultaat',
    tekst: `Winpunt "${w.titel}": ${w.gesprekken} gesprekken, ${w.afspraken} afspraken (${Math.round((w.afspraken / w.gesprekken) * 100)} procent).`,
    bewijs: { aantallen: [{ label: 'gesprekken', waarde: w.gesprekken }, { label: 'afspraken', waarde: w.afspraken }], citaten: [] }, kracht: w.gesprekken, sleutel: `winpunt:${w.winpuntId}`,
  }))
}

/** Hooguit max per sublaag, sterkste bewijs eerst; de rest schuift door naar de volgende week. */
export function bundelSuggesties<T extends Pick<Kandidaat, 'onderwerpId' | 'kracht'>>(kandidaten: T[], max = MAX_PER_SUBLAAG, alGebruikt: Record<string, number> = {}): { bundel: T[]; over: T[] } {
  const per = new Map<string, T[]>()
  for (const k of kandidaten) per.set(k.onderwerpId, [...(per.get(k.onderwerpId) ?? []), k])
  const bundel: T[] = []
  const over: T[] = []
  for (const [onderwerp, lijst] of per) {
    const ruimte = Math.max(0, max - (alGebruikt[onderwerp] ?? 0))
    const op = [...lijst].sort((a, b) => b.kracht - a.kracht)
    bundel.push(...op.slice(0, ruimte))
    over.push(...op.slice(ruimte))
  }
  return { bundel, over }
}
