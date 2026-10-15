<script setup lang="ts">
// Paginakop per niveau (4.4): Beginner primaire knop, Hulp en een subtitel met
// één zin uitleg; Gevorderd plus werkbalk met Weergave en Filters; Expert plus
// Sortering, opgeslagen weergaven en Download, en de subtitel met de stand.
const props = defineProps<{
  kicker: string
  titel: string
  uitleg?: string
  stand?: string
  helpartikel?: string
  werkbalk?: boolean
}>()
const emit = defineEmits<{ werkbalk: [actie: 'weergave' | 'filters' | 'sortering' | 'opgeslagen' | 'download'] }>()
const { me } = useMe()
const niveau = computed(() => (me.value?.organisatie?.iedereenAlles ? 'expert' : me.value?.gebruiker.niveau ?? 'beginner'))
const subtitel = computed(() => (niveau.value === 'expert' && props.stand ? props.stand : props.uitleg))
</script>

<template>
  <section class="section">
    <div class="container">
      <div class="sec-head">
        <div>
          <span class="kicker kicker--streep">{{ kicker }}</span>
          <h1 class="title title--groot">{{ titel }}</h1>
          <p v-if="subtitel" class="subtitle subtitle--groot">{{ subtitel }}</p>
        </div>
        <div class="toolbar-buttons">
          <slot name="acties" />
          <template v-if="werkbalk && niveau !== 'beginner'">
            <button type="button" class="dd-actie dd-actie--secundair" @click="emit('werkbalk', 'weergave')">Weergave</button>
            <button type="button" class="dd-actie dd-actie--secundair" @click="emit('werkbalk', 'filters')"><Icoon naam="Filter" class="dd-actie-icoon" />Filters</button>
          </template>
          <template v-if="werkbalk && niveau === 'expert'">
            <button type="button" class="dd-actie dd-actie--secundair" @click="emit('werkbalk', 'sortering')">Sortering</button>
            <button type="button" class="dd-actie dd-actie--secundair" @click="emit('werkbalk', 'opgeslagen')">Opgeslagen weergaven</button>
            <button type="button" class="dd-actie dd-actie--secundair" @click="emit('werkbalk', 'download')">Download</button>
          </template>
          <NuxtLink class="dd-actie dd-actie--secundair" :to="helpartikel ? `/help/${helpartikel}` : '/help'"><Icoon naam="CircleHelp" class="dd-actie-icoon" />Hulp</NuxtLink>
        </div>
      </div>
    </div>
  </section>
</template>
