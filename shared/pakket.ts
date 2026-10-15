// Pakketwissel (F23, gat 48): wat een klant wint of verliest, uit de functiecatalogus.
import { FUNCTIES, pakketBevat, type Functie } from './functies'
import { PAKKET_LABEL, type Pakket } from './types'

export function pakketVerschil(van: Pakket, naar: Pakket, catalogus: readonly Functie[] = FUNCTIES): { wint: string[]; verliest: string[] } {
  const wint: string[] = []
  const verliest: string[] = []
  if (van === naar) return { wint, verliest }
  for (const f of catalogus) {
    if (f.rollen !== 'iedereen' && f.rollen.every((r) => r === 'founder')) continue
    const voor = pakketBevat({ pakket: van, features: {} }, f)
    const na = pakketBevat({ pakket: naar, features: {} }, f)
    if (!voor && na) wint.push(f.naam)
    if (voor && !na) verliest.push(f.naam)
  }
  return { wint, verliest }
}

export function isVerlaging(van: Pakket, naar: Pakket): boolean {
  const volgorde: Pakket[] = ['starter', 'plus', 'compleet']
  return volgorde.indexOf(naar) < volgorde.indexOf(van)
}

/** Het pakket in gewone woorden voor de beheerder (spiegel, F23). */
export const PAKKET_UITLEG: Record<Pakket, string> = {
  starter: 'Starter: de basis voor prospects, belblokken, bezoeken en je dag.',
  plus: 'Plus: Starter met meer automatisering en inzicht.',
  compleet: 'Compleet: alles van Dealtrace, inclusief de uitgebreide AI-onderdelen.',
}
export { PAKKET_LABEL }
