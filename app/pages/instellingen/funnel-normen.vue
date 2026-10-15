<script setup lang="ts">
// Normen per fase (F17, beheerder): conversie naar de volgende fase en doorlooptijd. Het stokpunt op
// de funnel is de fase met de grootste achterstand op deze norm.
import { FUNNEL_FASES, FUNNEL_LABEL, leesNormen, NORMEN_STANDAARD, type FunnelFase } from '~~/shared/funnel'
const { functie } = useMe()
const aan = computed(() => !!functie('instellingen.funnelNormen')?.beschikbaar)
const toast = useToast()
const { data } = await useFetch<any>('/api/settings', { immediate: aan.value, default: () => ({}) })
const normen = reactive<Record<string, { conversie: number | null; doorlooptijd: number | null }>>({})
watch(() => data.value, (d) => { const n = leesNormen(d?.funnelNormen); for (const f of FUNNEL_FASES.slice(0, -1)) normen[f] = { conversie: n[f]?.conversie ?? null, doorlooptijd: n[f]?.doorlooptijd ?? null } }, { immediate: true })
async function bewaar() {
  try { await $fetch('/api/settings/funnelNormen', { method: 'PUT', body: { value: normen } }); toast.toon('Normen bewaard.') } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
function standaard() { for (const f of FUNNEL_FASES.slice(0, -1)) normen[f] = { conversie: NORMEN_STANDAARD[f]?.conversie ?? null, doorlooptijd: NORMEN_STANDAARD[f]?.doorlooptijd ?? null } }
const volgende = (f: FunnelFase) => FUNNEL_LABEL[FUNNEL_FASES[FUNNEL_FASES.indexOf(f) + 1]!]
useHead({ title: 'Normen per fase · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="instellingen.funnelNormen" />
    <template v-else>
      <PaginaKop kicker="Instellingen · Verkoop" titel="Normen per fase" uitleg="Welk deel van de accounts door moet naar de volgende fase, en hoe lang ze er gemiddeld mogen staan. Leeg is geen norm." helpartikel="funnel" />
      <section class="section">
        <div class="container container--smal">
          <form class="kaart" data-test="normen" @submit.prevent="bewaar">
            <div v-for="f in FUNNEL_FASES.slice(0, -1)" :key="f" class="formulier-raster">
              <label class="veld"><span class="veld-label">{{ FUNNEL_LABEL[f] }} naar {{ volgende(f) }} (procent)</span><input v-model.number="normen[f]!.conversie" type="number" min="0" max="100" class="invoer" :data-test="`norm-${f}`"></label>
              <label class="veld"><span class="veld-label">Doorlooptijd (dagen)</span><input v-model.number="normen[f]!.doorlooptijd" type="number" min="0" class="invoer"></label>
            </div>
            <div class="dd-acties mt-16"><button type="button" class="dd-actie dd-actie--secundair" @click="standaard">Standaard</button><button type="submit" class="dd-actie dd-actie--primair" data-test="normen-bewaar">Bewaar</button></div>
          </form>
        </div>
      </section>
    </template>
  </div>
</template>
