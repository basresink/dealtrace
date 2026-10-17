// Briefings-overzicht (/briefings): periodes, filters, groepen per dag en de compleetheid van een briefing.
// Puur, zodat server (tellers per periode) en scherm (chips, tellers, groepen) hetzelfde rekenen.
// Periodes rekenen in kalenderdagen van Nederland (YYYY-MM-DD). Achterstallig is alles voor vandaag en telt
// mee bij Vandaag, Deze week en Alle (zoals in de mockup): wat over tijd is, moet je nog steeds voorbereiden.
import { plusDagen, weekdag } from './datum'
import type { Blok, BriefingSoort } from './briefing'

export const PERIODES = [['alle', 'Alle'], ['vandaag', 'Vandaag'], ['morgen', 'Morgen'], ['week', 'Deze week'], ['volgende', 'Volgende week'], ['vantot', 'Van tot']] as const
export type Periode = typeof PERIODES[number][0]
export const STANDAARD_PERIODE: Periode = 'week'
export const STATUSSEN = [['alle', 'Alle'], ['voorbereiden', 'Nog voorbereiden'], ['voorbereid', 'Voorbereid'], ['laat', 'Achterstallig']] as const
export type StatusFilter = typeof STATUSSEN[number][0]
export const DOELGROEPEN = [['alle', 'Alle'], ['prospect', 'Prospects'], ['klant', 'Klanten']] as const
export const SOORT_KORT: Record<BriefingSoort, string> = { 'eerste-gesprek': 'Eerste gesprek', behoefte: 'Behoefte', verdieping: 'Verdieping', overdracht: 'Overdracht', bezoek: 'Bezoek' }
/** De kleur per soort (een .pil-variant uit de UI-standaard), zoals DealDrive elke soort een eigen kleur geeft. */
export const SOORT_KLEUR: Record<BriefingSoort, 'blauw' | 'zwart' | 'paars' | 'oranje' | 'groen'> = { 'eerste-gesprek': 'blauw', behoefte: 'zwart', verdieping: 'paars', overdracht: 'oranje', bezoek: 'groen' }
/** Het verste punt dat het overzicht ophaalt (dagen na vandaag) en hoeveel briefings het voluit berekent. */
export const HORIZON_DAGEN = 62
export const MAX_BRIEFINGS = 100
/** Hoe ver terug een geplande maar niet afgeronde afspraak nog als achterstallig meetelt. */
export const AFSPRAAK_TERUG_DAGEN = 7

/** Maandag van de week van `dag`. */
export const maandagVan = (dag: string) => plusDagen(dag, 1 - weekdag(dag))

/** Van en tot (beide inclusief) van een periode; null is open. `van` null betekent: met achterstallig. */
export function periodeGrenzen(p: Periode, vandaag: string, eigen: { van?: string | null; tot?: string | null } = {}): { van: string | null; tot: string | null } {
  const zondag = plusDagen(maandagVan(vandaag), 6)
  switch (p) {
    case 'vandaag': return { van: null, tot: vandaag }
    case 'morgen': { const m = plusDagen(vandaag, 1); return { van: m, tot: m } }
    case 'week': return { van: null, tot: zondag }
    case 'volgende': return { van: plusDagen(zondag, 1), tot: plusDagen(zondag, 7) }
    case 'vantot': return { van: eigen.van || null, tot: eigen.tot || null }
    default: return { van: null, tot: null }
  }
}

/** Valt een dag (YYYY-MM-DD, of null voor zonder datum) in de periode? Zonder datum alleen bij Alle. */
export function inPeriode(dag: string | null, p: Periode, vandaag: string, eigen: { van?: string | null; tot?: string | null } = {}): boolean {
  if (!dag) return p === 'alle'
  const g = periodeGrenzen(p, vandaag, eigen)
  return (!g.van || dag >= g.van) && (!g.tot || dag <= g.tot)
}

export function telPerPeriode(dagen: (string | null)[], vandaag: string): Record<Exclude<Periode, 'vantot'>, number> {
  const uit = { alle: 0, vandaag: 0, morgen: 0, week: 0, volgende: 0 }
  for (const d of dagen) for (const p of Object.keys(uit) as (keyof typeof uit)[]) if (inPeriode(d, p, vandaag)) uit[p]++
  return uit
}

/**
 * "6 van 8 blokken bekend" en het eerste gat: wat je in het gesprek moet vragen. Een leeg blok gaat voor; anders wie
 * er in het buying committee nog ontbreekt. Een gat in het verkoopverhaal zelf staat alleen in de hele briefing.
 */
export function compleetheid(blokken: Pick<Blok, 'sleutel' | 'titel' | 'tekst'>[]): { bekend: number; totaal: number; gat: string | null } {
  const leeg = (b: Pick<Blok, 'tekst'>) => !b.tekst?.trim() || b.tekst.trim() === 'Nog niet bekend.'
  const eersteLeeg = blokken.find(leeg)
  const ontbreekt = blokken.find((b) => b.sleutel === 'ontbreekt' && /^Nog geen /.test(b.tekst))
  const gat = eersteLeeg ? `${eersteLeeg.titel} is nog niet bekend` : ontbreekt ? `Wie ontbreekt: ${ontbreekt.tekst.replace(/^Nog geen /, '').replace(/\.$/, '')}` : null
  return { bekend: blokken.filter((b) => !leeg(b)).length, totaal: blokken.length, gat }
}

export function compleetTekst(c: { bekend: number; totaal: number }) {
  return c.bekend === c.totaal ? `Alle ${c.totaal} blokken bekend` : `${c.bekend} van ${c.totaal} blokken bekend`
}

/** De dagkop: Achterstallig, Vandaag · zaterdag 17 oktober, Morgen · ..., daarna de datum; zonder datum apart. */
export function dagKop(dag: string | null, vandaag: string): { sleutel: string; titel: string; rood: boolean } {
  if (!dag) return { sleutel: 'zonder', titel: 'Zonder datum', rood: false }
  if (dag < vandaag) return { sleutel: 'laat', titel: 'Achterstallig', rood: true }
  const lang = new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${dag}T12:00:00Z`))
  if (dag === vandaag) return { sleutel: dag, titel: `Vandaag · ${lang}`, rood: false }
  if (dag === plusDagen(vandaag, 1)) return { sleutel: dag, titel: `Morgen · ${lang}`, rood: false }
  return { sleutel: dag, titel: lang.charAt(0).toUpperCase() + lang.slice(1), rood: false }
}
