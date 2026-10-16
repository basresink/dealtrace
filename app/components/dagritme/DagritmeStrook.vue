<script setup lang="ts">
// Het dagritme op Vandaag: de vorm van het moment (shared/dagritme.ts bepaalVorm) kiest de hoofdkaart.
// Maandag de weekstart, vrijdag vanaf 15:00 de weekreview, anders de dagstart. De andere twee staan
// ernaast als link. Alleen wat voor je aanstaat.
import type { Vorm } from '~~/shared/dagritme'
const props = defineProps<{ vorm: Vorm | null | undefined }>()
const { functie } = useMe()
const KAARTEN = [
  { vorm: 'dagstart', sleutel: 'dagritme.dagstart', route: '/dagstart', naam: 'Dagstart', icoon: 'Sunrise', kicker: 'Dagstart', titel: 'Je dag staat klaar.', tekst: 'Afspraken vast, bezoeken op route en belblokken op het uur waarop je doelgroep opneemt.', knop: 'Bekijk je dag' },
  { vorm: 'weekstart', sleutel: 'dagritme.weekstart', route: '/weekstart', naam: 'Weekstart', icoon: 'CalendarRange', kicker: 'Weekstart', titel: 'Je weekplan staat klaar.', tekst: 'Afspraken, belblokken, je voornemens van vrijdag en je tempo tegen je doel.', knop: 'Bekijk je week' },
  { vorm: 'weekafsluiting', sleutel: 'dagritme.weekreview', route: '/weekreview', naam: 'Weekreview', icoon: 'NotebookPen', kicker: 'Vrijdag', titel: 'Je weekreview staat klaar.', tekst: 'Wat bewoog, wat werkte, wat bleef liggen en drie voornemens. Vijf minuten.', knop: 'Begin' },
] as const
const zichtbaar = computed(() => KAARTEN.filter((k) => functie(k.sleutel)?.beschikbaar))
const hoofd = computed(() => zichtbaar.value.find((k) => k.vorm === (props.vorm ?? 'dagstart')) ?? zichtbaar.value[0] ?? null)
const rest = computed(() => zichtbaar.value.filter((k) => k !== hoofd.value))
</script>

<template>
  <section v-if="hoofd" class="section dr-sectie">
    <div class="container">
      <div class="dr" data-test="dagritme-strook">
        <NuxtLink :to="hoofd.route" class="dr-hoofd" :data-test="`dagritme-${hoofd.vorm}`">
          <span class="dr-ico"><Icoon :naam="hoofd.icoon" :grootte="20" /></span>
          <span class="dr-tekst"><span class="dr-kicker">{{ hoofd.kicker }}</span><b class="dr-titel">{{ hoofd.titel }}</b><span class="dr-uitleg">{{ hoofd.tekst }}</span></span>
          <span class="dd-actie dd-actie--primair dr-knop">{{ hoofd.knop }}</span>
        </NuxtLink>
        <nav v-if="rest.length" class="dr-rest" aria-label="Je ritme">
          <NuxtLink v-for="k in rest" :key="k.route" :to="k.route" class="dr-link" :data-test="`dagritme-link-${k.vorm}`"><Icoon :naam="k.icoon" :grootte="16" />{{ k.naam }}</NuxtLink>
        </nav>
      </div>
    </div>
  </section>
</template>

<style scoped>
.dr-sectie { padding-top: 0; padding-bottom: 0; }
.dr { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: stretch; }
.dr-hoofd { display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; gap: 14px; align-items: center; padding: 16px 20px; background: var(--ink); color: var(--wit); text-decoration: none; min-width: 0; }
.dr-ico { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; background: var(--yellow); color: var(--ink); }
.dr-tekst { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.dr-kicker { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--yellow); }
.dr-titel { font-family: var(--font-serif); font-size: 18px; line-height: 1.25; }
.dr-uitleg { font-size: 13px; color: var(--muted-light, var(--border)); line-height: 1.45; }
.dr-knop { pointer-events: none; }
.dr-rest { display: flex; flex-direction: column; justify-content: center; gap: 6px; }
.dr-link { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 14px; border: 1px solid var(--border-strong); background: var(--wit); color: var(--ink); font-size: 13px; font-weight: 700; text-decoration: none; }
.dr-link:hover, .dr-link:focus-visible { border-color: var(--ink); }
@media (max-width: 719px) {
  .dr { grid-template-columns: minmax(0, 1fr); }
  .dr-hoofd { grid-template-columns: 40px minmax(0, 1fr); padding: 16px; }
  .dr-knop { grid-column: 1 / -1; justify-self: start; }
  .dr-rest { flex-direction: row; flex-wrap: wrap; }
  .dr-link { flex: 1 1 140px; justify-content: center; }
}
</style>
