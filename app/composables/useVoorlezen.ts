// Voorlezen (P31, 8.9): de spraaksynthese van het toestel in nl-NL. De tekst komt altijd uit een
// pure functie in shared/spreek.ts (hooguit 60 seconden, zonder opsommingstekens).
export function useVoorlezen() {
  const spreekt = useState('spreekt', () => false)
  const kan = () => import.meta.client && 'speechSynthesis' in window
  function lees(tekst: string, opEinde?: () => void) {
    if (!kan()) return false
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(tekst)
    u.lang = 'nl-NL'
    u.onend = () => { spreekt.value = false; opEinde?.() }
    spreekt.value = true
    window.speechSynthesis.speak(u)
    return true
  }
  function stop() { if (kan()) window.speechSynthesis.cancel(); spreekt.value = false }
  return { spreekt, lees, stop, kan }
}
