<script setup lang="ts">
// De metaregel bij een item in de tabbladen van de accountkaart en de contactkaart, overal in dezelfde opmaak:
// "Jorien Testkolk · door Eva Ervaren · 14 okt". De contactnaam is een link naar de contactkaart; de gebruiker
// is wie het deed of de eigenaar. Ontbreekt een deel, dan valt het weg zonder losse scheidingstekens.
const props = defineProps<{
  contact?: { id: string; naam: string } | null
  /** Naam van de gebruiker die het deed of de eigenaar is. */
  door?: string | null
  /** De datum, al opgemaakt. */
  datum?: string | null
  /** Datum in rood (achterstallige taak). */
  datumRood?: boolean
  /** In een rij in plaats van rechts in de kop van een kaart. */
  los?: boolean
}>()
const delen = computed(() => [props.contact ? 'contact' : null, props.door ? 'door' : null, props.datum ? 'datum' : null].filter(Boolean) as ('contact' | 'door' | 'datum')[])
</script>

<template>
  <span v-if="delen.length" class="item-meta" :class="{ 'item-meta--los': los }" data-test="item-meta">
    <span v-for="(d, i) in delen" :key="d" class="item-meta-deel">
      <span v-if="i" class="item-meta-punt" aria-hidden="true">·</span>
      <NuxtLink v-if="d === 'contact'" :to="`/contacten/${contact!.id}`" class="item-meta-contact" data-test="tl-contact"><Icoon naam="CircleUser" :grootte="12" />{{ contact!.naam }}</NuxtLink>
      <span v-else-if="d === 'door'" class="item-meta-door" data-test="tl-door">door {{ door }}</span>
      <span v-else class="item-meta-datum tnum" :class="{ 'item-meta-datum--rood': datumRood }">{{ datum }}</span>
    </span>
  </span>
</template>

<style scoped>
.item-meta { position: relative; z-index: 1; display: inline-flex; flex-wrap: wrap; align-items: center; gap: 2px 6px; margin-left: auto; font-size: 12px; color: var(--muted); }
.item-meta--los { margin-left: 0; }
.item-meta-deel { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.item-meta-punt { color: var(--muted-light, var(--muted)); }
.item-meta-contact { display: inline-flex; align-items: center; gap: 4px; min-height: 24px; font-weight: 700; color: var(--ink); text-decoration: none; border-bottom: 1px solid var(--yellow); }
.item-meta-contact:hover { color: var(--ink-soft); border-bottom-color: var(--ink); }
.item-meta-door { color: var(--ink-soft); }
.item-meta-datum { white-space: nowrap; }
.item-meta-datum--rood { font-weight: 700; color: var(--red); }

@media (max-width: 719px) {
  .item-meta { margin-left: 0; width: 100%; }
  .item-meta { column-gap: 6px; row-gap: 0; }
  .item-meta-contact { min-height: 44px; border-bottom: 0; text-decoration: underline; text-decoration-color: var(--yellow); text-decoration-thickness: 1px; text-underline-offset: 3px; }
}
</style>
