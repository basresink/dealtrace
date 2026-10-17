<script setup lang="ts">
// Een categorie op de start van het helpcenter: kop (link naar de categorie), korte uitleg en de eerste
// zes artikelen als lijst. Zijn er meer, dan staat onderaan "Toon alle" met het aantal.
import { CATEGORIE_UITLEG, categorieLink, helpLink } from '~~/shared/help'
const props = defineProps<{
  naam: string
  artikelen: { id: string; slug: string; titel: string; gelezen?: boolean }[]
  kicker?: string
  soort?: 'artikelen' | 'tips'
}>()
const MAX = 6
const zichtbaar = computed(() => props.artikelen.slice(0, MAX))
const meer = computed(() => props.artikelen.length > MAX)
const woord = computed(() => (props.soort === 'tips' ? 'tips' : 'artikelen'))
</script>

<template>
  <article class="hc-categorie hcb" :data-test="`categorie-blok-${naam}`">
    <span v-if="kicker" class="hcb-kicker">{{ kicker }}</span>
    <h3 class="hcb-titel"><NuxtLink :to="categorieLink(naam)" class="hcb-titel-link" :data-test="`categorie-${naam}`">{{ naam }}</NuxtLink></h3>
    <p v-if="CATEGORIE_UITLEG[naam]" class="hcb-tekst">{{ CATEGORIE_UITLEG[naam] }}</p>
    <ul class="hcb-lijst" role="list" :data-test="`categorie-lijst-${naam}`">
      <li v-for="a in zichtbaar" :key="a.id">
        <NuxtLink :to="helpLink(a.slug)" class="hcb-link">{{ a.titel }}</NuxtLink>
        <Icoon v-if="a.gelezen" naam="CircleCheck" class="hcb-vinkje" :grootte="16" aria-label="Gelezen" />
      </li>
    </ul>
    <NuxtLink v-if="meer" :to="categorieLink(naam)" class="hcb-alle" :data-test="`categorie-alle-${naam}`">Toon alle {{ artikelen.length }} {{ woord }}</NuxtLink>
  </article>
</template>

<style scoped>
.hcb { display: flex; flex-direction: column; min-width: 0; padding: 18px 20px; background: var(--wit); border: 1px solid var(--border); border-left: 3px solid var(--yellow); color: var(--ink); }
.hcb-kicker { font-size: var(--fs-label); font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); margin: 0 0 4px; }
.hcb-titel { font-family: var(--font-serif); font-size: 17px; font-weight: 700; margin: 0 0 4px; }
.hcb-titel-link { display: inline-flex; align-items: center; min-height: 32px; color: var(--ink); text-decoration: none; }
.hcb-titel-link::after { content: ' \2192'; white-space: pre; color: var(--muted); }
.hcb-titel-link:hover { text-decoration: underline; text-decoration-color: var(--yellow); text-underline-offset: 3px; }
.hcb-tekst { margin: 0 0 8px; font-size: 13px; line-height: 1.55; color: var(--ink-soft); }
.hcb-lijst { list-style: none; margin: 0 0 4px; padding: 0; }
.hcb-lijst li { display: flex; align-items: center; gap: 8px; border-top: 1px solid var(--border); }
.hcb-link { flex: 1; min-width: 0; display: flex; align-items: center; min-height: 40px; padding: 6px 0; font-size: 13px; font-weight: 600; line-height: 1.4; color: var(--ink); text-decoration: none; overflow-wrap: anywhere; }
.hcb-link:hover { text-decoration: underline; text-decoration-color: var(--yellow); text-underline-offset: 3px; }
.hcb-vinkje { color: var(--green); flex-shrink: 0; }
.hcb-alle { margin-top: auto; align-self: flex-start; display: inline-flex; align-items: center; min-height: var(--touch-target-min); font-size: 12px; font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase; color: var(--ink); text-decoration: none; }
.hcb-alle::after { content: ' \2192'; white-space: pre; }
.hcb-alle:hover { color: var(--yellow-dark); }
@media (max-width: 719px) {
  .hcb { padding: 16px; }
  .hcb-link, .hcb-titel-link { min-height: var(--touch-target-min); }
}
</style>
