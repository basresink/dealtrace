// De wis-conventie van het patch-protocol (overgenomen uit DealDrive, shared/wisPatch.ts).
//
//   null          wis dit veld
//   sleutel weg   laat dit veld met rust
//
// Een sleutel die expliciet aanwezig is met waarde undefined telt als null,
// want undefined overleeft JSON niet. Lokaal en op de server wordt een gewist
// veld echt verwijderd, niet op null gezet.

export type Wisbaar<T> = { [K in keyof T]?: T[K] | null }

/** Maakt een patch klaar voor verzenden: undefined wordt null. */
export function naarVerzendPatch<T extends object>(patch: Wisbaar<T>): Record<string, unknown> {
  const uit: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(patch)) uit[k] = v === undefined ? null : v
  return uit
}

/** Past een patch toe op een object: null en undefined verwijderen de sleutel. */
export function pasPatchToe<T extends Record<string, unknown>>(bestaand: T, patch: Record<string, unknown>): T {
  const uit: Record<string, unknown> = { ...bestaand }
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined) delete uit[k]
    else uit[k] = v
  }
  return uit as T
}
