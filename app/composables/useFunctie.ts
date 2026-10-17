// Eén helper voor elke ingang naar een functie (wens: staat een functie uit, dan laat
// de app de functie, de knop en elke link ernaar niet zien). Gebruik `aan(sleutel)` voor
// een knop of blok en `magNaar(pad)` voor een link; geen losse niveau-checks.
import { magNaarPad, uitgezetVoorPad } from '~~/shared/functieRoutes'

export function useFunctie() {
  const { me } = useMe()
  /** Staat de functie aan voor deze gebruiker (pakket, rol en niveau, zoals de server rekent)? */
  function aan(sleutel: string): boolean {
    return !!me.value?.functies.find((f) => f.sleutel === sleutel)?.beschikbaar
  }
  /** Mag een link naar dit pad getoond worden? Zonder organisatie (founder) gelden geen functies. */
  function magNaar(pad: string | null | undefined): boolean {
    if (!me.value?.organisatie) return true
    return magNaarPad(pad, aan)
  }
  /** De functie die dit pad blokkeert, of null. */
  function blokkeert(pad: string | null | undefined): string | null {
    if (!me.value?.organisatie) return null
    return uitgezetVoorPad(pad, aan)
  }
  return { aan, magNaar, blokkeert }
}
