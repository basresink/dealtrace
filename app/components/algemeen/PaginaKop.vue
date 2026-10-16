<script setup lang="ts">
// Paginakop (4.4) op elke pagina: links in een eigen kolom de kicker, de titel en de uitleg, rechts
// op de hoogte van de titel de knoppenrij. Die begint altijd met drie icoonknoppen (zoeken, AI en
// hulp, zie KopIconen) en daarna de knoppen van de pagina. De uitleg loopt nooit onder de knoppen
// door; op de telefoon staan de knoppen onder de tekst. De weergavekeuze staat in het filterpaneel
// van de pagina, niet in de kop. Gevorderd en Expert krijgen met `werkbalk` Filters en de rest.
const props = defineProps<{
  kicker?: string
  titel?: string
  uitleg?: string
  stand?: string
  helpartikel?: string | null
  werkbalk?: boolean
  /** Kleur van de kicker en zijn streep (standaard geel). */
  accent?: 'paars'
  /** Context voor de AI-chat (bijvoorbeeld het account van de pagina). */
  ai?: { accountId?: string | null; label?: string; route?: string }
  /** Eigen zoekactie van de pagina in plaats van het zoekvenster van de app (zie KopIconen). */
  zoeken?: { actie: () => void; aan?: boolean; label?: string; test?: string; controls?: string }
}>()
const emit = defineEmits<{ werkbalk: [actie: 'weergave' | 'filters' | 'sortering' | 'opgeslagen' | 'download'] }>()
const { me } = useMe()
const niveau = computed(() => (me.value?.organisatie?.iedereenAlles ? 'expert' : me.value?.gebruiker.niveau ?? 'beginner'))
const subtitel = computed(() => (niveau.value === 'expert' && props.stand ? props.stand : props.uitleg))
</script>

<template>
  <section class="section">
    <div class="container">
      <div class="sec-head sec-head--naast" data-test="paginakop">
        <div class="sec-head-tekst" data-test="kop-tekst">
          <slot name="kicker"><span class="kicker kicker--streep" :class="{ 'kicker--paars': accent === 'paars' }">{{ kicker }}</span></slot>
          <slot name="titel"><h1 class="title title--groot">{{ titel }}</h1></slot>
          <slot name="uitleg"><p v-if="subtitel" class="subtitle subtitle--groot">{{ subtitel }}</p></slot>
          <slot name="onder" />
        </div>
        <div class="toolbar-buttons" data-test="kop-knoppen">
          <KopIconen :artikel="helpartikel" :ai="ai" :zoeken="zoeken" />
          <slot name="acties" />
          <template v-if="werkbalk && niveau !== 'beginner'">
            <button type="button" class="dd-actie dd-actie--secundair" @click="emit('werkbalk', 'filters')"><Icoon naam="Filter" class="dd-actie-icoon" />Filters</button>
          </template>
          <template v-if="werkbalk && niveau === 'expert'">
            <button type="button" class="dd-actie dd-actie--secundair" @click="emit('werkbalk', 'sortering')">Sortering</button>
            <button type="button" class="dd-actie dd-actie--secundair" @click="emit('werkbalk', 'opgeslagen')">Opgeslagen weergaven</button>
            <button type="button" class="dd-actie dd-actie--secundair" @click="emit('werkbalk', 'download')">Download</button>
          </template>
        </div>
      </div>
      <slot name="na" />
    </div>
  </section>
</template>
