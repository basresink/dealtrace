<script setup lang="ts">
// De regel boven een lijst op de managerpagina's: het aantal met zijn eenheid, de chips van de actieve
// filters (elk met een kruisje) en Wis alles. Zelfde opzet als op Briefings.
export interface FilterChip { sleutel: string; label: string; tekst: string; wis: () => void }
defineProps<{ aantal: number; een: string; meer: string; chips: FilterChip[]; test: string }>()
const emit = defineEmits<{ wis: [] }>()
</script>

<template>
  <div class="fc" aria-live="polite" :data-test="`${test}-resultaat`">
    <span class="fc-tel tnum" :data-test="`${test}-aantal`">{{ aantal }} <small>{{ aantal === 1 ? een : meer }}</small></span>
    <span v-for="c in chips" :key="c.sleutel" class="fc-chip" :data-test="`${test}-chip-${c.sleutel}`"><span><em>{{ c.label }}:</em> {{ c.tekst }}</span><button type="button" :aria-label="`Wis ${c.label} ${c.tekst}`" @click="c.wis()"><Icoon naam="X" :grootte="14" /></button></span>
    <button v-if="chips.length" type="button" class="dd-tekstknop fc-wis" :data-test="`${test}-chips-wis`" @click="emit('wis')">Wis alles</button>
    <slot />
  </div>
</template>

<style scoped>
.fc { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 4px; }
.fc-tel { margin-right: 4px; font-family: var(--font-serif); font-size: 22px; font-weight: 700; }
.fc-tel small { font-family: var(--font-sans); font-size: 13px; font-weight: 600; color: var(--muted); }
.fc-chip { display: inline-flex; align-items: center; gap: 4px; min-height: 32px; padding: 0 2px 0 10px; background: var(--wit); border: 1px solid var(--border-strong); border-radius: var(--radius); font-size: 12px; font-weight: 600; }
.fc-chip em { font-style: normal; color: var(--muted); }
.fc-chip button { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; padding: 0; background: none; border: 0; color: var(--muted); cursor: pointer; }
.fc-chip button:hover { color: var(--ink); }
@media (max-width: 719px) {
  .fc-chip { min-height: var(--touch-target-min); }
  .fc-chip button { width: var(--touch-target-min); height: var(--touch-target-min); }
  .fc-wis { min-height: var(--touch-target-min); }
}
</style>
