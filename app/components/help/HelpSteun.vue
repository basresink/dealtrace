<script setup lang="ts">
// "Verder zoeken" onderaan het helpcenter: de andere ingangen en contact met support (opzet van DealDrive).
const props = defineProps<{ zonder?: 'instructies' | 'academie' | 'ingangen' }>()
const { functie } = useMe()
const aiAan = computed(() => !!functie('assistent.chat')?.beschikbaar)
const { openen: openAi } = useAssistent()
</script>

<template>
  <section class="section section--laatste hs" data-test="help-verder">
    <div class="container">
      <h2 class="hs-titel">Verder zoeken</h2>
      <div class="hs-raster">
        <NuxtLink v-if="props.zonder !== 'instructies' && props.zonder !== 'ingangen'" to="/helpcenter/instructies" class="hs-kaart">
          <h3 class="hs-kaart-titel">Hoe werkt Dealtrace</h3>
          <p class="hs-kaart-tekst">Uitleg over elk scherm, per onderwerp. Je ziet alleen wat bij jouw rol hoort.</p>
          <span class="hs-cta">Open de instructies</span>
        </NuxtLink>
        <NuxtLink v-if="props.zonder !== 'academie' && props.zonder !== 'ingangen'" to="/helpcenter/academie" class="hs-kaart">
          <h3 class="hs-kaart-titel">New business-academie</h3>
          <p class="hs-kaart-tekst">Bellen, schrijven, bezwaren en op pad: zo doe je het, met voorbeelden en controlevragen.</p>
          <span class="hs-cta">Open de academie</span>
        </NuxtLink>
        <button v-if="aiAan" type="button" class="hs-kaart" data-test="help-steun-ai" @click="openAi({ label: 'Helpcenter', route: '/helpcenter', accountId: null })">
          <h3 class="hs-kaart-titel">Vraag de AI-assistent</h3>
          <p class="hs-kaart-tekst">Hij zoekt in het helpcenter en noemt het artikel erbij.</p>
          <span class="hs-cta">Stel je vraag</span>
        </button>
        <div class="hs-kaart hs-kaart--rustig">
          <h3 class="hs-kaart-titel">Contact met support</h3>
          <p class="hs-kaart-tekst">Kom je er niet uit? Mail naar <a href="mailto:support@dealtrace.test" class="hs-mail">support@dealtrace.test</a> of dien een wens in op de <NuxtLink to="/roadmap" class="hs-mail">roadmap</NuxtLink>.</p>
          <span class="hs-badge">Reactie binnen 1 werkdag</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hs { border-top: 1px solid var(--border); }
.hs-titel { font-family: var(--font-serif); font-size: 18px; font-weight: 700; color: var(--ink); margin: 0 0 14px; }
.hs-raster { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
@media (min-width: 700px) { .hs-raster { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 1200px) { .hs-raster { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.hs-kaart { display: flex; flex-direction: column; align-items: flex-start; min-width: 0; padding: 18px 20px; background: var(--wit); border: 1px solid var(--border); border-left: 3px solid var(--yellow); color: var(--ink); text-decoration: none; text-align: left; font: inherit; cursor: pointer; transition: border-color var(--transition-fast); }
.hs-kaart:hover { border-color: var(--ink); border-left-color: var(--yellow); }
.hs-kaart--rustig { border-left-color: var(--border-strong); cursor: default; }
.hs-kaart--rustig:hover { border-color: var(--border); border-left-color: var(--border-strong); }
.hs-kaart-titel { font-family: var(--font-serif); font-size: 17px; font-weight: 700; margin: 0 0 6px; }
.hs-kaart-tekst { margin: 0 0 10px; font-size: 13px; line-height: 1.55; color: var(--ink-soft); }
.hs-cta { margin-top: auto; font-size: 12px; font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase; border-bottom: 2px solid var(--yellow); padding-bottom: 1px; }
.hs-cta::after { content: ' \2192'; }
.hs-badge { margin-top: auto; display: inline-block; font-size: var(--fs-label); font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; padding: 3px 9px; background: var(--surface); color: var(--muted); border-radius: 2px; }
.hs-mail { color: var(--ink); font-weight: 600; border-bottom: 2px solid var(--yellow); text-decoration: none; }
.hs-mail:hover { color: var(--yellow-dark); }
@media (max-width: 719px) { .hs-kaart { padding: 16px; } }
</style>
