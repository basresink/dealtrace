// Rijmodus (P26, 8.6, Expert): aan met de schakelaar of automatisch na "Navigeer". Meldingen wachten op de
// server tot de rijmodus uit is en komen dan gebundeld.
export function useRijmodus() {
  const { me, functie } = useMe()
  const aan = useState<boolean>('rijmodus', () => !!(me.value?.gebruiker as any)?.rijmodus)
  const mag = computed(() => !!functie('meldingen.rijmodus')?.beschikbaar)
  const toast = useToast()
  async function zet(w: boolean) {
    if (!mag.value || aan.value === w) return
    try { const r = await $fetch<{ tekst: string }>('/api/mij/rijmodus', { method: 'PUT', body: { aan: w } }); aan.value = w; toast.toon(r.tekst) } catch (e) { toast.toon(foutTekst(e), 'fout') }
  }
  return { aan, mag, zet }
}
