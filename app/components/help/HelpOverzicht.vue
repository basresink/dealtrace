<script setup lang="ts">
// Overzicht van één collectie (opzet van /helpcenter/instructies in DealDrive): kruimel terug naar het
// helpcenter, een zoekveld dat binnen de artikelen van deze collectie filtert (met "x van y") en per
// categorie een kop met de artikelen als kaarten. Je ziet alleen wat de server voor jouw rol teruggeeft.
import { CATEGORIE_UITLEG, CATEGORIEEN_NEWBUSINESS, CATEGORIEEN_PRODUCT, categorieLink, zoekNormaal } from '~~/shared/help'
const props = defineProps<{ collectie: 'product' | 'newbusiness' }>()
const { data } = await useFetch<any>('/api/help', { key: `help-overzicht-${props.collectie}`, query: { collectie: props.collectie }, default: () => ({ artikelen: [] }) })
const zoekterm = ref('')
const alle = computed<any[]>(() => data.value.artikelen)
const treffers = computed(() => {
  const t = zoekNormaal(zoekterm.value)
  if (!t) return alle.value
  return alle.value.filter((a) => zoekNormaal(`${a.titel} ${a.samenvatting} ${a.categorie}`).includes(t))
})
const namen = computed<readonly string[]>(() => (props.collectie === 'product' ? CATEGORIEEN_PRODUCT : CATEGORIEEN_NEWBUSINESS))
const groepen = computed(() => namen.value.map((naam) => ({ naam, artikelen: treffers.value.filter((a) => a.categorie === naam) })).filter((g) => g.artikelen.length))
</script>

<template>
  <section class="section ho">
    <div class="container">
      <div class="ho-zoekrij">
        <label class="ho-zoekveld"><span class="sr-only">Zoek in deze artikelen</span><Icoon naam="Search" :grootte="18" class="ho-zoekicoon" />
          <input v-model="zoekterm" type="search" class="ho-zoek" :placeholder="collectie === 'product' ? 'Zoek op onderwerp, bijvoorbeeld bellijst, briefing of regel' : 'Zoek op onderwerp, bijvoorbeeld voicemail, budget of overdracht'" data-test="overzicht-zoek"></label>
        <span v-if="zoekterm.trim()" class="ho-telling tnum" data-test="overzicht-telling">{{ treffers.length }} van {{ alle.length }}</span>
      </div>
      <p v-if="!groepen.length" class="ho-leeg" data-test="overzicht-leeg">Geen artikel gevonden voor "{{ zoekterm.trim() }}". Probeer een ander woord, of zoek in het <NuxtLink :to="{ path: '/helpcenter', query: { zoek: zoekterm.trim() } }" class="ho-inline">hele helpcenter</NuxtLink>.</p>
      <HelpGroep v-for="g in groepen" :key="g.naam" :titel="g.naam" :uitleg="CATEGORIE_UITLEG[g.naam]" :link="categorieLink(g.naam)" link-tekst="Alleen deze categorie" :data-test="`groep-${g.naam}`">
        <HelpKaart v-for="a in g.artikelen" :key="a.id" :artikel="a" />
      </HelpGroep>
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
.ho-inline { color: var(--ink); font-weight: 600; border-bottom: 2px solid var(--yellow); text-decoration: none; }
</style>
