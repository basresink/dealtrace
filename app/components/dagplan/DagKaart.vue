<script setup lang="ts">
// Kaart voor Bezoeken en Meetings (belprioriteit, te plannen bezoeken, meetings): wit vlak met rand, de
// titel is een knop of link die de hele kaart klikbaar maakt (::after), andere links en knoppen op de kaart
// liggen erboven (.dp-kaart-link, .dp-kaart-acties). Zo blijft elke actie een echte knop of link.
withDefaults(defineProps<{ tag?: string }>(), { tag: 'article' })
</script>

<template>
  <component :is="tag" class="dp-kaart"><slot /></component>
</template>

<style>
.dp-kaart { position: relative; display: flex; flex-direction: column; gap: 6px; min-width: 0; padding: 16px 18px; background: var(--wit); border: 1px solid var(--border); border-radius: var(--radius); transition: border-color var(--transition-fast); }
.dp-kaart:hover, .dp-kaart:focus-within { border-color: var(--ink); }
.dp-kaart-kop { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
.dp-kaart-titel { padding: 0; background: none; border: 0; font: inherit; font-family: var(--font-serif); font-size: 16px; font-weight: 700; line-height: 1.3; color: var(--ink); text-align: left; text-decoration: none; cursor: pointer; overflow-wrap: anywhere; }
.dp-kaart-titel::after { content: ''; position: absolute; inset: 0; }
.dp-kaart-titel:focus-visible { outline: none; }
.dp-kaart:has(.dp-kaart-titel:focus-visible) { outline: 2px solid var(--ink); outline-offset: 2px; }
.dp-kaart-tekst { margin: 0; font-size: var(--fs-meta); line-height: 1.5; color: var(--ink-soft); }
.dp-kaart-pillen { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }
.dp-kaart-link, .dp-kaart-acties { position: relative; z-index: 1; }
.dp-kaart-link { color: var(--ink); }
.dp-kaart-acties { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
@media (max-width: 719px) {
  .dp-kaart { padding: 14px 16px; }
  .dp-kaart-titel { min-height: 44px; display: inline-flex; align-items: center; }
  .dp-kaart-acties .dd-act { min-height: 44px; }
  .dp-kaart-link { display: inline-flex; align-items: center; min-height: 44px; }
}
</style>
