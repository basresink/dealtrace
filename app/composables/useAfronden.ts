// Eén plek in de client voor afronden (F06): online direct, op de telefoon eerst 5 seconden
// "Ongedaan maken" in de meldingsstrook, offline via de wachtrij. Elk pad komt op de
// server uit bij hetzelfde rondTaakAf.
export interface AfrondBody { uitkomst?: string | null; laterOp?: string | null; reden?: string | null; toelichting?: string | null }
export interface Strook { tekst: string; ongedaan?: () => void; tot: number }

export function useAfronden() {
  const strook = useState<Strook | null>('afrondStrook', () => null)
  const toast = useToast()
  const { voegToe } = useSyncQueue()
  const versie = useState('takenVersie', () => 0)

  async function verstuur(taakId: string, body: AfrondBody): Promise<{ tekst: string } | null> {
    if (import.meta.client && !navigator.onLine) {
      await voegToe({ tabel: 'tasks', op: 'patch', recordId: taakId, patch: { soort: 'taak.afronden', ...body, op: new Date().toISOString() } })
      toast.toon('Bewaard op je telefoon, wordt verstuurd zodra je verbinding hebt.')
      versie.value++
      return null
    }
    const r = await $fetch<{ tekst: string }>(`/api/tasks/${taakId}/afronden`, { method: 'POST', body: { ...body, idempotentieSleutel: crypto.randomUUID() } })
    versie.value++
    return r
  }

  /** Rond af; op de telefoon met 5 seconden om ongedaan te maken. */
  async function rondAf(taakId: string, body: AfrondBody, opties: { mobiel?: boolean } = {}): Promise<boolean> {
    if (opties.mobiel) {
      return new Promise((klaar) => {
        let geannuleerd = false
        const timer = setTimeout(async () => {
          strook.value = null
          if (geannuleerd) return klaar(false)
          try { const r = await verstuur(taakId, body); if (r) toast.toon(r.tekst); klaar(true) } catch (e) { toast.toon(foutTekst(e), 'fout'); klaar(false) }
        }, 5000)
        strook.value = { tekst: 'Afgerond.', tot: Date.now() + 5000, ongedaan: () => { geannuleerd = true; clearTimeout(timer); strook.value = null; toast.toon('Niet afgerond.', 'let-op'); klaar(false) } }
      })
    }
    try { const r = await verstuur(taakId, body); if (r) toast.toon(r.tekst); return true } catch (e) { toast.toon(foutTekst(e), 'fout'); return false }
  }
  return { rondAf, strook, versie }
}
