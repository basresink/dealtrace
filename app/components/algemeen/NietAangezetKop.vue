<script setup lang="ts">
// Directe link naar een pagina die niet aanstaat: de paginakop met kicker
// "Nog niet aangezet" en dezelfde uitleg als de flyout; nooit een foutpagina (6.1).
import { functie } from '~~/shared/functies'
import { NIVEAU_LABEL, type Niveau } from '~~/shared/types'
const props = defineProps<{ sleutel: string }>()
const { functie: meFunctie } = useMe()
const f = computed(() => functie(props.sleutel))
const niveau = computed(() => {
  const n = meFunctie(props.sleutel)?.aanVanaf as Niveau | null | undefined
  return n ? NIVEAU_LABEL[n] : 'Gevorderd'
})
</script>

<template>
  <section v-if="f" class="section" data-test="niet-aangezet-pagina">
    <div class="container container--smal">
      <span class="kicker kicker--streep">Nog niet aangezet</span>
      <h1 class="title title--groot">{{ f.naam }}</h1>
      <p class="subtitle subtitle--groot">Deze functie hoort bij {{ niveau }}.</p>
      <div class="kaart mt-16">
        <h2 class="kop-kaart">Wat het doet</h2>
        <p class="tekst mt-8">{{ f.uitleg.watHetDoet }}</p>
        <h2 class="kop-kaart mt-16">Tot die tijd</h2>
        <p class="tekst mt-8">{{ f.uitleg.totDieTijd }}</p>
        <div class="dd-acties mt-16">
          <NuxtLink class="dd-act dd-act--primair" :to="`/helpcenter/${f.helpartikel}`"><Icoon naam="BookOpen" class="dd-act-icoon" />Lees hoe het werkt</NuxtLink>
        </div>
      </div>
    </div>
  </section>
</template>
