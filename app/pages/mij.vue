<script setup lang="ts">
// Mijn instellingen (F22): profiel, werkplek (alleen lezen), meldingen per soort
// en "Toon minder". Meldingen lopen via de sync-wachtrij en werken ook offline.
import { FUNCTIES } from '~~/shared/functies'
import { NIVEAU_LABEL, ROL_LABEL, WERKPLEK_LABEL, type Niveau, type Rol, type Werkplek } from '~~/shared/types'

const { me, laad, functie } = useMe()
const { voegToe } = useSyncQueue()
const toast = useToast()
const { data: ai } = await useFetch<any>('/api/assistent/credits', { default: () => null })
const { data: pers } = await useFetch<{ id: string; data: Record<string, any>; versie: number }>('/api/mij/instellingen')

const SOORTEN = [
  { sleutel: 'kritiek', naam: 'Kritiek', uitleg: 'Iets wat vandaag misgaat als je niets doet.' },
  { sleutel: 'hot', naam: 'Hete aanleiding', uitleg: 'Een prospect laat een signaal zien.' },
  { sleutel: 'dagstart', naam: 'Dagstart', uitleg: 'Je dag in het kort, om half negen.' },
  { sleutel: 'herinnering', naam: 'Herinnering', uitleg: 'Taken en afspraken die eraan komen.' },
  { sleutel: 'inzicht', naam: 'Inzicht', uitleg: 'Wat opvalt in je cijfers.' },
] as const

const meldingen = computed<Record<string, boolean>>(() => pers.value?.data.meldingen ?? {})
async function wisselMelding(soort: string, aan: boolean) {
  if (!pers.value) return
  pers.value.data = { ...pers.value.data, meldingen: { ...meldingen.value, [soort]: aan } }
  await voegToe({ tabel: 'persoonlijke_instellingen', op: 'patch', recordId: pers.value.id, patch: { meldingen: pers.value.data.meldingen } })
}

