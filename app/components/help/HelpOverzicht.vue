<script setup lang="ts">
// Overzicht van één collectie (opzet van /helpcenter/instructies in DealDrive): kruimel terug naar het
// helpcenter, een zoekveld dat binnen de artikelen van deze collectie filtert (met "x van y") en per
// categorie een kop met de artikelen als kaarten. De academie staat in hoofdstukken (Het vak, Nieuwe klanten
// werven), elk met een anker. Je ziet alleen wat de server voor jouw rol teruggeeft.
import { ACADEMIE_HOOFDSTUKKEN, CATEGORIE_UITLEG, COLLECTIES, type HelpCollectie, categorieLink, zoekNormaal } from '~~/shared/help'
const props = defineProps<{ collectie: HelpCollectie }>()
const { data } = await useFetch<any>('/api/help', { key: `help-overzicht-${props.collectie}`, query: { collectie: props.collectie }, default: () => ({ artikelen: [] }) })
const zoekterm = ref('')
const alle = computed<any[]>(() => data.value.artikelen)
const treffers = computed(() => {
  const t = zoekNormaal(zoekterm.value)
  if (!t) return alle.value
  return alle.value.filter((a) => zoekNormaal(`${a.titel} ${a.samenvatting} ${a.categorie}`).includes(t))
})
const namen = computed<readonly string[]>(() => COLLECTIES[props.collectie].categorieen)
const voorbeeld: Record<HelpCollectie, string> = { product: 'bellijst, briefing of regel', newbusiness: 'voicemail, pitch of overdracht', tips: 'belblok, offline of Ctrl K' }
const groepen = computed(() => namen.value.map((naam) => ({ naam, artikelen: treffers.value.filter((a) => a.categorie === naam) })).filter((g) => g.artikelen.length))
// De academie in hoofdstukken; een andere collectie is één hoofdstuk zonder kop.
type Hoofdstuk = { sleutel: string; naam: string; uitleg: string; categorieen: readonly string[] }
const hoofdstukken = computed(() => (props.collectie === 'newbusiness' ? (ACADEMIE_HOOFDSTUKKEN as readonly Hoofdstuk[]) : [{ sleutel: props.collectie, naam: '', uitleg: '', categorieen: namen.value }])
  .map((h) => ({ ...h, groepen: groepen.value.filter((g) => h.categorieen.includes(g.naam)) })).filter((h) => h.groepen.length))
</script>

<template>
  <section class="section ho">
    <div class="container">
      <div class="ho-zoekrij">
        <label class="ho-zoekveld"><span class="sr-only">Zoek in deze artikelen</span><Icoon naam="Search" :grootte="18" class="ho-zoekicoon" />
          <input v-model="zoekterm" type="search" class="ho-zoek" :placeholder="`Zoek op onderwerp, bijvoorbeeld ${voorbeeld[collectie]}`" data-test="overzicht-zoek"></label>
        <span v-if="zoekterm.trim()" class="ho-telling tnum" data-test="overzicht-telling">{{ treffers.length }} van {{ alle.length }}</span>
      </div>
      <p v-if="!alle.length" class="ho-leeg" data-test="overzicht-leeg">Hier staan nog geen artikelen. Ze volgen; tot die tijd vind je veel in het <NuxtLink to="/helpcenter" class="ho-inline">helpcenter</NuxtLink>.</p>
      <p v-else-if="!groepen.length" class="ho-leeg" data-test="overzicht-leeg">Geen artikel gevonden voor "{{ zoekterm.trim() }}". Probeer een ander woord, of zoek in het <NuxtLink :to="{ path: '/helpcenter', query: { zoek: zoekterm.trim() } }" class="ho-inline">hele helpcenter</NuxtLink>.</p>
      <section v-for="h in hoofdstukken" :id="h.naam ? h.sleutel : undefined" :key="h.sleutel" class="ho-hoofdstuk" :data-test="h.naam ? `hoofdstuk-${h.sleutel}` : undefined">
        <header v-if="h.naam" class="ho-hoofdstuk-kop">
          <h2 class="ho-hoofdstuk-titel">{{ h.naam }}</h2>
          <p class="ho-hoofdstuk-uitleg">{{ h.uitleg }}</p>
        </header>
        <HelpGroep v-for="g in h.groepen" :key="g.naam" :titel="g.naam" :uitleg="CATEGORIE_UITLEG[g.naam]" :link="categorieLink(g.naam)" link-tekst="Alleen deze categorie" :data-test="`groep-${g.naam}`">
          <HelpKaart v-for="a in g.artikelen" :key="a.id" :artikel="a" />
        </HelpGroep>
      </section>
    </div>
  </section>
</template>

<style scoped>
.ho { padding-top: 0; }
.ho-zoekrij { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; }
.ho-zoekveld { position: relative; flex: 1; max-width: 720px; display: block; }
.ho-zoekicoon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--muted); pointer-events: none; }
.ho-zoek { width: 100%; min-height: var(--touch-target-min); padding: 11px 14px 11px 42px; font: inherit; font-size: 16px; background: var(--wit); border: 1px solid var(--border-strong); border-radius: 2px; color: var(--ink); }
.ho-zoek:focus { outline: 2px solid var(--yellow); outline-offset: -1px; }
.ho-telling { font-size: 12px; color: var(--muted); white-space: nowrap; }
.ho-leeg { padding: 24px; background: var(--wit); border: 1px dashed var(--border-strong); font-size: 14px; line-height: 1.6; color: var(--muted); text-align: center; }
.ho-hoofdstuk + .ho-hoofdstuk { margin-top: 40px; }
.ho-hoofdstuk { scroll-margin-top: 80px; }
.ho-hoofdstuk-kop { margin-bottom: 18px; padding-left: 14px; border-left: 3px solid var(--yellow); }
.ho-hoofdstuk-titel { font-family: var(--font-serif); font-size: 24px; font-weight: 700; margin: 0; color: var(--ink); }
.ho-hoofdstuk-uitleg { margin: 4px 0 0; font-size: 14px; line-height: 1.55; color: var(--ink-soft); max-width: 68ch; }
.ho-inline { color: var(--ink); font-weight: 600; border-bottom: 2px solid var(--yellow); text-decoration: none; }
</style>
