<script setup lang="ts">
// Weekstart: op maandag het weekplan. Per dag de afspraken, bezoeken en belblokken; de voornemens uit de
// weekreview van vrijdag met hun stand; wat er openstaat; het tempo tegen je doel; de belangrijkste
// aanleidingen. Daaronder de blokken van de week (RitmeBlokken: belblokken om te vullen, belprioriteit,
// kansen langs de route per dag met bezoeken, lopende campagnes en accountplannen). Onderaan Tips en tricks en drie artikelen uit de academie bij je week (RitmeSteun).
// Eén bron: GET /api/weekstart (shared/dagritme.ts bouwWeekstart, vorm 'weekstart'; steun uit shared/ritmeSteun.ts).
const { functie } = useMe()
const aan = !!functie('dagritme.weekstart')?.beschikbaar
const reviewAan = !!functie('dagritme.weekreview')?.beschikbaar
const { data: w, refresh } = await useFetch<any>('/api/weekstart', { immediate: aan, default: () => null })
// Een afspraak in de week opent de afspraakflyout, een belblok het blok zelf.
const afspraak = ref<string | null>(null)
const ICOON: Record<string, string> = { afspraak: 'Handshake', bezoek: 'MapPin', belblok: 'Phone' }
const ICOON_KLASSE: Record<string, string> = { belblok: 'item-icoon--call', bezoek: 'item-icoon--visit', afspraak: 'item-icoon--email' }
const TEMPO_PIL: Record<string, string> = { 'op schema': 'pil--groen', achter: 'pil--rood', geen: 'pil--grijs' }
useHead({ title: 'Weekstart · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="dagritme.weekstart" />
    <template v-else-if="w">
      <PaginaKop :kicker="w.kicker" :titel="w.titel" :uitleg="w.samenvatting" helpartikel="weekstart">
        <template #acties>
          <NuxtLink to="/dagstart" class="dd-actie dd-actie--zwart" data-test="ws-naar-dagstart"><Icoon naam="Sunrise" class="dd-actie-icoon" />Dagstart</NuxtLink>
          <NuxtLink v-if="reviewAan" to="/weekreview" class="dd-actie dd-actie--secundair" data-test="ws-naar-weekreview"><Icoon naam="NotebookPen" class="dd-actie-icoon" />Weekreview</NuxtLink>
        </template>
      </PaginaKop>

      <section class="section section--alt">
        <div class="container ws-boven">
          <article class="kaart ws-tegel" data-test="ws-tempo">
            <span class="kicker">Tempo tegen je doel</span>
            <p class="ws-groot tnum">{{ w.tempo.gedaan }} <small>van {{ w.tempo.doel }}</small></p>
            <span class="pil" :class="TEMPO_PIL[w.tempo.stand]">{{ w.tempo.stand === 'geen' ? 'Week begint' : w.tempo.stand }}</span>
            <p class="meta">{{ w.tempo.tekst }}</p>
          </article>
          <article class="kaart ws-tegel" data-test="ws-open">
            <span class="kicker">Wat openstaat</span>
            <p class="ws-groot tnum">{{ w.open.totaal }} <small>taken</small></p>
            <p class="meta">{{ w.open.tekst }}</p>
            <NuxtLink to="/taken" class="tekst-link ws-link">Naar Taken</NuxtLink>
          </article>
          <article class="kaart ws-tegel" data-test="ws-voornemens">
            <span class="kicker">Je voornemens</span>
            <ul v-if="w.voornemens.length" class="ws-vn">
              <li v-for="v in w.voornemens" :key="v.id"><span>{{ v.tekst }}</span><span class="pil" :class="v.stand.klaar ? 'pil--groen' : 'pil--grijs'">{{ v.stand.tekst }}</span></li>
            </ul>
            <p v-else class="meta" data-test="ws-geen-voornemens">Geen voornemens uit de weekreview van vrijdag.<template v-if="reviewAan">{{ ' ' }}<NuxtLink to="/weekreview" class="tekst-link">Doe je weekreview</NuxtLink></template></p>
          </article>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="ws-week" data-test="ws-week">
            <article v-for="dag in w.dagen" :key="dag.datum" class="kaart ws-dag" :class="{ 'ws-dag--vandaag': dag.vandaag }" :data-test="`ws-dag-${dag.datum}`">
              <header class="ws-dag-kop"><b>{{ dag.label }}</b><span v-if="dag.vandaag" class="pil">Vandaag</span><span v-else-if="!dag.werkdag" class="pil pil--grijs">Vrij</span></header>
              <ul v-if="dag.items.length" class="ws-items">
                <li v-for="i in dag.items" :key="i.id">
                  <NuxtLink v-if="i.soort === 'belblok'" :to="`/belblokken/${i.id}`" class="item-rij">
                    <span class="item-tijd">{{ i.tijd }}</span>
                    <span class="item-icoon" :class="ICOON_KLASSE[i.soort]"><Icoon :naam="ICOON[i.soort] ?? 'Clock'" /></span>
                    <span class="item-body"><span class="item-naam">{{ i.titel }}</span><span v-if="i.sub" class="item-meta">{{ i.sub }}</span></span>
                  </NuxtLink>
                  <button v-else type="button" class="item-rij" :data-test="`ws-afspraak-${i.id}`" @click="afspraak = i.id">
                    <span class="item-tijd">{{ i.tijd }}</span>
                    <span class="item-icoon" :class="ICOON_KLASSE[i.soort]"><Icoon :naam="ICOON[i.soort] ?? 'Clock'" /></span>
                    <span class="item-body"><span class="item-naam">{{ i.titel }}</span><span v-if="i.sub" class="item-meta">{{ i.sub }}</span></span>
                  </button>
                </li>
              </ul>
              <p v-else class="meta ws-leeg">Nog niets gepland.</p>
            </article>
          </div>
        </div>
      </section>

      <section v-if="w.blokken" class="section">
        <div class="container"><RitmeBlokken :blokken="w.blokken" moment="weekstart" @ververs="refresh()" /></div>
      </section>

      <section class="section">
        <div class="container">
          <article class="kaart" data-test="ws-aanleidingen">
            <header class="kaart-kop"><h2 class="kaart-titel">Belangrijkste aanleidingen</h2></header>
            <ul v-if="w.aanleidingen.length" class="ws-items">
              <li v-for="a in w.aanleidingen" :key="a.id">
                <NuxtLink :to="`/inzichten?inzicht=${a.id}`" class="item-rij">
                  <span class="item-tijd tnum">{{ a.relevantie }}</span>
                  <span class="item-icoon"><Icoon naam="Lightbulb" /></span>
                  <span class="item-body"><span class="item-naam">{{ a.titel }}</span><span v-if="a.accountNaam" class="item-meta">{{ a.accountNaam }}</span></span>
                </NuxtLink>
              </li>
            </ul>
            <p v-else class="meta">Geen open aanleidingen bij je eigen prospects. Nieuwe inzichten zie je op Vandaag.</p>
          </article>
        </div>
      </section>

      <section class="section section--laatste">
        <div class="container"><RitmeSteun :steun="w.steun" moment="weekstart" /></div>
      </section>
      <AfspraakFlyout :open="!!afspraak" :afspraak-id="afspraak" @sluit="afspraak = null" @gewijzigd="refresh()" />
    </template>
  </div>
</template>

<style scoped>
.ws-boven { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.ws-tegel { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; min-width: 0; }
.ws-groot { margin: 0; font-family: var(--font-serif); font-size: 32px; font-weight: 700; line-height: 1; color: var(--ink); }
.ws-groot small { font-family: var(--font-sans); font-size: 14px; font-weight: 500; color: var(--muted); }
.ws-link { display: inline-flex; align-items: center; min-height: 44px; }
.ws-vn { list-style: none; margin: 0; padding: 0; width: 100%; }
.ws-vn li { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; padding: 8px 0; border-top: 1px solid var(--border); font-size: 14px; }
.ws-vn li:first-child { border-top: 0; }
.ws-week { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0; border: 1px solid var(--border); background: var(--wit); }
.ws-dag { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 16px; min-width: 0; padding: 14px 20px; border: 0; border-top: 1px solid var(--border); }
.ws-dag:first-child { border-top: 0; }
.ws-dag--vandaag { box-shadow: inset 3px 0 0 var(--yellow); }
.ws-dag-kop { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding-top: 10px; font-size: 14px; }
.ws-items { list-style: none; margin: 0; padding: 0; min-width: 0; }
.ws-items a.item-rij { text-decoration: none; }
.ws-leeg { margin: 0; padding-top: 10px; }
.ws-link { font-size: 13px; }
@media (max-width: 899px) { .ws-boven { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 719px) { .ws-dag { grid-template-columns: minmax(0, 1fr); gap: 4px; padding: 12px 16px; } .ws-dag-kop { flex-direction: row; padding-top: 0; } }
</style>
