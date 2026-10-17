<script setup lang="ts">
// Meetinganalyse (F09) in de opzet van DealDrive /meeting-analyse: "Haal je je meetingritme?". Kop met
// terug naar Meetings, + Afspraak, Filters (periode, vorm, type meeting, voor de salesmanager eigen of
// team en een persoon) en Download. Cijfers tegen de meeting-rij van de afspraakmatrix, de
// dekkingstabel per accountklasse met per klasse de accounts in een flyout, dan wat de meetings
// (online en telefoon) in de periode opleverden: uitkomsten, verslagen, transcripten, analyses van de
// Notulist en de doorlooptijd naar vervolg. Onderaan de optionele bril per regio.
import type { FlyoutAccount } from '~~/shared/afspraakAnalyse'

const route = useRoute()
const { functie } = useMe()
const aan = computed(() => !!functie('agenda.meetingAnalyse')?.beschikbaar)
const SLEUTELS = ['venster', 'van', 'tot', 'soort', 'vorm', 'scope', 'persoon'] as const
const query = computed(() => Object.fromEntries(SLEUTELS.map((k) => [k, typeof route.query[k] === 'string' ? route.query[k] : undefined]).filter(([, v]) => v)))
const { data, status } = await useFetch<any>('/api/meeting-analyse', { query, immediate: aan.value, default: () => null })
const filtersOpen = ref(false)
const filterTeller = computed(() => ['venster', 'soort', 'vorm', 'persoon'].filter((k) => (query.value as Record<string, unknown>)[k]).length + (query.value.scope === 'team' ? 1 : 0))

const persoonNaam = computed(() => data.value?.bereik.leden.find((l: any) => l.id === data.value?.bereik.persoon)?.naam ?? null)
const team = computed(() => data.value?.bereik.scope === 'team')
const kicker = computed(() => ['Rapportage', 'Meetinganalyse', team.value ? (persoonNaam.value ?? 'Team') : null].filter(Boolean).join(' · '))
const titel = computed(() => (persoonNaam.value ? `Haalt ${persoonNaam.value} het meetingritme?` : team.value ? 'Haalt het team het meetingritme?' : 'Haal je je meetingritme?'))
const datumKort = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const vensterTekst = computed(() => {
  const v = data.value?.venster
  if (!v) return ''
  return v.venster === 'periode' ? `van ${datumKort(v.van)} tot en met ${datumKort(v.tot)}` : v.binnen.replace('binnen', 'in de laatste')
})

const tegels = computed(() => {
  const k = data.value?.kpi
  if (!k) return []
  return [
    { waarde: k.meetings, label: 'Meetings gehouden', voet: data.value.soort || data.value.vorm ? 'van het gekozen type, gehouden' : 'online en telefonisch, gehouden', test: 'ma-kpi-gehouden' },
    { waarde: k.doel, label: 'Doel volgens afspraakmatrix', voet: `verwacht ${vensterTekst.value}`, test: 'ma-kpi-doel' },
    { waarde: k.achter, label: 'Accounts achter op ritme', voet: 'onder hun meetingdoel of nooit gesproken', rood: k.achter > 0, test: 'ma-kpi-achter' },
    { waarde: `${k.dekking}%`, label: 'Ritmedekking', voet: `${k.metDoel} accounts met een meetingdoel`, test: 'ma-kpi-dekking' },
  ]
})
const vormTegels = computed(() => (data.value?.perVorm ?? []).map((v: any) => ({ waarde: v.afgerond, label: v.vorm === 'online' ? 'Online gehouden' : 'Telefonisch gehouden', voet: `${v.conversie}% vervolg · ${v.verslagProcent}% verslag · ${v.nietVerschenen} niet verschenen`, test: `ma-vorm-${v.vorm}` })))

// Accounts achter een klasse of regio in de flyout, langst stil eerst.
const lijst = reactive({ open: false, kicker: '', titel: '', filter: (_a: any) => true as boolean })
function openKlasse(r: any) { Object.assign(lijst, { open: true, kicker: 'Meetingdekking', titel: `${r.label}${r.namen?.length ? ` · ${r.ritme}` : ''}`, filter: (a: any) => a.klasse === r.code }) }
function openRegio(r: any) { Object.assign(lijst, { open: true, kicker: 'Meetingdekking per regio', titel: r.naam, filter: (a: any) => a.regioId === r.regioId && !!a.ritme }) }
const lijstAccounts = computed<FlyoutAccount[]>(() => (data.value?.accounts ?? []).filter((a: any) => lijst.filter(a))
  .map((a: any) => ({ id: a.id, naam: a.naam, soort: a.soort, klasse: a.klasse, plaats: a.plaats, laatste: a.laatste, dagenGeleden: a.dagenGeleden, toon: a.ritme === 'opSchema' ? 'goed' : a.ritme === 'achter' ? 'stil' : a.ritme === 'nooit' ? 'nooit' : 'geen' })))
