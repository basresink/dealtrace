<script setup lang="ts">
// Eén artikel als kaart in het helpcenter (opzet van DealDrive: gele rand links, serif titel,
// samenvatting en een link in kapitalen). Gelezen is een vinkje, geen teller (B19).
import { helpLink } from '~~/shared/help'
defineProps<{
  artikel: { slug: string; titel: string; samenvatting?: string; categorie?: string; gelezen?: boolean; verborgen?: boolean }
  /** Toon de categorie boven de titel (zoekresultaten, Voor jou). */
  metCategorie?: boolean
  nieuw?: boolean
}>()
</script>

<template>
  <NuxtLink :to="helpLink(artikel.slug)" class="hk" :class="{ 'hk--gelezen': artikel.gelezen }" :data-test="`help-kaart-${artikel.slug}`">
    <span v-if="metCategorie || nieuw || artikel.verborgen" class="hk-boven">
      <span v-if="nieuw" class="pil pil--geel">nieuw</span>
      <span v-if="artikel.verborgen" class="pil pil--grijs">verborgen</span>
      <span v-if="metCategorie && artikel.categorie" class="hk-categorie">{{ artikel.categorie }}</span>
    </span>
    <h3 class="hk-titel">{{ artikel.titel }}</h3>
    <p v-if="artikel.samenvatting" class="hk-tekst">{{ artikel.samenvatting }}</p>
    <span class="hk-voet">
      <span class="hk-cta">Lees het artikel</span>
      <span v-if="artikel.gelezen" class="hk-gelezen" data-test="gelezen-vinkje"><Icoon naam="CircleCheck" :grootte="14" />Gelezen</span>
    </span>
  </NuxtLink>
</template>

<style scoped>
.hk { display: flex; flex-direction: column; min-width: 0; padding: 18px 20px; background: var(--wit); border: 1px solid var(--border); border-left: 3px solid var(--yellow); color: var(--ink); text-decoration: none; transition: border-color var(--transition-fast); }
.hk:hover { border-color: var(--ink); border-left-color: var(--yellow); }
.hk:focus-visible { outline: 2px solid var(--yellow-dark); outline-offset: 2px; }
.hk--gelezen { border-left-color: var(--border-strong); }
.hk-boven { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
.hk-categorie { font-size: var(--fs-label); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.hk-titel { font-family: var(--font-serif); font-size: 17px; font-weight: 700; line-height: 1.3; margin: 0 0 6px; overflow-wrap: anywhere; }
.hk-tekst { margin: 0 0 12px; font-size: 13px; line-height: 1.55; color: var(--ink-soft); }
.hk-voet { margin-top: auto; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.hk-cta { font-size: 12px; font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase; border-bottom: 2px solid var(--yellow); padding-bottom: 1px; }
.hk-cta::after { content: ' \2192'; }
.hk-gelezen { display: inline-flex; align-items: center; gap: 4px; margin-left: auto; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--green); }
@media (max-width: 719px) { .hk { padding: 16px; min-height: var(--touch-target-min); } }
</style>
