<script setup lang="ts">
// Kop van een dagblok op Bezoeken en Meetings: de datum als link naar de agenda op die dag
// (/agenda?weergave=dag&datum=) en rechts de samenvatting (stops en duur, of het aantal meetings).
const props = defineProps<{ datum: string; meta: string }>()
const label = computed(() => new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${props.datum}T12:00:00Z`)))
</script>

<template>
  <header class="dbk">
    <NuxtLink :to="{ path: '/agenda', query: { weergave: 'dag', datum } }" class="dbk-datum" :aria-label="`Open de agenda op ${label}`" data-test="dagblok-datum">{{ label }}<Icoon naam="ArrowRight" :grootte="14" /></NuxtLink>
    <span class="tnum">{{ meta }}</span>
  </header>
</template>

<style scoped>
.dbk { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 4px 8px; padding: 10px 20px; border-bottom: 1px solid var(--border); font-size: var(--fs-label); font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.dbk-datum { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; color: var(--ink); text-decoration: none; border-bottom: 2px solid transparent; }
.dbk-datum:hover, .dbk-datum:focus-visible { border-bottom-color: var(--yellow); }
@media (max-width: 719px) { .dbk { padding: 6px 16px; } .dbk-datum { min-height: 44px; } }
</style>
