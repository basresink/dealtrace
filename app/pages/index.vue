<script setup lang="ts">
// Vandaag op de laptop (F01), in de opzet van DealDrive: kop met de quote van de dag en de knop Dagstart,
// de aanleiding van de dag groot (ook voor een Beginner), één kaart met drie kolommen (taken, afspraken,
// prio), het dashboard "Jouw resultaten · deze maand", Klaargezet door AI naast Belscript, de inzichten bij
// je prospects van de laatste 48 uur en voor de salesmanager "Team vandaag". Dashboard en de twee blokken
// staan ook op de telefoon, onder de dagweergave.
const toast = useToast()
const { aan } = useFunctie()
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
const nieuweAfspraak = ref(false)
async function maakTaak(id: string) {
  try { await $fetch(`/api/signals/${id}/omzetten`, { method: 'POST', body: {} }); toast.toon('Taak gemaakt uit het inzicht.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
useHead({ title: 'Vandaag · Dealtrace' })
</script>

<template>
  <div v-if="v">
    <AankomstKaart deel="kaart" class="vt-alleen-telefoon" style="padding: 0 16px" />
    <VandaagTelefoon class="vt-alleen-telefoon" :t="v.telefoon" :kan="v.kan" :quote="v.kop.quote" @open="openTaak" @ververs="refresh()" />
    <AankomstKaart deel="inloop" class="vt-alleen-telefoon" style="padding: 0 16px 16px" />
    <div class="vt-alleen-groot">
    <PaginaKop helpartikel="vandaag">
      <template #kicker><span class="kicker kicker--streep" data-test="vandaag-kicker">{{ v.kop.kicker }}</span></template>
      <template #titel><h1 class="title title--groot">{{ v.kop.groet }}</h1></template>
      <template #uitleg>
        <p v-if="v.kop.quote" class="vd-quote" data-test="quote-van-de-dag">{{ v.kop.quote }}</p>
        <p class="subtitle subtitle--groot" data-test="samenvatting">{{ v.kop.samenvatting }}</p>
      </template>
      <template #acties>
        <button v-if="aan('taken.basis')" type="button" class="dd-actie dd-actie--primair" data-test="vandaag-taak" @click="nieuweTaak = true"><Icoon naam="Plus" class="dd-actie-icoon" />Taak</button>
        <button v-if="aan('agenda.basis')" type="button" class="dd-actie dd-actie--zwart" data-test="vandaag-afspraak" @click="nieuweAfspraak = true"><Icoon naam="Plus" class="dd-actie-icoon" />Afspraak</button>
        <FunctieLink to="/dagstart" class="dd-actie dd-actie--secundair" data-test="vandaag-dagstart"><Icoon naam="Sunrise" class="dd-actie-icoon" />Dagstart</FunctieLink>
      </template>
    </PaginaKop>
    <section v-if="v.aanleiding" class="section vd-hero">
      <div class="container">
        <AanleidingHero :a="v.aanleiding" @maak-taak="maakTaak" />
      </div>
    </section>
    <section class="section section--alt">
      <div class="container">
        <VandaagPaneel :taken="v.taken" :afspraken="v.telefoon.dag.stapels.afspraken" :prio="v.prio" :dag="route.query.dag as string | undefined" @open="openTaak" />
      </div>
    </section>
    </div>
    <section v-if="dash?.cijfers || dash?.klaargezet || dash?.belscript" class="section vd-dash">
      <div class="container">
        <VandaagDashboard v-if="dash.cijfers" :c="dash.cijfers" />
        <VandaagAi v-if="dash.klaargezet || dash.belscript" :klaargezet="dash.klaargezet" :belscript="dash.belscript" :class="{ 'mt-24': dash.cijfers }" @open="openTaak" @gewijzigd="verversDash()" />
      </div>
    </section>
    <div class="vt-alleen-groot">
    <section class="section section--alt" :class="{ 'section--laatste': !v.team }">
      <div class="container">
        <ProspectSignalen :lijst="v.prospectSignalen ?? []" />
      </div>
    </section>
    <section v-if="v.team" class="section section--laatste">
      <div class="container">
        <div class="vandaag-blokken">
          <article class="kaart" data-test="team-vandaag">
            <span class="kicker">Team vandaag</span>
            <ul class="schakel-lijst mt-8"><li v-for="l in v.team" :key="l.naam" class="schakel-rij"><span>{{ l.naam.replace(/^Testgebruiker /, '') }}</span><span class="taak-meta"><span :class="{ 'tekst-rood': l.achterstallig }">{{ l.achterstallig }} over tijd</span> · {{ l.open }} open · {{ l.inzichten }} wachten</span></li></ul>
          </article>
        </div>
      </div>
    </section>
    </div>
    <TaakFlyout :open="!!open" :taak-id="open" :lijst="v?.taken?.lijst?.map((x: any) => x.id)" @sluit="open = null" @klaar="refresh()" @gewijzigd="refresh()" />
    <NieuweTaakFlyout :open="nieuweTaak" @sluit="nieuweTaak = false" @gemaakt="nieuweTaak = false; refresh()" />
    <PlanAfspraakFlyout :open="nieuweAfspraak" @sluit="nieuweAfspraak = false" @gepland="(id: string) => { nieuweAfspraak = false; navigateTo(`/agenda?weergave=dag&afspraak=${id}`) }" />
  </div>
</template>

<style scoped>
/* De quote van de dag direct onder de groet: rustig, cursief, met een gele streep ervoor. */
.vd-quote { margin: 6px 0 10px; padding-left: 12px; border-left: 3px solid var(--yellow); font-family: var(--font-serif); font-size: 18px; font-style: italic; line-height: 1.45; color: var(--ink-soft); max-width: 60ch; }
@media (max-width: 767px) { .vd-quote { font-size: 16px; } }
</style>