const plan = reactive({ open: false, account: null as null | { id: string; naam: string } })
function nieuweAfspraak(account: { id: string; naam: string } | null = null) { Object.assign(plan, { open: true, account }) }

function download() {
  const d = data.value
  if (!d) return
  const RITME: Record<string, string> = { opSchema: 'op schema', achter: 'achter op ritme', nooit: 'nooit een meeting' }
  const klasse = new Map(d.klassen.map((k: any) => [k.code, k]))
  bewaarCsv(`meetinganalyse-${d.venster.van}-tot-${d.venster.tot}.csv`, [
    { sleutel: 'account', label: 'Account' }, { sleutel: 'soort', label: 'Soort' }, { sleutel: 'klasse', label: 'Klasse' }, { sleutel: 'doel', label: 'Meetingdoel' },
    { sleutel: 'plaats', label: 'Plaats' }, { sleutel: 'ritme', label: 'Ritme' }, { sleutel: 'laatste', label: 'Laatste meeting' },
  ], d.accounts.map((a: any) => ({ account: a.naam, soort: a.soort === 'klant' ? 'Klant' : 'Prospect', klasse: a.klasse ?? 'zonder klasse', doel: (klasse.get(a.klasse) as any)?.ritme ?? '', plaats: a.plaats ?? '', ritme: a.ritme ? RITME[a.ritme] : 'geen meetingdoel', laatste: a.laatste ? a.laatste.slice(0, 10) : 'nooit' })))
}
useHead({ title: 'Meetinganalyse · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="agenda.meetingAnalyse" />
    <template v-else>
      <PaginaKop helpartikel="agenda">
        <template #kicker>
          <nav class="breadcrumb" aria-label="Kruimelpad"><NuxtLink to="/meetings" class="breadcrumb-link ma-terug" data-test="ma-terug">← Terug naar Meetings</NuxtLink></nav>
          <span class="kicker kicker--streep" data-test="ma-kicker">{{ kicker }}</span>
        </template>
        <template #titel><h1 class="title title--groot">{{ titel }}</h1></template>
        <template #uitleg><p class="subtitle subtitle--groot">Spreek je iedereen zo vaak als je je had voorgenomen? Hier zie je per accountklasse wie online of aan de telefoon aandacht kreeg en wie stilviel. Precies daar zit je volgende meeting.</p></template>
        <template #acties>
          <button type="button" class="dd-actie dd-actie--zwart" data-test="ma-afspraak" @click="nieuweAfspraak()"><Icoon naam="Plus" class="dd-actie-icoon" />Afspraak</button>
          <button type="button" class="dd-actie dd-actie--secundair" :class="{ 'ma-filterknop--aan': filtersOpen || filterTeller }" :aria-expanded="filtersOpen" data-test="ma-filters" @click="filtersOpen = !filtersOpen">
            <Icoon naam="SlidersHorizontal" class="dd-actie-icoon" />Filters<span v-if="filterTeller" class="pil-teller pil-teller--geel">{{ filterTeller }}</span><Icoon naam="ChevronDown" :grootte="14" class="ma-caret" :class="{ 'ma-caret--open': filtersOpen }" />
          </button>
          <button type="button" class="dd-actie dd-actie--secundair" :disabled="!data" data-test="ma-download" @click="download"><Icoon naam="Download" class="dd-actie-icoon" />Download</button>
        </template>
      </PaginaKop>

      <AnalyseFilterpaneel v-if="filtersOpen && data" :venster="data.venster" :soorten="data.soorten" soort-label="Type meeting" :bereik="data.bereik" met-vorm />

      <section v-if="!data" class="section"><div class="container"><p class="meta">{{ status === 'error' ? 'De analyse kon niet laden. Probeer het opnieuw.' : 'Bezig met rekenen…' }}</p></div></section>
      <template v-else>
        <section class="section">
          <div class="container">
            <LegeStaat v-if="!data.accounts.length" kicker="NOG LEEG" :titel="team ? 'Er staan nog geen accounts op naam van dit team.' : 'Er staan nog geen accounts op jouw naam.'" tekst="Deze analyse rekent met de eigen portefeuille. Vraag je beheerder om accounts toe te wijzen, of neem prospects over via de Leadgenerator." data-test="ma-leeg" />
            <template v-else>
              <AnalyseTegels :tegels="tegels" data-test="ma-cijfers" />
              <p v-if="data.zonderKlasse" class="meta mt-8" data-test="ma-zonder-klasse">{{ data.zonderKlasse }} {{ data.zonderKlasse === 1 ? 'account zonder accountklasse telt' : 'accounts zonder accountklasse tellen' }} hier niet mee. Ken een klasse toe op de accountkaart.</p>
            </template>
          </div>
        </section>

        <section v-if="data.accounts.length" class="section section--alt" data-test="ma-klassen">
          <div class="container">
            <LegeStaat v-if="!data.klassen.length" kicker="GEEN KLASSEN" titel="Er zijn nog geen accountklassen." tekst="Het meetingdoel komt per klasse uit de afspraakmatrix. Richt de klassen in bij Ritme en klassen." />
            <template v-else>
              <div class="tabel-wrap ma-groot">
                <table class="tabel" data-test="klasse-tabel">
                  <thead><tr><th>Accountklasse</th><th>Meetingdoel</th><th class="cel-r">Prospects</th><th class="cel-r">Nog niet benaderd</th><th class="ma-balkkolom">Meetingdekking</th><th class="cel-r">Achter / nooit</th><th aria-label="Openen" /></tr></thead>
                  <tbody>
                    <tr v-for="r in data.klassen" :key="r.code" :data-test="`klasse-rij-${r.code}`">
                      <td><strong>{{ r.label }}</strong><br><span class="ma-hint" :title="r.namen.join(' · ')">{{ r.ritme }}</span></td>
                      <td><span v-if="r.interval" class="pil">{{ r.perJaar }}× per jaar</span><span v-else class="pil pil--grijs">Geen</span></td>
                      <td class="cel-r">{{ r.prospects }}</td><td class="cel-r">{{ r.nietBenaderd }}</td>
                      <td><DekkingBalk v-if="r.interval" :gezien="r.opSchema" :stil="r.achter" :nooit="r.nooit" :titel="`${r.opSchema} op schema · ${r.achter} achter op ritme · ${r.nooit} nooit een meeting`" /><span v-else class="ma-hint">geen meetingdoel</span></td>
                      <td class="cel-r"><span v-if="!r.interval" class="ma-hint">—</span><span v-else :class="{ 'ma-rood': r.achter + r.nooit > 0 }">{{ r.achter + r.nooit }}</span></td>
                      <td><button type="button" class="dd-act" :disabled="!r.totaal" :data-test="`klasse-open-${r.code}`" @click="openKlasse(r)">Openen</button></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <ul class="ma-klein ma-lijst">
                <li v-for="r in data.klassen" :key="r.code">
                  <button type="button" class="ma-knop" :disabled="!r.totaal" @click="openKlasse(r)">
                    <span class="ma-knop-kop"><strong>{{ r.label }}</strong><span v-if="r.interval" class="tnum" :class="{ 'ma-rood': r.achter + r.nooit > 0 }">{{ r.achter + r.nooit }} achter of nooit</span><span v-else class="ma-hint">geen meetingdoel</span></span>
                    <DekkingBalk v-if="r.interval" :gezien="r.opSchema" :stil="r.achter" :nooit="r.nooit" />
                    <span class="ma-hint">{{ r.interval ? `${r.perJaar}× per jaar` : 'Geen doel' }} · {{ r.prospects }} prospects</span>
                  </button>
                </li>
              </ul>
              <DekkingLegenda gezien="Op schema" stil="Achter op ritme" nooit="Nooit een meeting" />
              <p class="meta mt-16">Het meetingdoel per klasse komt uit de meeting-rij van de afspraakmatrix op <NuxtLink to="/instellingen/ritme" class="tabel-link">Ritme en klassen</NuxtLink>. Pas je het daar aan, dan schuift deze meetlat mee.</p>
            </template>
          </div>
        </section>

        <section class="section" data-test="ma-meetings">
          <div class="container">
            <header class="ma-blokkop">
              <span class="kicker kicker--streep">Meetings {{ vensterTekst }}</span>
              <h2 class="ma-bloktitel">Wat leverden je gesprekken op?</h2>
              <p class="ma-subtitel">Online meetings en belafspraken met prospects, met hun uitkomst, verslag, transcript en de analyse van de Notulist. Intern overleg telt niet mee. De doorlooptijd telt de dagen tot de volgende afspraak met hetzelfde account.</p>
            </header>
            <AnalyseTegels v-if="!data.vorm" klein :tegels="vormTegels" class="ma-vorm" />
            <AfspraakCijfersBlok :cijfers="data.cijfers" :per-soort="data.perSoort" eenheid="meetings" soort-kop="Meetingsoort" met-transcript :venster-tekst="vensterTekst" />
          </div>
        </section>

        <section class="section section--alt section--laatste" data-test="ma-regios">
          <div class="container">
            <header class="ma-blokkop">
              <span class="kicker kicker--streep">Optionele bril</span>
              <h2 class="ma-bloktitel">Combineer met een regiodag</h2>
              <p class="ma-subtitel">Ga je toch fysiek langs in een gebied? Hier zie je per regio hoe de meetingdekking ervoor staat. Plan de stille accounts online in terwijl je er toch bent.</p>
            </header>
            <p v-if="data.geenRegios" class="meta">Er is nog geen gebiedsindeling. Richt regio's in bij <NuxtLink to="/instellingen/gebieden" class="tabel-link">Gebieden en regiodagen</NuxtLink>.</p>
            <div v-else class="tabel-wrap">
              <table class="tabel" data-test="ma-regiotabel">
                <thead><tr><th>Regio</th><th>Vaste dag</th><th class="cel-r">Prospects</th><th class="ma-balkkolom">Meetingdekking</th><th class="cel-r">Achter / nooit</th><th aria-label="Openen" /></tr></thead>
                <tbody>
                  <tr v-for="r in data.regios" :key="r.regioId">
                    <td><strong>{{ r.naam }}</strong></td>
                    <td><span class="pil" :class="r.regiodag ? '' : 'pil--leeg'">{{ r.regiodag ?? 'Geen' }}</span></td>
                    <td class="cel-r">{{ r.prospects }}</td>
                    <td><DekkingBalk :gezien="r.opSchema" :stil="r.achter" :nooit="r.nooit" /></td>
                    <td class="cel-r"><span :class="{ 'ma-rood': r.achter + r.nooit > 0 }">{{ r.achter + r.nooit }}</span></td>
                    <td><button type="button" class="dd-act" :disabled="!r.totaal" @click="openRegio(r)">Openen</button></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </template>

      <AnalyseAccountFlyout :open="lijst.open" :kicker="lijst.kicker" :titel="lijst.titel" :accounts="lijstAccounts" kolom-laatste="Laatste meeting" plan-label="Meeting" @sluit="lijst.open = false" @plan="(a) => { lijst.open = false; nieuweAfspraak(a) }" />
      <PlanAfspraakFlyout :open="plan.open" :account="plan.account" :voorstel="{ vorm: 'online', soort: 'kennismaking' }" @sluit="plan.open = false" @gepland="plan.open = false" />
    </template>
  </div>
</template>

<style scoped>
.ma-terug { display: inline-flex; align-items: center; min-height: 32px; }
.ma-caret { margin-left: 2px; transition: transform var(--transition-fast); }
.ma-caret--open { transform: rotate(180deg); }
.ma-filterknop--aan { border-color: var(--ink); }
.ma-hint { font-size: 12px; color: var(--muted); }
.ma-balkkolom { width: 200px; }
.ma-rood { color: var(--red); font-weight: 700; }
.ma-blokkop { margin-bottom: 16px; }
.ma-bloktitel { margin: 8px 0 4px; font-family: var(--font-serif); font-size: 24px; font-weight: 700; }
.ma-subtitel { margin: 0; max-width: 72ch; font-size: 14px; color: var(--ink-soft); }
.ma-vorm { margin-bottom: var(--kaart-gap, 16px); }
.ma-klein { display: none; }
.ma-lijst { list-style: none; margin: 0; padding: 0; gap: 8px; }
.ma-knop { display: flex; flex-direction: column; gap: 8px; width: 100%; min-height: 44px; padding: 14px 16px; text-align: left; background: var(--wit); border: 1px solid var(--border); border-radius: var(--radius); font: inherit; color: inherit; cursor: pointer; }
.ma-knop:disabled { cursor: default; opacity: 0.7; }
.ma-knop-kop { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; }
@media (max-width: 719px) { .ma-terug { min-height: 44px; } .ma-groot { display: none; } .ma-klein { display: grid; } .ma-bloktitel { font-size: 20px; } }
</style>
