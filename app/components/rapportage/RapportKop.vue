<script setup lang="ts">
// Paginakop van Mijn dashboard en de funnel: de standaard PaginaKop (kicker, kop als zin, subtitel; rechts
// zoeken, AI en hulp en daarna de knoppen) met Filters (teller en pijl) die de periodestrook opent.
defineProps<{ kicker: string; titel: string; subtitel?: string | null; filterAantal?: number; helpartikel?: string }>()
const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <div data-test="rapport-kop">
    <PaginaKop :helpartikel="helpartikel ?? null">
      <template #kicker><span class="kicker kicker--streep" data-test="rapport-kicker">{{ kicker }}</span></template>
      <template #titel><h1 class="title title--groot" data-test="rapport-titel">{{ titel }}</h1></template>
      <template #uitleg><p v-if="subtitel" class="subtitle subtitle--groot">{{ subtitel }}</p></template>
      <template #acties>
        <slot name="acties" />
        <button type="button" class="dd-actie dd-actie--secundair" :class="{ 'rk-filter--aan': open || filterAantal }" :aria-expanded="open" aria-controls="rapport-filters" data-test="rapport-filters-knop" @click="open = !open">
          <Icoon naam="SlidersHorizontal" class="dd-actie-icoon" />Filters<span v-if="filterAantal" class="rk-teller">{{ filterAantal }}</span><Icoon naam="ChevronDown" class="rk-pijl" :class="{ 'rk-pijl--open': open }" />
        </button>
      </template>
    </PaginaKop>
  </div>
</template>

<style scoped>
.rk-filter--aan { border-color: var(--ink); }
.rk-teller { padding: 0 6px; margin-left: 2px; font-size: 11px; font-weight: 800; background: var(--yellow); color: var(--ink); border-radius: 2px; }
.rk-pijl { width: 14px; height: 14px; margin-left: 2px; transition: transform 150ms ease-out; }
.rk-pijl--open { transform: rotate(180deg); }
</style>
