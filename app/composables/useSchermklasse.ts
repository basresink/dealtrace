// Schermklasse (P27, 8.3): telefoon, tablet of laptop. Op de server laptop; in de browser
// bijgewerkt bij elke breedtewijziging. De schil zelf wisselt met CSS, zodat er niets verspringt.
import { schermklasse, type Schermklasse } from '~~/shared/onderbalk'

export function useSchermklasse() {
  const klasse = useState<Schermklasse>('schermklasse', () => 'laptop')
  if (import.meta.client && !(window as any).__schermklasse) {
    ;(window as any).__schermklasse = true
    const zet = () => { klasse.value = schermklasse(window.innerWidth, window.matchMedia('(pointer: coarse)').matches) }
    zet()
    window.addEventListener('resize', zet, { passive: true })
  }
  return klasse
}
