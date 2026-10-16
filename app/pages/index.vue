<script setup lang="ts">
// Vandaag op de laptop (F01), in de opzet van DealDrive: kop, de aanleiding van de dag groot, één
// kaart met drie kolommen (taken, afspraken, prio), het dashboard "Jouw resultaten · deze maand",
// Klaargezet door AI naast Door AI agents gedaan (vanaf Gevorderd), de inzichten bij je prospects van
// de laatste 48 uur, dan het werkblok en voor de salesmanager "Team vandaag". Dashboard en AI-blokken
// staan ook op de telefoon, onder de dagweergave.
const toast = useToast()
const { versie } = useAfronden()
const motorVersie = useState('motorVersie', () => 0)
const route = useRoute()
const { data: v, refresh } = await useFetch<any>('/api/vandaag', { query: computed(() => ({ dag: route.query.dag || undefined })), default: () => null })
// Dashboard en AI-blokken apart, zodat de dag niet op die cijfers wacht.
const { data: dash, refresh: verversDash } = useLazyFetch<any>('/api/vandaag/dashboard', { default: () => null })
watch([versie, motorVersie], () => { refresh(); verversDash() })
const open = ref<string | null>(null)
// P13: een afspraak op de dag opent in de agenda, met de afspraakflyout.
function openTaak(id: string | null) { if (id?.startsWith('afspraak:')) navigateTo(`/agenda?weergave=dag&afspraak=${id.slice(9)}`); else open.value = id }
const nieuweTaak = ref(false)
const nieuweProspect = ref(false)
const nieuweAfspraak = ref(false)
async function maakTaak(id: string) {
  try { await $fetch(`/api/signals/${id}/omzetten`, { method: 'POST', body: {} }); toast.toon('Taak gemaakt uit het inzicht.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
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
    </div>
    <section v-if="dash?.cijfers || dash?.klaargezet || dash?.agents" class="section vd-dash">
      <div class="container">
        <VandaagDashboard v-if="dash.cijfers" :c="dash.cijfers" />
        <VandaagAi v-if="dash.klaargezet || dash.agents" :klaargezet="dash.klaargezet" :agents="dash.agents" :class="{ 'mt-24': dash.cijfers }" @open="openTaak" @gewijzigd="verversDash()" />
      </div>
    </section>
    <div class="vt-alleen-groot">
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