const magToonMinder = computed(() => functie('mij.toonMinder')?.beschikbaar)
const zichtbaar = computed(() => {
  const opZijbalk = new Set([...(me.value?.zijbalk.groepen ?? []).flatMap((g) => g.items.map((i) => i.sleutel)), ...(me.value?.gebruiker.verborgen ?? [])])
  return FUNCTIES.filter((f) => f.zijbalk && f.sleutel !== 'nav.vandaag' && opZijbalk.has(f.sleutel))
})
const verborgen = computed(() => new Set(me.value?.gebruiker.verborgen ?? []))
async function toonMinder(sleutel: string, tonen: boolean) {
  try {
    await $fetch('/api/mij/toon-minder', { method: 'POST', body: { functie: sleutel, verborgen: !tonen } })
    await laad()
  } catch (e: any) {
    toast.toon(e?.data?.statusMessage ?? 'Opslaan mislukt', 'fout')
  }
}
const g = computed(() => me.value!.gebruiker)
useHead({ title: 'Mijn instellingen · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Mijn instellingen" titel="Mijn instellingen" uitleg="Je profiel, je meldingen en wat je in de zijbalk ziet." helpartikel="mijn-instellingen" />
    <section class="section">
      <div class="container">
        <div class="instellingen-raster">
          <article class="kaart" data-test="profiel">
            <header class="kaart-kop"><h2 class="kaart-titel">Profiel</h2></header>
            <dl class="gegevens">
              <dt>Naam</dt><dd>{{ g.naam }}</dd>
              <dt>E-mail</dt><dd>{{ g.email }}</dd>
              <dt>Rol</dt><dd>{{ ROL_LABEL[g.rol as Rol] }}</dd>
              <dt>Niveau</dt><dd>{{ NIVEAU_LABEL[g.niveau as Niveau] }}</dd>
              <dt>Werkplek</dt><dd>{{ WERKPLEK_LABEL[g.werkplek as Werkplek] }}</dd>
              <dt>Team</dt><dd>{{ me?.team?.naam ?? 'Geen team' }}</dd>
            </dl>
            <p class="veld-uitleg">Je werkplek en niveau stelt je beheerder of salesmanager in.</p>
          </article>
          <article v-if="functie('regels.lezen')?.beschikbaar" class="kaart" data-test="mijn-regels">
            <header class="kaart-kop"><h2 class="kaart-titel">{{ functie('regels.persoonlijk')?.beschikbaar ? 'Mijn regels' : 'Regels bekijken' }}</h2></header>
            <p class="kaart-meta">Welke regels jouw taken en inzichten klaarzetten{{ functie('regels.persoonlijk')?.beschikbaar ? ', en je eigen regels voor je eigen accounts' : '' }}.</p>
            <div class="reis-knoppen mt-16"><NuxtLink to="/instellingen/regels" class="dd-act">Naar de regels</NuxtLink><NuxtLink to="/instellingen/ritme" class="dd-act">Accountmatrix</NuxtLink></div>
          </article>
          <article v-if="functie('belscript.variant')?.beschikbaar" class="kaart" data-test="mijn-scripts-kaart">
            <header class="kaart-kop"><h2 class="kaart-titel">Mijn scripts</h2></header>
            <p class="kaart-meta">Je eigen varianten van de belscripts van je team.</p>
            <div class="reis-knoppen mt-16"><NuxtLink to="/instellingen/mijn-scripts" class="dd-act">Naar mijn scripts</NuxtLink></div>
          </article>
          <article v-if="ai" class="kaart" data-test="mijn-ai-verbruik">
            <header class="kaart-kop"><h2 class="kaart-titel">Jouw AI-verbruik deze maand</h2></header>
            <p class="kaart-meta">{{ ai.eigen.plafond != null ? `${ai.eigen.verbruikt} van ${ai.eigen.plafond} credits` : `${ai.eigen.verbruikt} credits` }} · de organisatie heeft er nog {{ ai.over }} over.</p>
            <ul v-if="ai.eigen.perSoort.length" class="schakel-lijst"><li v-for="s in ai.eigen.perSoort" :key="s.soort" class="schakel-rij"><span>{{ s.soort }}</span><span class="meta tnum">{{ s.handelingen }} keer · {{ s.credits }} credits</span></li></ul>
          </article>
          <MijnToestellen />
          <article class="kaart">
            <header class="kaart-kop"><h2 class="kaart-titel">Meldingen</h2></header>
            <ul class="schakel-lijst">
              <li v-for="s in SOORTEN" :key="s.sleutel" class="schakel-rij">
                <div><span class="schakel-naam">{{ s.naam }}</span><span class="veld-uitleg">{{ s.uitleg }}</span></div>
                <Schakelaar :aan="meldingen[s.sleutel] !== false" :label="`Meldingen ${s.naam}`" @wissel="wisselMelding(s.sleutel, $event)" />
              </li>
            </ul>
          </article>
        </div>
      </div>
    </section>
    <section v-if="magToonMinder" class="section section--laatste">
      <div class="container">
        <span class="kicker kicker--streep">Toon minder</span>
        <h2 class="title">Wat je in de zijbalk ziet</h2>
        <p class="subtitle">Verberg wat je nu niet gebruikt. Je zet hier nooit iets aan wat voor je niveau nog uit staat.</p>
        <ul class="schakel-lijst kaart mt-16" data-test="toon-minder">
          <li v-for="f in zichtbaar" :key="f.sleutel" class="schakel-rij">
            <span class="schakel-naam"><Icoon :naam="f.zijbalk!.icoon" :grootte="16" /> {{ f.naam }}</span>
            <Schakelaar :aan="!verborgen.has(f.sleutel)" :label="`${f.naam} tonen`" @wissel="toonMinder(f.sleutel, $event)" />
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>
