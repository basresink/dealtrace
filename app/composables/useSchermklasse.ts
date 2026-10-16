// Schermklasse (P27, 8.3): telefoon, tablet of laptop. De browser onthoudt de klasse in een cookie, zodat
// de server bij het volgende bezoek meteen dezelfde weergave tekent; zonder cookie tekent de server laptop.
// In de browser volgt de klasse de breedte pas na de hydratatie, zodat server en browser eerst precies
// hetzelfde tekenen (geen hydration-mismatch, B10). De schil zelf wisselt met CSS, zodat er niets verspringt.
import { schermklasse, type Schermklasse } from '~~/shared/onderbalk'

const KLASSEN: Schermklasse[] = ['telefoon', 'tablet', 'laptop']

export function useSchermklasse() {
  const cookie = useCookie<string | null>('dt-schermklasse', { sameSite: 'lax', maxAge: 60 * 60 * 24 * 365, default: () => null })
  const klasse = useState<Schermklasse>('schermklasse', () => (KLASSEN.includes(cookie.value as Schermklasse) ? cookie.value as Schermklasse : 'laptop'))
  if (import.meta.client && !(window as any).__schermklasse) {
    ;(window as any).__schermklasse = true
    const zet = () => {
      const k = schermklasse(window.innerWidth, window.matchMedia('(pointer: coarse)').matches)
      klasse.value = k
      if (cookie.value !== k) cookie.value = k
    }
    const nuxtApp = useNuxtApp()
    if (nuxtApp.isHydrating) nuxtApp.hooks.hookOnce('app:suspense:resolve', zet)
    else zet()
    window.addEventListener('resize', zet, { passive: true })
  }
  return klasse
}
