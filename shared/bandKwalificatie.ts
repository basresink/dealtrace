// Kwalificatie BAND (behoefte, autoriteit, noodzaak, draagvlak). Minimaal 3 van 4
// meldt `gekwalificeerd` op het meldpunt (F05, P05).
export const BAND_LETTERS = ['behoefte', 'autoriteit', 'noodzaak', 'draagvlak'] as const
export type BandLetter = typeof BAND_LETTERS[number]
export type Band = Partial<Record<BandLetter, { ja: boolean; bron?: string; op?: string }>>

export function bandScore(band: Band | null | undefined): number {
  return BAND_LETTERS.filter((l) => band?.[l]?.ja).length
}

export function bandGekwalificeerd(band: Band | null | undefined): boolean {
  return bandScore(band) >= 3
}
