<script setup lang="ts">
// De categorieën van het helpcenter als filter-pillen onder de kop van elke helpcenterpagina: snel naar een
// categorie, de huidige staat aan. De categorieën van de collectie waar je bent staan vooraan. Past het niet
// op een regel (meer dan zes, op de telefoon meer dan drie), dan staan de eerste er en klapt "Meer
// categorieën" de rest uit. De huidige categorie staat er altijd. Geen horizontale scroll.
// Je ziet alleen categorieën met artikelen die de server voor jouw rol teruggeeft.
import { COLLECTIES, type HelpCollectie, categorieLink } from '~~/shared/help'
const props = defineProps<{ actief?: string; collectie?: HelpCollectie }>()
const ZICHTBAAR = 6
const ZICHTBAAR_TELEFOON = 3
const { data } = await useFetch<any>('/api/help', { key: 'help-categorieen', default: () => ({ artikelen: [] }) })
const categorieen = computed(() => {
  const volgorde = (Object.keys(COLLECTIES) as HelpCollectie[]).sort((a, b) => Number(b === props.collectie) - Number(a === props.collectie))
  const metArtikelen = new Set<string>((data.value?.artikelen ?? []).map((a: any) => `${a.collectie}|${a.categorie}`))
  return volgorde.flatMap((c) => COLLECTIES[c].categorieen.filter((n) => n === props.actief || metArtikelen.has(`${c}|${n}`)))
})
const open = ref(false)
const id = useId()
</script>

<template>
  <nav v-if="categorieen.length" class="hcc" :class="{ 'hcc--open': open }" aria-label="Categorieën" data-test="help-categorieen">
    <ul :id="id" class="hcc-lijst" role="list">
      <li v-for="(n, i) in categorieen" :key="n" class="hcc-item" :class="{ 'hcc-item--rest': i >= ZICHTBAAR && n !== actief, 'hcc-item--rest-telefoon': i >= ZICHTBAAR_TELEFOON && i < ZICHTBAAR && n !== actief }">
        <NuxtLink :to="categorieLink(n)" class="filter-pil hcc-pil" :class="{ 'filter-pil--aan': n === actief }" :aria-current="n === actief ? 'page' : undefined" :data-test="`hc-cat-${n}`">{{ n }}</NuxtLink>
      </li>
      <li v-if="categorieen.length > ZICHTBAAR_TELEFOON" class="hcc-item" :class="{ 'hcc-item--meer-telefoon': categorieen.length <= ZICHTBAAR }">
        <button type="button" class="hcc-meer" :aria-expanded="open" :aria-controls="id" data-test="hc-cat-meer" @click="open = !open">
          {{ open ? 'Minder categorieën' : 'Meer categorieën' }}<Icoon :naam="open ? 'ChevronUp' : 'ChevronDown'" :grootte="14" />
        </button>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.hcc { margin-top: 14px; min-width: 0; }
.hcc-lijst { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.hcc-item { display: flex; min-width: 0; max-width: 100%; }
.hcc-pil { display: inline-flex; align-items: center; text-decoration: none; max-width: 100%; overflow-wrap: anywhere; }
.hcc-item--rest, .hcc-item--meer-telefoon { display: none; }
.hcc--open .hcc-item--rest { display: flex; }
.hcc-meer { display: inline-flex; align-items: center; gap: 4px; min-height: var(--knop-h-rij); padding: 0 6px; background: none; border: 0; border-bottom: 2px solid var(--yellow); font: inherit; font-size: 12px; font-weight: 700; color: var(--ink); cursor: pointer; }
.hcc-meer:hover { color: var(--yellow-dark); }
.hcc-meer:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
@media (max-width: 719px) {
  .hcc-item--rest-telefoon { display: none; }
  .hcc--open .hcc-item--rest-telefoon { display: flex; }
  .hcc-item--meer-telefoon { display: flex; }
  .hcc-meer { min-height: var(--touch-target-min); }
}
</style>
