// Meldingsstrook (8.3): een succes verdwijnt na 5 seconden, een fout blijft staan.
export interface Toast { id: number; tekst: string; soort: 'succes' | 'fout' | 'let-op'; link?: { tekst: string; naar: string }; actie?: { tekst: string; doe: () => unknown } }

let teller = 0
export function useToast() {
  const toasts = useState<Toast[]>('toasts', () => [])
  function toon(tekst: string, soort: Toast['soort'] = 'succes', link?: Toast['link'], actie?: Toast['actie']) {
    const t = { id: ++teller, tekst, soort, link, actie }
    toasts.value = [...toasts.value, t]
    if (soort !== 'fout') setTimeout(() => sluit(t.id), 5000)
  }
  function sluit(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }
  return { toasts, toon, sluit }
}
