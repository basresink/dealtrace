<script setup lang="ts">
// Factuurgegevens (F23) op Instellingen, Abonnement: op welke naam en welk adres Dealtrace factureert, met
// KvK, btw-nummer en het e-mailadres voor facturen. Bewaren met een knop, fouten per veld onder het veld.
import { LEGE_FACTUURGEGEVENS, type FactuurVeld, type Factuurgegevens } from '~~/shared/facturatie'

const props = defineProps<{ gegevens: Factuurgegevens | null; alleenLezen?: boolean }>()
const emit = defineEmits<{ bewaard: [g: Factuurgegevens] }>()
const toast = useToast()
const g = reactive<Factuurgegevens>({ ...LEGE_FACTUURGEGEVENS, ...(props.gegevens ?? {}) })
const fouten = ref<Partial<Record<FactuurVeld, string>>>({})
const bezig = ref(false)
const gewijzigd = ref(false)
watch(g, () => { gewijzigd.value = true }, { deep: true })

const VELDEN: { veld: FactuurVeld; label: string; verplicht?: boolean; type?: string; auto?: string; breed?: boolean }[] = [
  { veld: 'bedrijfsnaam', label: 'Naam op de factuur', verplicht: true, auto: 'organization', breed: true },
  { veld: 'adres', label: 'Straat en huisnummer', verplicht: true, auto: 'street-address', breed: true },
  { veld: 'postcode', label: 'Postcode', verplicht: true, auto: 'postal-code' },
  { veld: 'plaats', label: 'Plaats', verplicht: true, auto: 'address-level2' },
  { veld: 'kvk', label: 'KvK-nummer' },
  { veld: 'btw', label: 'Btw-nummer' },
  { veld: 'email', label: 'E-mail voor facturen', verplicht: true, type: 'email', auto: 'email', breed: true },
]

async function bewaar() {
  if (bezig.value) return
  bezig.value = true
  fouten.value = {}
  try {
    const r = await $fetch<{ gegevens: Factuurgegevens }>('/api/instellingen/abonnement/factuurgegevens', { method: 'PUT', body: { gegevens: { ...g } } })
    Object.assign(g, r.gegevens)
    await nextTick()
    gewijzigd.value = false
    toast.toon('Factuurgegevens bewaard.')
    emit('bewaard', r.gegevens)
  } catch (e: any) {
    fouten.value = e?.data?.data?.fouten ?? {}
    toast.toon(Object.keys(fouten.value).length ? 'Controleer de gemarkeerde velden.' : foutTekst(e), 'fout')
  } finally {
    bezig.value = false
  }
}
</script>

<template>
  <article class="kaart" data-test="factuurgegevens">
    <header class="kaart-kop"><h2 class="kaart-titel">Factuurgegevens</h2><span v-if="gewijzigd" class="bewaar-status" aria-live="polite">Nog niet bewaard</span></header>
    <p class="kaart-meta">Op deze naam en dit adres maakt Dealtrace je facturen. De factuur gaat naar het e-mailadres hieronder.</p>
    <form class="factuur-raster" novalidate @submit.prevent="bewaar">
      <label class="veld factuur-veld--breed"><span class="veld-label">Land</span>
        <select v-model="g.land" class="invoer" :disabled="alleenLezen" data-test="factuur-land"><option value="NL">Nederland</option><option value="BE">België</option></select>
      </label>
      <label v-for="v in VELDEN" :key="v.veld" class="veld" :class="{ 'factuur-veld--breed': v.breed }">
        <span class="veld-label">{{ v.veld === 'kvk' && g.land === 'BE' ? 'Ondernemingsnummer' : v.label }} <span v-if="v.verplicht" class="veld-verplicht">*</span></span>
        <input
          v-model="g[v.veld]" class="invoer" :type="v.type ?? 'text'" :autocomplete="v.auto" :disabled="alleenLezen"
          :aria-invalid="!!fouten[v.veld]" :aria-describedby="fouten[v.veld] ? `factuur-fout-${v.veld}` : undefined" :data-test="`factuur-${v.veld}`"
        >
        <span v-if="fouten[v.veld]" :id="`factuur-fout-${v.veld}`" class="veld-fout veld-fout--regel" :data-test="`factuur-fout-${v.veld}`">{{ fouten[v.veld] }}</span>
      </label>
      <div v-if="!alleenLezen" class="dd-acties factuur-veld--breed">
        <button type="submit" class="dd-actie dd-actie--primair" :disabled="bezig" data-test="factuur-bewaar">{{ bezig ? 'Bewaren…' : 'Bewaar factuurgegevens' }}</button>
      </div>
    </form>
  </article>
</template>

<style scoped>
.factuur-raster { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; margin-top: 12px; }
.factuur-veld--breed { grid-column: 1 / -1; }
.factuur-raster .invoer { min-height: 44px; width: 100%; }
@media (max-width: 767px) { .factuur-raster { grid-template-columns: 1fr; } }
</style>
