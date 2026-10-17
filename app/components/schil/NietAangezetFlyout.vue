<script setup lang="ts">
// Uitlegflyout (480 px) voor een functie die voor je niveau nog niet aanstaat (6.1).
// Geen criteria, geen voortgang en geen verzoekknop (B19).
import { functie } from '~~/shared/functies'
import { NIVEAU_LABEL, type Niveau } from '~~/shared/types'

const { open, sluit } = useNietAangezet()
const { functie: meFunctie } = useMe()

const f = computed(() => (open.value ? functie(open.value) : undefined))
const niveau = computed(() => {
  const n = open.value ? (meFunctie(open.value)?.aanVanaf as Niveau | null) : null
  return n ? NIVEAU_LABEL[n] : 'Gevorderd'
})

</script>

<template>
  <FlyoutShell v-if="f" open titel-id="na-titel" breedte="smal" data-test="niet-aangezet-flyout" @sluit="sluit">
      <template #kop>
            <span class="fo-kicker">{{ niveau }} · nog niet aangezet</span>
            <h2 id="na-titel" class="fo-titel">{{ f.naam }}</h2>
            <p class="fo-meta">Deze functie hoort bij {{ niveau }}.</p></template>
        <div class="fo-body">
          <article class="fo-blok">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Wat het doet</h3></header>
            <p class="fo-tekst">{{ f.uitleg.watHetDoet }}</p>
          </article>
          <article class="fo-blok fo-blok--accent">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Tot die tijd</h3></header>
            <p class="fo-tekst">{{ f.uitleg.totDieTijd }}</p>
          </article>
        </div>
      <template #voet>
        <footer class="fo-foot fs-voet">
          <NuxtLink class="dd-actie dd-actie--zwart fs-hoofdactie" :to="`/helpcenter/${f.helpartikel}`" @click="sluit"><Icoon naam="BookOpen" class="dd-act-icoon" />Lees hoe het werkt</NuxtLink>
          <span class="fo-foot-vul" />
        </footer>
      </template>
    </FlyoutShell>
</template>
