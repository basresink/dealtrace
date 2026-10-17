<script setup lang="ts">
// Het zwarte cijferblok van DealDrive (SalesIntelligenceStats): kicker, kop als zin, cursieve duiding en
// een raster van tegels (RapportTegel) in de slot. Twee kolommen op de telefoon, vier vanaf 700 px.
defineProps<{ kicker: string; titel: string; duiding?: string | null; link?: { naar: string; tekst: string } | null }>()
</script>

<template>
  <section class="rc" aria-labelledby="rc-titel">
    <header class="rc-head">
      <div class="rc-head-tekst">
        <span class="rc-kicker">{{ kicker }}</span>
        <h2 id="rc-titel" class="rc-titel" data-test="cijfers-titel">{{ titel }}</h2>
        <p v-if="duiding" class="rc-duiding">{{ duiding }}</p>
      </div>
      <FunctieLink v-if="link" :to="link.naar" class="rc-link">{{ link.tekst }}</FunctieLink>
    </header>
    <div class="rc-raster" data-test="cijfers-raster">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.rc { background: var(--ink); color: var(--wit); padding: var(--kaart-padding); border-radius: var(--radius); }
.rc-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
.rc-head-tekst { display: flex; flex-direction: column; gap: 8px; max-width: 760px; min-width: 0; }
.rc-kicker { font-size: var(--fs-label); font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--yellow); }
.rc-titel { margin: 0; font-family: var(--font-serif); font-size: clamp(20px, 2.5vw, 28px); font-weight: 700; line-height: 1.2; color: var(--wit); }
.rc-duiding { margin: 0; font-size: 13px; line-height: 1.55; font-style: italic; color: rgba(255, 255, 255, 0.78); }
.rc-link { flex-shrink: 0; display: inline-flex; align-items: center; min-height: var(--touch-target-min); font-size: 12px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: var(--yellow); text-decoration: none; white-space: nowrap; }
.rc-link:hover { color: var(--wit); }
.rc-link:focus-visible { outline: 2px solid var(--yellow); outline-offset: 2px; }
.rc-raster { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--kaart-gap); }
@media (min-width: 700px) { .rc-raster { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
@media (max-width: 720px) { .rc { padding: 18px 16px; } .rc-head { flex-direction: column; gap: 4px; } }
</style>
