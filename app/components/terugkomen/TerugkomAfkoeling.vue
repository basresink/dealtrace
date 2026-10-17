<script setup lang="ts">
// Instellingen, Terugkomen, tabblad Afkoeling: per kanaal hoe lang je een prospect na een nee met rust laat.
// De afkoeling is de ondergrens van elke regel. Dit is de enige plek waar hij verandert (alleen de beheerder);
// de andere schermen tonen hem alleen. Elke wijziging toont eerst wat er verschuift.
import { AFKOELING_STANDAARD, KANAAL_LABEL, KANALEN, type Kanaal } from '~~/shared/nbStatus'
import { korterDanAfkoeling, type Verschuiving } from '~~/shared/terugkomBeheer'

const props = defineProps<{ data: any }>()
const emit = defineEmits<{ bewaard: [] }>()
const toast = useToast()
const mag = computed(() => !!props.data.kan?.afkoeling)
const dagen = reactive<Record<Kanaal, number>>({ ...AFKOELING_STANDAARD })
watch(() => props.data.afkoeling, (a) => Object.assign(dagen, a ?? {}), { immediate: true })
const gewijzigd = computed(() => KANALEN.some((k) => Number(dagen[k]) !== props.data.afkoeling?.[k]))
const geldig = computed(() => KANALEN.every((k) => Number.isInteger(Number(dagen[k])) && Number(dagen[k]) >= 0 && Number(dagen[k]) <= 730 && String(dagen[k]) !== ''))
const regelsPer = (k: Kanaal) => (props.data.regels ?? []).filter((r: any) => r.kanaalSleutel === k)
const korter = computed(() => (props.data.regels ?? []).map((r: any) => ({ r, t: korterDanAfkoeling(r, { ...dagen }) })).filter((x: any) => x.t))

const lijst = ref<Verschuiving[] | null>(null)
const rekent = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
watch(() => ({ ...dagen }), () => {
  clearTimeout(timer)
  if (!gewijzigd.value || !geldig.value) { lijst.value = null; return }
  rekent.value = true
  timer = setTimeout(async () => {
    try { lijst.value = ((await $fetch('/api/instellingen/terugkomen/proef', { method: 'POST', body: { afkoeling: { ...dagen } } })) as any).verschuivingen } catch { lijst.value = null } finally { rekent.value = false }
  }, 300)
})
const bezig = ref(false)
async function bewaar() {
  bezig.value = true
  try {
    const r: any = await $fetch('/api/instellingen/terugkomen/afkoeling', { method: 'PUT', body: { afkoeling: Object.fromEntries(KANALEN.map((k) => [k, Number(dagen[k])])) } })
    toast.toon(`Afkoeling bewaard. ${r.verschoven ? `${r.verschoven} ${r.verschoven === 1 ? 'prospect' : 'prospects'} verschoven.` : 'Er verschoof niets.'}`)
    emit('bewaard')
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
</script>

<template>
  <form @submit.prevent="bewaar">
    <h2 class="kaart-titel">Afkoeling per kanaal</h2>
    <p class="meta mt-8">De afkoeling is de ondergrens: zo lang laat je een prospect na een nee met rust via dat kanaal. Een regel komt nooit eerder terug; een kortere wachttijd schuift op naar het einde van de afkoeling. "Niet geschikt" is altijd 365 dagen voor elk kanaal.</p>
    <p v-if="!mag" class="meta mt-8" data-test="tk-afkoeling-lezen">Alleen de beheerder past de afkoeling aan.</p>
    <div class="ta-raster mt-16" data-test="tk-afkoeling">
      <label v-for="k in KANALEN" :key="k" class="kaart veld ta-kanaal">
        <span class="veld-label">{{ KANAAL_LABEL[k] }}</span>
        <input v-model.number="dagen[k]" class="invoer tnum" type="number" min="0" max="730" step="1" :disabled="!mag" :data-test="`tk-afk-${k}`">
        <span class="veld-uitleg">dagen na het verlies · standaard {{ AFKOELING_STANDAARD[k] }}</span>
        <span v-if="regelsPer(k).length" class="veld-uitleg">Regels: {{ regelsPer(k).map((r: any) => r.reden).join(', ') }}</span>
      </label>
    </div>
    <div v-if="korter.length" class="mt-16">
      <p v-for="x in korter" :key="x.r.id" class="waarschuwing mt-8" data-test="tk-afk-let-op"><Icoon naam="TriangleAlert" class="icoon" :grootte="16" /><span><strong>{{ x.r.reden }}:</strong> {{ x.t }}</span></p>
    </div>
    <div v-if="mag" class="kaart ta-blok mt-16">
      <TerugkomVerschuif :lijst="lijst" :bezig="rekent" :regels="data.regels" leeg="Pas een afkoeling aan om te zien wat er verschuift." />
      <div class="ta-voet">
        <button type="submit" class="dd-actie dd-actie--primair" :disabled="bezig || !gewijzigd || !geldig" data-test="tk-afk-bewaar">{{ bezig ? 'Bewaren...' : 'Bewaar afkoeling' }}</button>
        <button type="button" class="dd-actie dd-actie--secundair" :disabled="!gewijzigd" @click="Object.assign(dagen, data.afkoeling)">Annuleer</button>
      </div>
    </div>
  </form>
</template>

<style scoped>
.ta-raster { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
.ta-kanaal { padding: 14px; }
.ta-blok { padding: var(--kaart-padding); }
.ta-blok :deep(.tv) { border-top: 0; margin-top: 0; padding-top: 0; }
.ta-voet { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
</style>
