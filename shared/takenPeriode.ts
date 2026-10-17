// Filtergroep Periode op /taken: Vandaag, Morgen, Deze week, Volgende week of een eigen periode
// (?van=&tot=, ISO-datums). Met een eigen periode kijk je ook terug: afgeronde en verlopen taken
// in die periode komen mee. Eén definitie voor de pagina en GET /api/tasks.
import { nlMoment, plusDagen, weekdag } from './datum'

export const PERIODE_KEUZES = [
  { sleutel: 'vandaag', label: 'Vandaag' },
  { sleutel: 'morgen', label: 'Morgen' },
  { sleutel: 'deze-week', label: 'Deze week' },
  { sleutel: 'volgende-week', label: 'Volgende week' },
] as const

export interface Bereik {
  /** Eerste dag (ISO), of null voor open aan het begin. */
  van: string | null
  /** Laatste dag (ISO, inclusief), of null voor open aan het eind. */
  tot: string | null
  /** Een eigen periode: dan tellen ook afgeronde taken mee. */
  eigen: boolean
}

const isDatum = (x: unknown): x is string => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && !Number.isNaN(Date.parse(`${x}T12:00:00Z`))

/**
 * Het bereik van een periode. Vandaag (met wat over tijd is), Komende 7 dagen en Achterstallig
 * regelen de statkaarten zelf; die geven hier null. Een eigen periode gaat voor een vaste keuze.
 */
export function periodeBereik(q: { periode?: unknown; van?: unknown; tot?: unknown }, nu: Date): Bereik | null {
  const van = isDatum(q.van) ? q.van : null
  const tot = isDatum(q.tot) ? q.tot : null
  if (van || tot) return van && tot && van > tot ? { van: tot, tot: van, eigen: true } : { van, tot, eigen: true }
  const v = nlMoment(nu).datum
  const maandag = plusDagen(v, 1 - weekdag(v))
  if (q.periode === 'morgen') return { van: plusDagen(v, 1), tot: plusDagen(v, 1), eigen: false }
  if (q.periode === 'deze-week') return { van: maandag, tot: plusDagen(maandag, 6), eigen: false }
  if (q.periode === 'volgende-week') return { van: plusDagen(maandag, 7), tot: plusDagen(maandag, 13), eigen: false }
  return null
}

/** Valt deze dag (ISO) in het bereik? Een taak zonder datum valt erbuiten. */
export function inBereik(datum: string | null, b: Bereik): boolean {
  if (!datum) return false
  return (!b.van || datum >= b.van) && (!b.tot || datum <= b.tot)
}

/** De dag waarop een taak in een periode telt: de vervaldatum, voor een afgeronde taak zonder vervaldatum de dag van afronden. */
export function taakDag(t: { dueDate: string | null; status?: string; updatedAt?: string | null }): string | null {
  const iso = t.dueDate ?? (t.status === 'klaar' ? t.updatedAt ?? null : null)
  return iso ? nlMoment(new Date(iso)).datum : null
}
