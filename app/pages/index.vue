<script setup lang="ts">
// Vandaag op de laptop (F01), in de opzet van DealDrive: kop, de aanleiding van de dag groot, één
// kaart met drie kolommen (taken, afspraken, prio), de inzichten bij je prospects van de laatste
// 48 uur, dan werkblok en concepten; vanaf Gevorderd agents, datakwaliteit en jouw week in eigen
// volgorde; voor de salesmanager "Team vandaag".
const toast = useToast()
const { versie } = useAfronden()
const motorVersie = useState('motorVersie', () => 0)
const route = useRoute()
const { data: v, refresh } = await useFetch<any>('/api/vandaag', { query: computed(() => ({ dag: route.query.dag || undefined })), default: () => null })
watch([versie, motorVersie], () => refresh())
const open = ref<string | null>(null)
// P13: een afspraak op de dag opent in de agenda, met de afspraakflyout.
function openTaak(id: string | null) { if (id?.startsWith('afspraak:')) navigateTo(`/agenda?weergave=dag&afspraak=${id.slice(9)}`); else open.value = id }
const nieuweTaak = ref(false)
const nieuweProspect = ref(false)
const nieuweAfspraak = ref(false)
async function maakTaak(id: string) {
  try { await $fetch(`/api/signals/${id}/omzetten`, { method: 'POST', body: {} }); toast.toon('Taak gemaakt uit het inzicht.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const dagNaam = (d: string) => new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`))
async function verplaats(blok: string, richting: -1 | 1) {
  const l = [...v.value.volgorde]
  const i = l.indexOf(blok)
  const j = i + richting
  if (j < 0 || j >= l.length) return
  ;[l[i], l[j]] = [l[j]!, l[i]!]
  v.value.volgorde = l
  try { await $fetch('/api/mij/vandaag-volgorde', { method: 'POST', body: { volgorde: l } }) } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function datakwaliteitTaak(g: any) {
  try { await $fetch('/api/tasks', { method: 'POST', body: { title: `Aanvullen: ${g.aantal} ${g.tekst}`, actionType: 'taak' } }); toast.toon('Taak gemaakt.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
useHead({ title: 'Vandaag · Dealtrace' })
</script>

<template>
  <div v-if="v">
    <AankomstKaart deel="kaart" class="vt-alleen-telefoon" style="padding: 0 16px" />
    <VandaagTelefoon class="vt-alleen-telefoon" :t="v.telefoon" :kan="v.kan" @open="openTaak" @ververs="refresh()" />
    <AankomstKaart deel="inloop" class="vt-alleen-telefoon" style="padding: 0 16px 16px" />
    <div class="vt-alleen-groot">
    <section class="section">
      <div class="container">
        <div class="sec-head">
          <div>
            <span class="kicker kicker--streep" data-test="vandaag-kicker">{{ v.kop.kicker }}</span>
            <h1 class="title title--groot">{{ v.kop.groet }}</h1>
            <p class="subtitle subtitle--groot" data-test="samenvatting">{{ v.kop.samenvatting }}</p>
          </div>
          <div class="toolbar-buttons">
            <button type="button" class="dd-actie dd-actie--primair" data-test="vandaag-taak" @click="nieuweTaak = true"><Icoon naam="Plus" class="dd-actie-icoon" />Taak</button>
            <button type="button" class="dd-actie dd-actie--zwart" data-test="vandaag-afspraak" @click="nieuweAfspraak = true"><Icoon naam="Plus" class="dd-actie-icoon" />Afspraak</button>
            <button v-if="v.kan.nieuwProspect" type="button" class="dd-actie dd-actie--secundair" data-test="vandaag-prospect" @click="nieuweProspect = true"><Icoon naam="UserPlus" class="dd-actie-icoon" />Prospect</button>
            <HulpKnop artikel="vandaag" />
          </div>
        </div>
      </div>
    </section>
    <section v-if="v.aanleiding" class="section vd-hero">
      <div class="container">
        <AanleidingHero :a="v.aanleiding" @maak-taak="maakTaak" />
      </div>
    </section>
    <section class="section section--alt">
      <div class="container">
        <p v-if="v.telefoon.focus" class="kaart vt-focusregel mb-16" data-test="focusregel"><span class="kicker">Je eerste zet</span> {{ v.telefoon.focus.wat }} · <span class="meta">{{ v.telefoon.focus.waarom }}</span></p>
        <VandaagPaneel :taken="v.taken" :afspraken="v.telefoon.dag.stapels.afspraken" :prio="v.prio" :dag="route.query.dag as string | undefined" @open="openTaak" />
      </div>
    </section>
    <section class="section section--alt">
      <div class="container">
        <ProspectSignalen :lijst="v.prospectSignalen ?? []" />
      </div>
    </section>
    <section class="section section--laatste">
      <div class="container">
        <div class="vandaag-blokken">
          <article class="kaart kaart--geel" data-test="werkblok">
            <span class="kicker">{{ v.werkblok.titel }}</span>
            <p class="mt-8">{{ v.werkblok.tekst }}</p>
            <NuxtLink :to="v.werkblok.knop.naar" class="dd-act dd-act--primair mt-16">{{ v.werkblok.knop.tekst }}</NuxtLink>
          </article>
          <article class="kaart" data-test="concepten">
            <span class="kicker">Klaargezet door AI</span>
            <p class="mt-8">{{ v.concepten.aantal ? `${v.concepten.aantal} concepten wachten op je goedkeuring.` : 'Er wachten geen concepten op je.' }}</p>
          </article>
        </div>

        <div class="vandaag-blokken mt-16">
          <template v-for="(blok, i) in v.volgorde" :key="blok">
            <article v-if="blok === 'agents' && v.agents" class="kaart" data-test="agents">
              <header class="kaart-kop"><span class="kicker">Door agents gedaan sinds gisteren</span><span v-if="v.kan.indeling" class="reis-knoppen"><button type="button" class="dd-act dd-act--icoon" aria-label="Eerder" :disabled="i === 0" @click="verplaats(blok, -1)">↑</button><button type="button" class="dd-act dd-act--icoon" aria-label="Later" :disabled="i === v.volgorde.length - 1" @click="verplaats(blok, 1)">↓</button></span></header>
              <p class="mt-8">{{ v.agents.taken }} taken en {{ v.agents.inzichten }} inzichten klaargezet · {{ v.agents.geparkeerd }} accounts geparkeerd</p>
              <p v-if="v.agents.samenvatting" class="taak-meta mt-8" data-test="agents-samenvatting">{{ v.agents.samenvatting }}</p>
            </article>
            <article v-if="blok === 'datakwaliteit' && v.datakwaliteit" class="kaart" data-test="datakwaliteit">
              <header class="kaart-kop"><span class="kicker">Datakwaliteit</span><span v-if="v.kan.indeling" class="reis-knoppen"><button type="button" class="dd-act dd-act--icoon" aria-label="Eerder" :disabled="i === 0" @click="verplaats(blok, -1)">↑</button><button type="button" class="dd-act dd-act--icoon" aria-label="Later" :disabled="i === v.volgorde.length - 1" @click="verplaats(blok, 1)">↓</button></span></header>
              <p v-if="!v.datakwaliteit.length" class="kaart-meta mt-8">Geen gaten bij je actieve prospects.</p>
              <ul class="schakel-lijst"><li v-for="g in v.datakwaliteit" :key="g.sleutel" class="schakel-rij"><span><strong class="tnum">{{ g.aantal }}</strong> {{ g.tekst }}</span><button v-if="g.knop === 'Maak taak'" type="button" class="dd-act" @click="datakwaliteitTaak(g)">Maak taak</button><NuxtLink v-else :to="`/prospects/alle?bereikbaarheid=${g.sleutel}`" class="dd-act">{{ g.knop }}</NuxtLink></li></ul>
            </article>
            <article v-if="blok === 'week' && v.week" class="kaart" data-test="week">
              <header class="kaart-kop"><span class="kicker">Jouw week</span><span v-if="v.kan.indeling" class="reis-knoppen"><button type="button" class="dd-act dd-act--icoon" aria-label="Eerder" :disabled="i === 0" @click="verplaats(blok, -1)">↑</button><button type="button" class="dd-act dd-act--icoon" aria-label="Later" :disabled="i === v.volgorde.length - 1" @click="verplaats(blok, 1)">↓</button></span></header>
              <div class="week-raster mt-8"><div v-for="d in v.week" :key="d.datum" class="week-dag"><strong>{{ dagNaam(d.datum) }}</strong><br><span class="tnum">{{ d.taken }}</span> <span class="taak-meta">taken</span></div></div>
            </article>
          </template>
          <article v-if="v.team" class="kaart" data-test="team-vandaag">
            <span class="kicker">Team vandaag</span>
            <ul class="schakel-lijst mt-8"><li v-for="l in v.team" :key="l.naam" class="schakel-rij"><span>{{ l.naam.replace(/^Testgebruiker /, '') }}</span><span class="taak-meta"><span :class="{ 'tekst-rood': l.achterstallig }">{{ l.achterstallig }} over tijd</span> · {{ l.open }} open · {{ l.inzichten }} wachten</span></li></ul>
          </article>
        </div>
      </div>
    </section>
    </div>
    <TaakFlyout :open="!!open" :taak-id="open" @sluit="open = null" @klaar="refresh()" @gewijzigd="refresh()" />
    <NieuweTaakFlyout :open="nieuweTaak" @sluit="nieuweTaak = false" @gemaakt="nieuweTaak = false; refresh()" />
    <NieuweProspectFlyout :open="nieuweProspect" @sluit="nieuweProspect = false" @aangemaakt="(id) => navigateTo(`/accounts/${id}`)" @bestaand="(id) => navigateTo(`/accounts/${id}`)" />
    <PlanAfspraakFlyout :open="nieuweAfspraak" @sluit="nieuweAfspraak = false" @gepland="(id: string) => { nieuweAfspraak = false; navigateTo(`/agenda?weergave=dag&afspraak=${id}`) }" />
  </div>
</template>
