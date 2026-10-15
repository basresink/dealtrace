<script setup lang="ts">
// Waarnemer instellen (P19, F14, F22): per doelgroep de signaalsoorten met trefwoorden, minimale
// relevantie en het winpunt dat erbij past, en de cadans (minimaal wekelijks). Gevorderd leest mee.
import { SIGNAALSOORT_LABEL, type WaarnemerProfiel } from '~~/shared/agents'
const { functie } = useMe()
const aan = computed(() => !!functie('agents.lezen')?.beschikbaar)
const toast = useToast()
const { data, refresh } = await useFetch<any>('/api/waarnemer/profielen', { immediate: aan.value, default: () => ({ profielen: [], winpunten: [], kanBewerken: false }) })
const gekozen = ref<string>('')
const profiel = ref<WaarnemerProfiel | null>(null)
const trefwoorden = ref<string[]>([])
function laad() {
  const p = data.value.profielen.find((x: any) => (x.doelgroepId ?? '') === gekozen.value) ?? data.value.profielen[0]
  if (!p) return
  profiel.value = JSON.parse(JSON.stringify(p.profiel))
  for (const r of profiel.value!.signaalsoorten) r.winpuntId ??= null
  trefwoorden.value = profiel.value!.signaalsoorten.map((r) => r.trefwoorden.join(', '))
}
watch([() => data.value, gekozen], laad, { immediate: true })
const eigen = computed(() => data.value.profielen.find((x: any) => (x.doelgroepId ?? '') === gekozen.value)?.eigen)
async function bewaar() {
  const p = { ...profiel.value!, signaalsoorten: profiel.value!.signaalsoorten.map((r, i) => ({ ...r, trefwoorden: trefwoorden.value[i]!.split(',').map((t) => t.trim()).filter(Boolean) })) }
  try { await $fetch('/api/waarnemer/profielen', { method: 'PUT', body: { doelgroepId: gekozen.value || null, profiel: p } }); toast.toon('Profiel bewaard.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const HULP: Record<string, string> = { vacature: 'Functietrefwoorden', nieuws: 'Trefwoorden', kvk: 'Mutaties in het Handelsregister', website: 'Wijzigingen op de website', aanbesteding: 'CPV-codes' }
useHead({ title: 'Waarnemer · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="agents.lezen" />
    <template v-else>
      <PaginaKop kicker="Instellingen · Data en AI" titel="Waarnemer en signaalregels" uitleg="Waar de Waarnemer per doelgroep op let. Een voorbeeld: '50 jaar bestaan' wordt een felicitatie met een kaart en het winpunt De meekijkdag." helpartikel="agents-en-mandaten" />
      <section class="section">
        <div class="container container--smal">
          <p class="alleen-groot-melding kaart kaart--geel">Beter op een groot scherm.</p>
          <form v-if="profiel" class="kaart" data-test="waarnemer-profiel" @submit.prevent="bewaar">
            <label class="veld"><span class="veld-label">Doelgroep</span>
              <select v-model="gekozen" class="invoer" data-test="waarnemer-doelgroep"><option v-for="p in data.profielen" :key="p.doelgroepId ?? ''" :value="p.doelgroepId ?? ''">{{ p.naam }}{{ p.eigen ? '' : ' (standaard)' }}</option></select></label>
            <p v-if="!eigen" class="kaart-meta mt-8">Deze doelgroep gebruikt het standaardprofiel.</p>
            <fieldset :disabled="!data.kanBewerken" class="mt-16">
              <div v-for="(r, i) in profiel.signaalsoorten" :key="r.soort" class="formulier-raster waarnemer-rij" :data-test="`regel-${r.soort}`">
                <label class="schakel-inline"><input v-model="r.aan" type="checkbox"> {{ SIGNAALSOORT_LABEL[r.soort] }}</label>
                <label class="veld"><span class="veld-label">{{ HULP[r.soort] }}</span><input v-model="trefwoorden[i]" class="invoer" placeholder="Gescheiden door komma's"></label>
                <label class="veld"><span class="veld-label">Minimale relevantie</span><input v-model.number="r.minRelevantie" type="number" min="0" max="100" class="invoer"></label>
                <label class="veld"><span class="veld-label">Winpunt</span><select v-model="r.winpuntId" class="invoer"><option :value="null">Geen</option><option v-for="w in data.winpunten" :key="w.id" :value="w.id">{{ w.titel }}</option></select></label>
              </div>
              <label class="veld mt-16"><span class="veld-label">Cadans per account (dagen, minimaal 7)</span><input v-model.number="profiel.cadansDagen" type="number" min="7" class="invoer" data-test="waarnemer-cadans"></label>
            </fieldset>
            <div v-if="data.kanBewerken" class="dd-acties mt-16"><button type="submit" class="dd-actie dd-actie--primair" data-test="waarnemer-bewaar">Bewaar</button></div>
            <p v-else class="kaart-meta mt-16">Je leest mee. Een Expert of je beheerder past het profiel aan.</p>
          </form>
        </div>
      </section>
    </template>
  </div>
</template>
