<script setup lang="ts">
// Steun bij het dagritme (Dagstart, Weekstart, Weekreview): links Tips en tricks, rechts drie artikelen uit
// de New business academie, gekozen bij het moment, je werkplek en wat je die dag of week deed
// (shared/ritmeSteun.ts). Elk artikel zegt waarom het er staat en opent in het helpcenter.
import type { RitmeMoment, RitmeSteun } from '~~/shared/ritmeSteun'

const props = defineProps<{ steun: RitmeSteun | null | undefined; moment: RitmeMoment }>()
const KOP: Record<RitmeMoment, string> = { dagstart: 'Drie artikelen voor vandaag', weekstart: 'Drie artikelen voor deze week', weekreview: 'Drie artikelen om van te leren' }
const LEDE: Record<RitmeMoment, string> = {
  dagstart: 'Kleine dingen die je dag beter maken.',
  weekstart: 'Zo haal je meer uit je week.',
  weekreview: 'Wat je volgende week anders kunt doen.',
}
const Link = resolveComponent('NuxtLink')
const tips = computed(() => props.steun?.tips ?? [])
const artikelen = computed(() => props.steun?.artikelen ?? [])
</script>

<template>
  <div v-if="tips.length || artikelen.length" class="rs" :data-test="`steun-${moment}`">
    <article class="kaart rs-blok" data-test="steun-tips">
      <header class="kaart-kop rs-kop"><h2 class="kaart-titel">Tips en tricks</h2><span class="meta">{{ LEDE[moment] }}</span></header>
      <ul class="rs-lijst">
        <li v-for="t in tips" :key="t.sleutel">
          <component :is="t.href ? Link : 'div'" :to="t.href ?? undefined" :class="t.href ? 'rs-artikel' : 'rs-tip'" :data-test="`steun-tip-${t.sleutel}`">
            <span class="rs-icoon" aria-hidden="true"><Icoon naam="Lightbulb" :grootte="16" /></span>
            <span class="rs-body">
              <span class="rs-titel">{{ t.titel }}</span>
              <span class="rs-tekst">{{ t.tekst }}</span>
              <span v-if="t.reden" class="rs-reden">{{ t.reden }}</span>
            </span>
            <Icoon v-if="t.href" naam="ChevronRight" :grootte="16" class="rs-pijl" />
          </component>
        </li>
      </ul>
      <p v-if="!tips.length" class="meta">Nog geen tips voor dit moment.</p>
      <NuxtLink to="/helpcenter/tips" class="tekst-link rs-meer">Alle tips en tricks</NuxtLink>
    </article>

    <article class="kaart rs-blok" data-test="steun-artikelen">
      <header class="kaart-kop rs-kop"><h2 class="kaart-titel">{{ KOP[moment] }}</h2><span class="meta">Uit de New business academie</span></header>
      <ul v-if="artikelen.length" class="rs-lijst">
        <li v-for="a in artikelen" :key="a.slug">
          <NuxtLink :to="a.href" class="rs-artikel" :data-test="`steun-artikel-${a.slug}`">
            <span class="rs-icoon" aria-hidden="true"><Icoon naam="BookOpen" :grootte="16" /></span>
            <span class="rs-body">
              <span class="rs-titel">{{ a.titel }}</span>
              <span class="rs-tekst">{{ a.samenvatting }}</span>
              <span class="rs-reden">{{ a.reden }}<template v-if="a.bron"> · {{ a.bron }}</template></span>
            </span>
            <Icoon naam="ChevronRight" :grootte="16" class="rs-pijl" />
          </NuxtLink>
        </li>
      </ul>
      <p v-else class="meta">Geen artikelen gevonden. Kijk in de academie wat je wilt lezen.</p>
      <NuxtLink to="/helpcenter/academie" class="tekst-link rs-meer">Naar de academie</NuxtLink>
    </article>
  </div>
</template>

<style scoped>
.rs { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; align-items: start; }
.rs-blok { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.rs-kop { flex-wrap: wrap; gap: 4px 12px; }
.rs-lijst { list-style: none; margin: 4px 0 0; padding: 0; display: grid; }
.rs-lijst > li { border-top: 1px solid var(--border); }
.rs-lijst > li:first-child { border-top: 0; }
.rs-tip, .rs-artikel { display: grid; grid-template-columns: 32px minmax(0, 1fr); gap: 10px; align-items: start; padding: 12px 0; }
.rs-artikel { grid-template-columns: 32px minmax(0, 1fr) 16px; min-height: 44px; color: var(--ink); text-decoration: none; }
.rs-artikel:hover .rs-titel { text-decoration: underline; }
.rs-icoon { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; background: var(--surface); color: var(--ink); }
.rs-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.rs-titel { font-size: 14px; font-weight: 700; color: var(--ink); line-height: 1.35; }
.rs-tekst { font-size: 13px; line-height: 1.5; color: var(--ink-soft); }
.rs-reden { font-size: 12px; color: var(--muted); }
.rs-pijl { align-self: center; color: var(--muted); }
.rs-meer { align-self: flex-start; display: inline-flex; align-items: center; min-height: 44px; font-size: 13px; }
@media (max-width: 899px) { .rs { grid-template-columns: minmax(0, 1fr); } }
</style>
