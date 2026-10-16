<script setup lang="ts">
// Instellingen · Eigen agent-prompts (vanaf Plus): per slot een eigen laag boven de platformtekst, met Proefdraai.
const { functie } = useMe()
const aan = computed(() => !!functie('instellingen.prompts')?.beschikbaar)
const { data, refresh } = await useFetch<any>('/api/instellingen/prompts', { immediate: aan.value, default: () => ({ slots: [], kader: '' }) })
useHead({ title: 'Eigen agent-prompts · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="instellingen.prompts" />
    <template v-else>
      <PaginaKop kicker="Instellingen · Data en AI" titel="Eigen agent-prompts" uitleg="Een eigen laag per slot. Leeg betekent: de tekst van het platform. Het vaste kader blijft altijd gelden." helpartikel="abonnement-verbruik-ai-credits" />
      <section class="section section--laatste">
        <div class="container stapel">
          <p class="alleen-groot-melding kaart kaart--geel">Beter op een groot scherm.</p>
          <PromptEditor v-for="s in data.slots" :key="s.slot + (s.versies[0]?.versie ?? 0)" :slot="s" :kader="data.kader" :voorbeeld="s.platform" basis="/api/instellingen/prompts" @bewaard="refresh()" />
        </div>
      </section>
    </template>
  </div>
</template>
