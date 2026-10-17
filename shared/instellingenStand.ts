// De stand per kaart op Instellingen (F22): één regel in woorden, zoals "21 regels, 19 door de motor" of
// "Nog niet ingericht". Nooit een kaal getal of percentage. Server rekent, deze functies formuleren.

export const NIET_INGERICHT = 'Nog niet ingericht'

/** "1 regel" of "3 regels"; 0 geeft de lege tekst als die er is. */
export function aantal(n: number, enkel: string, meer: string, leeg?: string): string {
  if (n === 0 && leeg) return leeg
  return `${n.toLocaleString('nl-NL')} ${n === 1 ? enkel : meer}`
}

/** "3 van 5 koppelingen actief"; zonder iets om te tellen de lege tekst. */
export function vanTotaal(deel: number, totaal: number, meer: string, wat: string, leeg = NIET_INGERICHT): string {
  if (totaal === 0) return leeg
  return `${deel.toLocaleString('nl-NL')} van ${totaal.toLocaleString('nl-NL')} ${meer} ${wat}`.trim()
}

/** Zinnen samenvoegen met een komma, lege delen vallen weg. */
export const zin = (...delen: (string | null | undefined | false)[]) => delen.filter(Boolean).join(', ')

/** De koppelingen die de groep Koppelingen telt, met hun stand. */
export interface KoppelingStand { sleutel: string; naam: string; actief: boolean }
export function koppelingenTekst(k: KoppelingStand[]): string {
  return vanTotaal(k.filter((x) => x.actief).length, k.length, 'koppelingen', 'actief')
}
