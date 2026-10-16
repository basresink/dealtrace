// Acties op een concept (8.5.7, F06), gedeeld door de conceptkaart, de rasterkaart en de conceptflyout:
// goedkeuren (met of zonder aanpassing) of afwijzen via /api/concepten/:id/besluit, versturen via de
// mailkoppeling (/api/mail/verstuur) en WhatsApp (P26). Goedkeuren kan offline; versturen wacht op verbinding.
import type { ComputedRef, Ref } from 'vue'

export function useConceptActies(concept: Ref<any> | ComputedRef<any>, gewijzigd: () => void) {
  const toast = useToast()
  const { voegToe } = useSyncQueue()
  const { functie } = useMe()
  const bezig = ref(false)

  async function besluit(b: 'goedkeuren' | 'verwerpen', aanpassing?: { tekst: string; onderwerp: string }) {
    const c = concept.value
    const body = { besluit: b, ...(aanpassing ? { tekst: aanpassing.tekst, onderwerp: aanpassing.onderwerp } : {}) }
    try {
      if (import.meta.client && !navigator.onLine) {
        await voegToe({ tabel: 'concepten', op: 'patch', recordId: c.id, patch: { soort: 'concept.besluit', ...body } })
        toast.toon('Bewaard. Wordt verstuurd zodra je weer verbinding hebt.')
      } else {
        await $fetch(`/api/concepten/${c.id}/besluit`, { method: 'POST', body })
        toast.toon(b === 'verwerpen' ? 'Concept afgewezen.' : 'Goedgekeurd.')
      }
      gewijzigd()
      return true
    } catch (e) { toast.toon(foutTekst(e), 'fout'); return false }
  }

  async function verstuur() {
    bezig.value = true
    try { const r = await $fetch<any>('/api/mail/verstuur', { method: 'POST', body: { conceptId: concept.value.id } }); toast.toon(r.tekst); gewijzigd() } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
  }

  // WhatsApp (P26): met koppeling, goedgekeurd sjabloon en opt-in "Verstuur via WhatsApp"; anders openen in WhatsApp.
  const wa = ref<{ gekoppeld: boolean; sjabloon: any; consent: string; mobiel: boolean } | null>(null)
  watch(() => [concept.value?.id, concept.value?.status, concept.value?.concept?.type], async () => {
    const c = concept.value
    wa.value = null
    if (import.meta.client && c?.concept?.type === 'whatsapp' && c.status === 'goedgekeurd' && c.accountId && functie('whatsapp.versturen')?.beschikbaar) {
      try { wa.value = await $fetch('/api/whatsapp/stand', { query: { accountId: c.accountId } }) } catch { wa.value = null }
    }
  }, { immediate: true })
  const waKan = computed(() => !!wa.value?.gekoppeld && !!wa.value.sjabloon && wa.value.consent === 'ja')
  const waGeenToestemming = computed(() => concept.value?.concept?.type === 'whatsapp' && !!wa.value?.gekoppeld && wa.value.consent !== 'ja')
  async function verstuurWa() {
    bezig.value = true
    try { const r = await $fetch<any>('/api/whatsapp/verstuur', { method: 'POST', body: { conceptId: concept.value.id } }); toast.toon(r.tekst); gewijzigd() } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
  }

  async function kopieer() {
    const c = concept.value?.concept
    try { await navigator.clipboard.writeText([c?.onderwerp, c?.tekst].filter(Boolean).join('\n\n')); toast.toon('Gekopieerd.') } catch { toast.toon('Kopiëren lukt hier niet.', 'let-op') }
  }

  return { bezig, besluit, verstuur, wa, waKan, waGeenToestemming, verstuurWa, kopieer }
}
