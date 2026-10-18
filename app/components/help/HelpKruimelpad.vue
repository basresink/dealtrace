<script setup lang="ts">
// Kruimelpad bovenaan elke pagina van het helpcenter, bijvoorbeeld "Helpcenter › Hoe werkt Dealtrace ›
// Bellen › De eerste 20 seconden". Elk niveau met een adres is een link; het laatste niveau is de pagina zelf
// (aria-current). Zo ga je terug, er staat geen terugknop meer rechtsboven. Op de telefoon 44 px per link.
defineProps<{ pad: { label: string; to?: string; test?: string }[] }>()
</script>

<template>
  <nav class="hkp" aria-label="Kruimelpad" data-test="help-kruimelpad">
    <ol class="hkp-lijst" role="list">
      <li v-for="(n, i) in pad" :key="i" class="hkp-niveau">
        <span v-if="i > 0" class="hkp-scheiding" aria-hidden="true">&rsaquo;</span>
        <!-- custom: een niveau hoger is nooit de huidige pagina, ook niet als alleen de query verschilt (zoekresultaten). -->
        <NuxtLink v-if="n.to && i < pad.length - 1" v-slot="{ href, navigate }" :to="n.to" custom>
          <a :href="href ?? undefined" class="hkp-link" :data-test="n.test ?? `kruimel-${i}`" @click="navigate">{{ n.label }}</a>
        </NuxtLink>
        <span v-else class="hkp-nu" aria-current="page" :data-test="n.test ?? `kruimel-${i}`">{{ n.label }}</span>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.hkp { margin: 0 0 6px; min-width: 0; }
.hkp-lijst { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 0 2px; }
.hkp-niveau { display: inline-flex; align-items: center; min-width: 0; max-width: 100%; }
.hkp-scheiding { padding: 0 6px; color: var(--muted-light); font-size: 14px; }
.hkp-link, .hkp-nu { display: inline-flex; align-items: center; min-height: 32px; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; overflow-wrap: anywhere; }
.hkp-link { color: var(--muted); text-decoration: none; border-bottom: 2px solid transparent; }
.hkp-link:hover { color: var(--ink); border-bottom-color: var(--yellow); }
.hkp-link:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
.hkp-nu { color: var(--ink); }
@media (max-width: 719px) {
  .hkp-link { min-height: var(--touch-target-min); }
  .hkp-nu { min-height: var(--touch-target-min); }
}
</style>
