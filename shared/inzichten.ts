// Inzichten: afwijzen met een vaste of een eigen reden, de historie van een inzicht, de periode Van en Tot
// en de tekst van een winpunt. Puur; gebruikt door de API (/api/signals, de wachtrij) en de flyout.
import { AFWIJS_REDENEN } from './taken'

/** De keuze naast de vaste redenen; de gebruiker schrijft er zelf een toelichting bij. */
export const EIGEN_REDEN = 'Eigen reden'
export const EIGEN_REDEN_MIN = 3
export const EIGEN_REDEN_MAX = 300

export type AfwijsKeuze = { reden: string; toelichting: string | null }

/**
 * Leest de afwijsreden uit een verzoek. Een vaste reden gaat zoals hij is; "Eigen reden" vraagt een
 * toelichting van 3 tot 300 tekens. Een onbekende reden of een te korte toelichting geeft een foutmelding.
 */
export function leesAfwijsReden(reden: unknown, toelichting?: unknown): { ok: true; keuze: AfwijsKeuze } | { ok: false; melding: string } {
  if (typeof reden !== 'string' || !reden) return { ok: false, melding: 'Kies een reden om af te wijzen' }
  if ((AFWIJS_REDENEN as readonly string[]).includes(reden)) return { ok: true, keuze: { reden, toelichting: null } }
  if (reden !== EIGEN_REDEN) return { ok: false, melding: 'Kies een reden om af te wijzen' }
  const t = typeof toelichting === 'string' ? toelichting.trim().replace(/\s+/g, ' ') : ''
  if (t.length < EIGEN_REDEN_MIN) return { ok: false, melding: 'Schrijf je eigen reden op (minstens 3 tekens)' }
  return { ok: true, keuze: { reden: EIGEN_REDEN, toelichting: t.slice(0, EIGEN_REDEN_MAX) } }
}

/** Wat er bij afwijzen in data komt: de reden (vast of "Eigen reden") voor de telling, de eigen tekst en wanneer. */
export function afwijsData(k: AfwijsKeuze, door: string, nu = new Date()) {
  return { afwijsReden: k.reden, afwijsToelichting: k.toelichting, afgewezenOp: nu.toISOString(), afgewezenDoor: door }
}

/** De reden zoals een mens hem leest: de eigen tekst als die er is, anders de vaste reden. */
export function afwijsTekst(d: { afwijsReden?: unknown; afwijsToelichting?: unknown } | null | undefined): string | null {
  if (!d) return null
  if (typeof d.afwijsToelichting === 'string' && d.afwijsToelichting) return d.afwijsToelichting
  return typeof d.afwijsReden === 'string' && d.afwijsReden ? d.afwijsReden : null
}

export type HistorieStap = { soort: 'binnen' | 'gelezen' | 'omgezet' | 'afgewezen'; op: string | null; tekst: string; reden?: string | null }

/** De historie van een inzicht, oudste eerst: binnengekomen, gelezen, omgezet in een taak of afgewezen met reden. */
export function inzichtHistorie(s: { createdAt: string; updatedAt?: string | null; status: string; bronLabel?: string | null; data?: Record<string, any> | null }): HistorieStap[] {
  const d = s.data ?? {}
  const uit: HistorieStap[] = [{ soort: 'binnen', op: s.createdAt, tekst: s.bronLabel ? `Binnengekomen via ${s.bronLabel}` : 'Binnengekomen' }]
  if (typeof d.gelezenOp === 'string' || (s.status === 'gelezen' && s.updatedAt && s.updatedAt !== s.createdAt)) uit.push({ soort: 'gelezen', op: (d.gelezenOp as string) ?? s.updatedAt ?? null, tekst: 'Gelezen' })
  if (s.status === 'omgezet') uit.push({ soort: 'omgezet', op: s.updatedAt ?? null, tekst: 'Omgezet in een taak' })
  if (s.status === 'afgewezen') {
    const eigen = d.afwijsReden === EIGEN_REDEN
    uit.push({ soort: 'afgewezen', op: (d.afgewezenOp as string) ?? s.updatedAt ?? null, tekst: eigen ? 'Afgewezen met een eigen reden' : 'Afgewezen', reden: afwijsTekst(d) })
  }
  return uit
}

/** Een dag (JJJJ-MM-DD) in Amsterdamse tijd, zodat Van en Tot hele kalenderdagen zijn. */
export const amsterdamDag = (iso: string | Date) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })
const isDag = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)

/** Valt het moment binnen Van en Tot (beide inclusief, beide optioneel)? Een ongeldige datum telt niet als filter. */
export function binnenPeriode(op: string, van?: string | null, tot?: string | null): boolean {
  const dag = amsterdamDag(op)
  if (isDag(van) && dag < van) return false
  if (isDag(tot) && dag > tot) return false
  return true
}

/** De tekst van een winpunt: de titel uit het verkoopverhaal bij een bekend id, anders de waarde zelf (vrije tekst van een agent). */
export function winpuntTekst(waarde: string | null | undefined, titels: Map<string, string> | Record<string, string>): string | null {
  if (!waarde) return null
  const t = titels instanceof Map ? titels.get(waarde) : titels[waarde]
  return t ?? waarde
}
