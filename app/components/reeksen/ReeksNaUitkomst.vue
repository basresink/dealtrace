<script setup lang="ts">
// Rond af (F7): na Voicemail ingesproken of Gesproken, later kan een opvolgreeks starten. Kies Geen reeks of een
// sjabloon; het sjabloon dat bij de uitkomst hoort (instelling per sjabloon) staat klaar. "Na informatie" kies je als
// de prospect om informatie vroeg. Loopt er al een reeks of is de prospect gedeactiveerd, dan zegt het blok dat.
import { reeksUitkomstVan, sjabloonVoorUitkomst } from '~~/shared/opvolgreeks'

const props = defineProps<{ accountId: string; uitkomst: string }>()
const model = defineModel<string>({ default: '' })
const d = ref<any>(null)
async function laad() {
  d.value = await $fetch<any>('/api/reekssjablonen', { query: { accountId: props.accountId } }).catch(() => null)
  kiesStandaard()
}
function kiesStandaard() {
  if (!d.value || d.value.account?.lopend || d.value.account?.gedeactiveerd) { model.value = ''; return }
  model.value = sjabloonVoorUitkomst<{ id: string; uitkomsten: string[] }>(d.value.sjablonen, reeksUitkomstVan(props.uitkomst))?.id ?? ''
}
watch(() => props.accountId, laad, { immediate: true })
watch(() => props.uitkomst, kiesStandaard)
</script>

<template>
  <div v-if="d && d.sjablonen.length" class="veld rnu" data-test="reeks-na-uitkomst">
    <span class="veld-label">Opvolgreeks starten</span>
    <p v-if="d.account?.lopend" class="meta" data-test="rnu-lopend">Er loopt al een reeks ({{ d.account.lopend.naam }}). Die gaat door; de uitkomst telt als reactie als het een gesprek was.</p>
    <p v-else-if="d.account?.gedeactiveerd" class="meta">Deze prospect is gedeactiveerd en krijgt geen reeks.</p>
    <div v-else class="rnu-pillen" role="radiogroup" aria-label="Opvolgreeks starten">
      <button type="button" role="radio" class="filter-pil" :class="{ 'filter-pil--aan': !model }" :aria-checked="!model" data-test="rnu-geen" @click="model = ''">Geen reeks</button>
      <button v-for="s in d.sjablonen" :key="s.id" type="button" role="radio" class="filter-pil" :class="{ 'filter-pil--aan': model === s.id }" :aria-checked="model === s.id" :title="s.na ? `Na: ${s.na}` : undefined" :data-test="`rnu-${s.sleutel}`" @click="model = s.id">{{ s.naam }}</button>
    </div>
    <span v-if="model" class="veld-uitleg">De reeks start na het afronden en stopt vanzelf zodra de prospect reageert. Concepten van de Schrijver keur je zelf goed.</span>
  </div>
</template>

<style scoped>
.rnu-pillen { display: flex; flex-wrap: wrap; gap: 8px; }
@media (max-width: 719px) { .rnu-pillen .filter-pil { min-height: var(--touch-target-min); } }
</style>
