// Herkomst per veld (bouwplan 10.1 en 15.1). Een bron met lagere prioriteit
// overschrijft een hogere nooit stil. De hand wint altijd.

export const BRONNEN = ['hand', 'kvk', 'datacollectief', 'crm', 'salesdna', 'web', 'ai', 'import'] as const
export type Bron = typeof BRONNEN[number]

export interface Herkomst {
  bron: Bron
  op: string
  door?: string
  url?: string
}

/** Mag een waarde uit `nieuw` een waarde uit `oud` overschrijven? */
export function magOverschrijven(oud: Bron | undefined, nieuw: Bron): boolean {
  if (!oud) return true
  if (nieuw === 'hand') return true
  return BRONNEN.indexOf(nieuw) <= BRONNEN.indexOf(oud)
}
