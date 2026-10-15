<script setup lang="ts">
// Campagnesoorten (F22, Verkoop, beheerder): aan of uit. De acht startsoorten staan standaard aan.
const { functie } = useMe()
const aan = computed(() => !!functie('instellingen.campagnesoorten')?.beschikbaar)
const toast = useToast()
const { data, refresh } = await useFetch<any>('/api/campagnes/soorten', { immediate: aan.value, default: () => ({ soorten: [] }) })
async function zet(s: any, actief: boolean) {
  try { await $fetch('/api/campagnes/soorten', { method: 'PUT', body: { id: s.id, actief } }); toast.toon(`${s.naam} staat ${actief ? 'aan' : 'uit'}.`); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
useHead({ title: 'Campagnesoorten · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="instellingen.campagnesoorten" />
    <template v-else>
      <PaginaKop kicker="Instellingen · Verkoop" titel="Campagnesoorten" uitleg="Een soort die uit staat, kan niemand meer kiezen. Lopende campagnes van die soort lopen door." helpartikel="een-campagne-opzetten" />
      <section class="section">
        <div class="container">
          <div class="lijst" data-test="cs-lijst">
            <div v-for="s in data.soorten" :key="s.id" class="rij rij--compact" :class="{ 'rij--uit': !s.actief }">
              <div class="rij-info">
                <h3 class="rij-titel">{{ s.naam }} <span v-if="s.startsoort" class="pil pil--leeg">startsoort</span></h3>
                <div class="rij-sub">{{ s.groep }} · {{ s.kanalen.join(', ') }} · {{ s.pogingen }} pogingen in {{ s.weken }} weken · {{ s.uitvoerder }}</div>
              </div>
              <Schakelaar :aan="s.actief" :label="`${s.naam} aan`" :data-test="`cs-${s.sleutel}`" @wissel="(v: boolean) => zet(s, v)" />
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
