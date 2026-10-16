<script setup lang="ts">
// Een groep in het helpcenter: een kop met een zwarte streep erboven (opzet van DealDrive) en
// daaronder een raster van kaarten (1 kolom op de telefoon, 2 op een tablet, 3 op een breed scherm).
defineProps<{ titel: string; uitleg?: string; link?: string; linkTekst?: string }>()
</script>

<template>
  <section class="hg">
    <header class="hg-kop">
      <div class="hg-tekst">
        <h2 class="hg-titel">{{ titel }}</h2>
        <p v-if="uitleg" class="hg-uitleg">{{ uitleg }}</p>
      </div>
      <NuxtLink v-if="link" :to="link" class="hg-link">{{ linkTekst ?? 'Bekijk alles' }}</NuxtLink>
    </header>
    <div class="hg-raster"><slot /></div>
  </section>
</template>

<style scoped>
.hg { margin-bottom: 32px; }
.hg:last-child { margin-bottom: 0; }
.hg-kop { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; border-top: 2px solid var(--ink); padding-top: 10px; margin-bottom: 14px; }
.hg-tekst { min-width: 0; }
.hg-titel { font-family: var(--font-sans); font-size: 12px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink); margin: 0; }
.hg-uitleg { margin: 4px 0 0; font-size: 13px; line-height: 1.5; color: var(--muted); max-width: 68ch; }
.hg-link { flex-shrink: 0; display: inline-flex; align-items: center; min-height: var(--touch-target-min); font-size: 12px; font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase; color: var(--ink); text-decoration: none; }
.hg-link:hover { color: var(--yellow-dark); }
.hg-link::after { content: ' \2192'; white-space: pre; }
.hg-raster { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
@media (min-width: 700px) { .hg-raster { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 1200px) { .hg-raster { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 599px) { .hg-kop { flex-direction: column; align-items: flex-start; gap: 4px; } }
</style>
