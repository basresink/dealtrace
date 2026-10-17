<script setup lang="ts">
// Instellingen · Eigen agent-prompts (vanaf Plus): per slot een eigen laag boven de platformtekst, met Proefdraai.
const { functie } = useMe()
const aan = computed(() => !!functie('instellingen.prompts')?.beschikbaar)
const { data, refresh } = await useFetch<any>('/api/instellingen/prompts', { immediate: aan.value, default: () => ({ slots: [], kader: '' }) })
const eigen = computed(() => data.value.slots.filter((s: any) => s.versies?.length && s.versies[0]?.tekst?.trim()).length)
const titel = computed(() => (data.value.slots.length ? `${eigen.value} van ${data.value.slots.length} slots met een eigen laag` : 'Eigen agent-prompts'))
useHead({ title: 'Eigen agent-prompts · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="instellingen.prompts" />
    <template v-else>
      <InstellingenKop groep="Data en AI" :titel="titel" uitleg="Eigen agent-prompts: per slot lees je de prompt die nu geldt en schrijf je er een eigen laag boven. Leeg betekent: de tekst van het platform of de standaard uit de code. Het vaste kader blijft altijd gelden." helpartikel="abonnement-verbruik-ai-credits" />
      <section class="section section--laatste">
        <div class="container stapel">
          <p class="alleen-groot-melding kaart kaart--geel">Beter op een groot scherm.</p>
          <LegeStaat v-if="!data.slots.length" kicker="Agent-prompts" titel="Er zijn nog geen slots." tekst="Zodra Dealtrace een agent met een eigen laag aanbiedt, staat hij hier." />
          <PromptEditor v-for="s in data.slots" :key="s.slot + (s.versies[0]?.versie ?? 0)" :slot="s" :kader="data.kader" :voorbeeld="s.platform" basis="/api/instellingen/prompts" @bewaard="refresh()" />
        </div>
      </section>
    </template>
  </div>
</template>
