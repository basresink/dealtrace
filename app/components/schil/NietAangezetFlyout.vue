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

function opEscape(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) sluit()
}
onMounted(() => window.addEventListener('keydown', opEscape))
onBeforeUnmount(() => window.removeEventListener('keydown', opEscape))
</script>

<template>
  <Teleport to="body">
    <div v-if="f" class="fo-overlay" @click.self="sluit">
      <aside class="fo-panel fo-panel--smal fo-panel--schuif" role="dialog" aria-modal="true" aria-labelledby="na-titel" tabindex="-1" data-test="niet-aangezet-flyout">
        <header class="fo-head">
          <div class="fo-head-tekst">
            <span class="fo-kicker">{{ niveau }} · nog niet aangezet</span>
            <h2 id="na-titel" class="fo-titel">{{ f.naam }}</h2>
            <p class="fo-meta">Deze functie hoort bij {{ niveau }}.</p>
          </div>
          <button type="button" class="fo-sluit" aria-label="Sluiten" @click="sluit"><Icoon naam="X" /></button>
        </header>
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
        <footer class="fo-foot dd-acties">
          <NuxtLink class="dd-act dd-act--primair" :to="`/help/${f.helpartikel}`" @click="sluit"><Icoon naam="BookOpen" class="dd-act-icoon" />Lees hoe het werkt</NuxtLink>
          <span class="dd-acties-vul fo-foot-vul" />
          <button type="button" class="dd-act" @click="sluit">Sluiten</button>
        </footer>
      </aside>
    </div>
  </Teleport>
</template>
