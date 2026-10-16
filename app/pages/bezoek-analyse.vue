<script setup lang="ts">
// Bezoekanalyse (F10, F18) in de opzet van DealDrive /bezoek-analyse: "Waar laat je omzet liggen?".
// Kop met terug naar Bezoeken, + Afspraak, Filters (periode, type bezoek, voor de salesmanager eigen
// of team en een persoon) en Download. Cijfers, de dekkingstabel per regio (gesorteerd op wat stil
// ligt, altijd met Zonder regio) met per regio de accounts in een flyout, dan wat de bezoeken in de
// periode opleverden, de regiodagen met hun routes, de kansen langs de route en de kaart.
// /analyse/regio stuurt hierheen door.
import type { FlyoutAccount } from '~~/shared/afspraakAnalyse'

const route = useRoute()
const { functie } = useMe()
const aan = computed(() => !!functie('regio.analyse')?.beschikbaar)
const magInrichten = computed(() => !!functie('instellingen.gebieden')?.beschikbaar)
const magKlaarzetten = computed(() => !!functie('bezoeken.klaarzetten')?.beschikbaar)
const SLEUTELS = ['venster', 'van', 'tot', 'soort', 'scope', 'persoon'] as const
const query = computed(() => Object.fromEntries(SLEUTELS.map((k) => [k, typeof route.query[k] === 'string' ? route.query[k] : undefined]).filter(([, v]) => v)))
const { data, status } = await useFetch<any>('/api/bezoek-analyse', { query, immediate: aan.value, default: () => null })
const filtersOpen = ref(false)
const filterTeller = computed(() => (query.value.venster ? 1 : 0) + (query.value.soort ? 1 : 0) + (query.value.scope === 'team' ? 1 : 0) + (query.value.persoon ? 1 : 0))

const persoonNaam = computed(() => data.value?.bereik.leden.find((l: any) => l.id === data.value?.bereik.persoon)?.naam ?? null)
const kicker = computed(() => ['Rapportage', 'Bezoekanalyse', data.value?.bereik.scope === 'team' ? (persoonNaam.value ?? 'Team') : null].filter(Boolean).join(' · '))
const soortNaam = computed(() => data.value?.soorten.find((s: any) => s.slug === data.value?.soort)?.naam ?? null)
const vensterTekst = computed(() => {
  const v = data.value?.venster
  if (!v) return ''
  return v.venster === 'periode' ? `van ${datumKort(v.van)} tot en met ${datumKort(v.tot)}` : v.binnen.replace('binnen', 'in de laatste')
})
const datumKort = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const datumLang = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

const tegels = computed(() => {
  const k = data.value?.kpi
  const v = data.value?.venster
  if (!k || !v) return []
  return [
    { waarde: k.inBeeld, label: 'Accounts in beeld', voet: `${k.inEenRegio} in een regio · ${k.inBeeld - k.inEenRegio} zonder regio`, test: 'ba-kpi-inbeeld' },
    { waarde: k.stilOfNooit, label: soortNaam.value ? `Stil of nooit: ${soortNaam.value.toLowerCase()}` : 'Stil of nooit bezocht', voet: `${k.nooit} nooit · ${k.stil} ${v.buiten}`, rood: k.stilOfNooit > 0, test: 'ba-kpi-stil' },
    { waarde: k.nietBenaderd, label: 'Nog niet benaderde prospects', voet: `${k.gekwalificeerdZonderContact} gekwalificeerd zonder contact in 60 dagen`, test: 'ba-kpi-nietbenaderd' },
    { waarde: `${k.dekking}%`, label: v.venster === 'periode' ? 'Bezocht in de periode' : `Bezocht in ${v.dagen} dagen`, voet: v.venster === 'periode' ? `${datumKort(v.van)} t/m ${datumKort(v.tot)} · doel ${k.doel}%` : `doel: ${k.doel}%`, rood: k.dekking < k.doel, test: 'ba-kpi-dekking' },
  ]
})
// Zonder regio alleen als er accounts buiten elke regio vallen.
const zichtbareRegios = computed(() => (data.value?.regios ?? []).filter((r: any) => r.regioId || r.totaal))
const ernst = (r: any) => { const d = r.totaal ? (r.stil + r.nooit) / r.totaal : 0; return d >= 0.5 ? 'ba-rood' : d >= 0.25 ? 'ba-oranje' : '' }

// De accounts van één regio in de flyout; null is "Zonder regio".
const lijst = reactive({ open: false, regioId: null as string | null, naam: '' })
function openRegio(r: any) { Object.assign(lijst, { open: true, regioId: r.regioId, naam: r.naam }) }
const bekend = computed(() => new Set((data.value?.regios ?? []).filter((r: any) => r.regioId).map((r: any) => r.regioId)))
const lijstAccounts = computed<FlyoutAccount[]>(() => (data.value?.accounts ?? [])
  .filter((a: any) => (lijst.regioId ? a.regioId === lijst.regioId : !a.regioId || !bekend.value.has(a.regioId)))
  .map((a: any) => ({ id: a.id, naam: a.naam, soort: a.soort, klasse: a.klasse, plaats: a.plaats, laatste: a.laatste, laatsteSoort: a.laatsteSoort, dagenGeleden: a.dagenGeleden, toon: a.dekking === 'gezien' ? 'goed' : a.dekking })))
const plan = reactive({ open: false, account: null as null | { id: string; naam: string } })
const klaar = reactive({ open: false, account: null as null | { id: string; naam: string } })
function nieuweAfspraak(account: { id: string; naam: string } | null = null) { Object.assign(plan, { open: true, account }) }

// Kaart: rood nooit bezocht, grijs stil, groen bezocht in de periode, blauw klant.
const kaartPunten = computed(() => (data.value?.accounts ?? []).filter((a: any) => a.punt).map((a: any) => ({ punt: a.punt, kleur: a.soort === 'klant' ? 'blauw' : a.dekking === 'nooit' ? 'rood' : a.dekking === 'stil' ? 'grijs' : 'groen', titel: a.naam })))
// De routetabel toont eerst de tien recentste dagen.
const alleDagen = ref(false)
const routeDagen = computed(() => (alleDagen.value ? data.value?.routes.dagen ?? [] : (data.value?.routes.dagen ?? []).slice(0, 10)))
const duur = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}u${min % 60 ? ` ${String(min % 60).padStart(2, '0')}` : ''}` : `${min} min`)

function download() {
  const d = data.value
  if (!d) return
  const regio = new Map(d.regios.map((r: any) => [r.regioId, r]))
  const DEKKING: Record<string, string> = { gezien: 'bezocht in de periode', stil: 'stil', nooit: 'nooit bezocht' }
  bewaarCsv(`bezoekanalyse-${d.venster.van}-tot-${d.venster.tot}.csv`, [
    { sleutel: 'account', label: 'Account' }, { sleutel: 'soort', label: 'Soort' }, { sleutel: 'klasse', label: 'Klasse' }, { sleutel: 'regio', label: 'Regio' },
    { sleutel: 'regiodag', label: 'Vaste dag' }, { sleutel: 'plaats', label: 'Plaats' }, { sleutel: 'dekking', label: 'Dekking' }, { sleutel: 'laatste', label: 'Laatste bezoek' }, { sleutel: 'type', label: 'Soort bezoek' },
  ], d.accounts.map((a: any) => {
    const r: any = regio.get(a.regioId) ?? regio.get(null)
    return { account: a.naam, soort: a.soort === 'klant' ? 'Klant' : 'Prospect', klasse: a.klasse ?? '', regio: r?.naam ?? 'Zonder regio', regiodag: r?.regiodag ?? '', plaats: a.plaats ?? '', dekking: DEKKING[a.dekking] ?? a.dekking, laatste: a.laatste ? a.laatste.slice(0, 10) : 'nooit', type: a.laatsteSoort ?? '' }
  }))
}
useHead({ title: 'Bezoekanalyse · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="regio.analyse" />
    <template v-else>
      <PaginaKop helpartikel="gebieden-en-regiodagen">
        <template #kicker>
          <nav class="breadcrumb" aria-label="Kruimelpad"><NuxtLink to="/bezoeken" class="breadcrumb-link ba-terug" data-test="ba-terug">← Terug naar Bezoeken</NuxtLink></nav>
          <span class="kicker kicker--streep" data-test="ba-kicker">{{ kicker }}</span>
        </template>
        <template #titel><h1 class="title title--groot">Waar laat je omzet liggen?</h1></template>
        <template #uitleg><p class="subtitle subtitle--groot">Per regio: hoeveel accounts, wie je in de periode bezocht en wie stil ligt. De regio's staan gesorteerd op wat er stil ligt, niet op alfabet.</p></template>
        <template #acties>
          <button type="button" class="dd-actie dd-actie--zwart" data-test="ba-afspraak" @click="nieuweAfspraak()"><Icoon naam="Plus" class="dd-actie-icoon" />Afspraak</button>
          <button type="button" class="dd-actie dd-actie--secundair" :class="{ 'ba-filterknop--aan': filtersOpen || filterTeller }" :aria-expanded="filtersOpen" data-test="ba-filters" @click="filtersOpen = !filtersOpen">
            <Icoon naam="SlidersHorizontal" class="dd-actie-icoon" />Filters<span v-if="filterTeller" class="pil-teller pil-teller--geel">{{ filterTeller }}</span><Icoon naam="ChevronDown" :grootte="14" class="ba-caret" :class="{ 'ba-caret--open': filtersOpen }" />
          </button>
          <button type="button" class="dd-actie dd-actie--secundair" :disabled="!data" data-test="ba-download" @click="download"><Icoon naam="Download" class="dd-actie-icoon" />Download</button>
        </template>
      </PaginaKop>

      <AnalyseFilterpaneel v-if="filtersOpen && data" :venster="data.venster" :soorten="data.soorten" soort-label="Type bezoek" :bereik="data.bereik" />

      <section v-if="!data" class="section"><div class="container"><p class="meta">{{ status === 'error' ? 'De analyse kon niet laden. Probeer het opnieuw.' : 'Bezig met rekenen…' }}</p></div></section>
      <template v-else>
        <section class="section">
          <div class="container">
            <LegeStaat v-if="!data.kpi.inBeeld" kicker="NOG LEEG" :titel="data.bereik.scope === 'team' ? 'Er staan nog geen accounts op naam van dit team.' : 'Er staan nog geen accounts op jouw naam.'" tekst="Deze analyse rekent alleen met de eigen portefeuille. Vraag je beheerder om accounts toe te wijzen, of neem prospects over via de Leadgenerator." data-test="ba-leeg" />
            <AnalyseTegels v-else :tegels="tegels" data-test="ba-cijfers" />
          </div>
        </section>

        <section v-if="data.kpi.inBeeld" class="section section--alt" data-test="ba-regios">
          <div class="container">
            <LegeStaat v-if="data.geenRegios" kicker="GEEN GEBIEDSINDELING" titel="Er is nog geen gebiedsindeling." tekst="Deze pagina rekent, hij richt niets in. Zolang er geen regio's zijn, valt elk account onder Zonder regio en valt er niets te vergelijken.">
              <NuxtLink v-if="magInrichten" to="/instellingen/gebieden" class="dd-actie dd-actie--primair mt-16">Gebiedsindeling instellen</NuxtLink>
              <p v-else class="meta mt-8">Vraag je beheerder om de regio's in te richten onder Instellingen, Gebieden en regiodagen.</p>
            </LegeStaat>
            <template v-else>
              <div class="tabel-wrap ba-groot">
                <table class="tabel" data-test="regio-tabel">
                  <thead><tr><th>Regio</th><th>Vaste dag</th><th class="cel-r">Klanten</th><th class="cel-r">Prospects</th><th class="cel-r">Nog niet benaderd</th><th class="ba-balkkolom">Bezoekdekking</th><th class="cel-r">Stil / nooit</th><th aria-label="Openen" /></tr></thead>
                  <tbody>
                    <tr v-for="r in zichtbareRegios" :key="r.regioId ?? 'zonder'" :class="{ 'is-open': lijst.open && lijst.regioId === r.regioId, 'ba-rij--zonder': !r.regioId }" :data-test="`regio-rij-${r.regioId ?? 'zonder'}`">
                      <td><strong>{{ r.naam }}</strong><br><span class="ba-hint">{{ r.beschrijving || '—' }}</span></td>
                      <td><span v-if="r.regioId" class="pil" :class="r.regiodag ? 'pil--geel' : 'pil--grijs'">{{ r.regiodag ?? 'Geen' }}</span><span v-else>—</span></td>
                      <td class="cel-r">{{ r.klanten }}</td><td class="cel-r">{{ r.prospects }}</td><td class="cel-r">{{ r.nietBenaderd }}</td>
                      <td><DekkingBalk :gezien="r.gezien" :stil="r.stil" :nooit="r.nooit" :titel="`${r.gezien} ${data.venster.binnen} · ${r.stil} ${data.venster.buiten} · ${r.nooit} nooit bezocht`" /></td>
                      <td class="cel-r" :class="ernst(r)">{{ r.stil + r.nooit }}</td>
                      <td><button type="button" class="dd-act" :disabled="!r.totaal" :data-test="`regio-open-${r.regioId ?? 'zonder'}`" @click="openRegio(r)">Openen</button></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <ul class="ba-klein ba-regiolijst">
                <li v-for="r in zichtbareRegios" :key="r.regioId ?? 'zonder'">
                  <button type="button" class="ba-regioknop" :disabled="!r.totaal" @click="openRegio(r)">
                    <span class="ba-regioknop-kop"><strong>{{ r.naam }}</strong><span class="tnum" :class="ernst(r)">{{ r.stil + r.nooit }} stil of nooit</span></span>
                    <DekkingBalk :gezien="r.gezien" :stil="r.stil" :nooit="r.nooit" />
                    <span class="ba-hint">{{ r.dekking }}% bezocht · {{ r.klanten }} klanten · {{ r.prospects }} prospects<template v-if="r.regiodag"> · {{ r.regiodag }}</template></span>
                  </button>
                </li>
              </ul>
              <DekkingLegenda :gezien="data.venster.binnen" :stil="data.venster.buiten" nooit="nooit bezocht" />
            </template>
          </div>
        </section>

        <section class="section" data-test="ba-bezoeken">
          <div class="container">
            <header class="ba-blokkop">
              <span class="kicker kicker--streep">Bezoeken {{ vensterTekst }}</span>
              <h2 class="ba-bloktitel">Wat leverden je bezoeken op?</h2>
              <p class="ba-subtitel">Gehouden bezoeken met hun uitkomst, verslag en vervolg. De doorlooptijd telt de dagen tot de volgende afspraak met hetzelfde account.</p>
            </header>
            <AfspraakCijfersBlok :cijfers="data.cijfers" :per-soort="data.perSoort" eenheid="bezoeken" soort-kop="Bezoeksoort" :venster-tekst="vensterTekst" />
          </div>
        </section>

        <section class="section section--alt" data-test="ba-routes">
          <div class="container">
            <header class="ba-blokkop">
              <span class="kicker kicker--streep">Regiodagen en routes</span>
              <h2 class="ba-bloktitel">Benut je je regiodagen?</h2>
              <p class="ba-subtitel">Per dag de regiodag uit de gebiedsindeling en de bezoeken van die dag, met de geschatte afstand tussen de stops (hemelsbreed maal 1,3, zonder start- en eindadres).</p>
            </header>
            <AnalyseTegels klein :tegels="[
              { waarde: data.routes.samenvatting.regiodagen, label: 'Regiodagen', voet: `${data.routes.samenvatting.benut} benut · ${data.routes.samenvatting.leeg} zonder bezoek`, rood: data.routes.samenvatting.leeg > 0, test: 'ba-regiodagen' },
              { waarde: String(data.routes.samenvatting.gemiddeld).replace('.', ','), label: 'Bezoeken per regiodag', voet: `${data.routes.samenvatting.bezoekenOpRegiodag} bezoeken op een regiodag` },
              { waarde: `${data.routes.samenvatting.inRegio}%`, label: 'In de regio van de dag', voet: 'bezoeken op een regiodag binnen die regio' },
              { waarde: `${data.routes.samenvatting.km} km`, label: 'Gereden tussen stops', voet: `${data.routes.samenvatting.bezoekdagen} bezoekdagen · ${duur(data.routes.samenvatting.rijMin)} rijden` },
            ]" />
            <LegeStaat v-if="!data.routes.dagen.length" class="mt-16" titel="Geen regiodagen of bezoeken in deze periode." tekst="Regiodagen stel je in bij Gebieden en regiodagen; een bezoek komt hier zodra het in de agenda staat." />
            <div v-else class="tabel-wrap mt-16">
              <table class="tabel" data-test="ba-routetabel">
                <thead><tr><th>Datum</th><th v-if="data.bereik.scope === 'team'">Wie</th><th>Regiodag</th><th class="cel-r">Bezoeken</th><th class="cel-r">In de regio</th><th class="cel-r">Km</th><th class="cel-r">Rijtijd</th></tr></thead>
                <tbody>
                  <tr v-for="d in routeDagen" :key="`${d.gebruikerId}-${d.datum}`">
                    <td>{{ datumLang(d.datum) }}</td>
                    <td v-if="data.bereik.scope === 'team'">{{ d.gebruiker }}</td>
                    <td><span v-if="d.regioNaam" class="pil pil--geel">{{ d.regioNaam }}</span><span v-else class="ba-hint">geen regiodag</span></td>
                    <td class="cel-r" :class="{ 'ba-rood': d.regioId && !d.bezoeken }">{{ d.bezoeken }}</td>
                    <td class="cel-r">{{ d.regioId ? d.inRegio : '—' }}</td>
                    <td class="cel-r">{{ d.bezoeken > 1 ? d.km : '—' }}</td>
                    <td class="cel-r">{{ d.bezoeken > 1 ? duur(d.rijMin) : '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <button v-if="data.routes.dagen.length > 10" type="button" class="dd-act mt-8" data-test="ba-routes-meer" @click="alleDagen = !alleDagen">{{ alleDagen ? 'Toon minder' : `Toon alle ${data.routes.dagen.length} dagen` }}</button>
          </div>
        </section>

        <section class="section" data-test="ba-kansen">
          <div class="container">
            <header class="ba-blokkop">
              <span class="kicker kicker--streep">Kansen langs de route</span>
              <h2 class="ba-bloktitel">Wat nam je onderweg mee?</h2>
            </header>
            <AnalyseTegels klein :tegels="[
              { waarde: data.kansen.inloop, label: 'Inloopbezoeken', voet: 'ongepland binnengelopen langs de route', test: 'ba-inloop' },
              { waarde: data.kansen.klaargezetVoor, label: 'Klaargezet voor je regiodag', voet: `${data.kansen.klaargezetOpen} open · ${data.kansen.klaargezetIngepland} ingepland · ${data.kansen.klaargezetVervallen} vervallen` },
              { waarde: data.kansen.klaargezetDoor, label: 'Klaargezet voor een collega', voet: 'door jou voor de buitendienst' },
              { waarde: data.kansen.overgeslagen, label: 'Kansen overgeslagen', voet: data.kansen.redenen.length ? data.kansen.redenen.map((r: any) => `${r.reden} (${r.aantal})`).join(' · ') : 'geen kans overgeslagen' },
            ]" />
          </div>
        </section>

        <section v-if="kaartPunten.length" class="section section--laatste" data-test="ba-kaart">
          <div class="container">
            <header class="ba-blokkop"><span class="kicker kicker--streep">Kaart</span><h2 class="ba-bloktitel">Waar ligt het stil?</h2></header>
            <KaartSchets :punten="[]" :stops="[]" :extra="kaartPunten" />
            <p class="meta mt-8">Rood nooit bezocht · grijs stil · groen bezocht {{ data.venster.binnen }} · blauw klant</p>
          </div>
        </section>
      </template>

      <AnalyseAccountFlyout :open="lijst.open" kicker="Bezoekdekking" :titel="lijst.naam" :accounts="lijstAccounts" kolom-laatste="Laatste bezoek" plan-label="Afspraak" :klaarzetten="magKlaarzetten" @sluit="lijst.open = false" @plan="(a) => { lijst.open = false; nieuweAfspraak(a) }" @klaarzet="(a) => { lijst.open = false; Object.assign(klaar, { open: true, account: a }) }" />
      <PlanAfspraakFlyout :open="plan.open" :account="plan.account" :voorstel="{ vorm: 'bezoek' }" @sluit="plan.open = false" @gepland="plan.open = false" />
      <KlaarzetFlyout :open="klaar.open" :account="klaar.account" @sluit="klaar.open = false" />
    </template>
  </div>
</template>

<style scoped>
.ba-terug { display: inline-flex; align-items: center; min-height: 32px; }
.ba-caret { margin-left: 2px; transition: transform var(--transition-fast); }
.ba-caret--open { transform: rotate(180deg); }
.ba-filterknop--aan { border-color: var(--ink); }
.ba-hint { font-size: 12px; color: var(--muted); }
.ba-balkkolom { width: 200px; }
.ba-rood { color: var(--red); font-weight: 700; }
.ba-oranje { color: var(--orange-dark, var(--orange)); font-weight: 700; }
.ba-rij--zonder td { background: var(--bg); }
.ba-blokkop { margin-bottom: 16px; }
.ba-bloktitel { margin: 8px 0 4px; font-family: var(--font-serif); font-size: 24px; font-weight: 700; }
.ba-subtitel { margin: 0; max-width: 72ch; font-size: 14px; color: var(--ink-soft); }
.ba-regiolijst { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.ba-klein { display: none; }
.ba-regioknop { display: flex; flex-direction: column; gap: 8px; width: 100%; min-height: 44px; padding: 14px 16px; text-align: left; background: var(--wit); border: 1px solid var(--border); border-radius: var(--radius); font: inherit; color: inherit; cursor: pointer; }
.ba-regioknop:disabled { cursor: default; opacity: 0.7; }
.ba-regioknop-kop { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; }
@media (max-width: 719px) { .ba-terug { min-height: 44px; } .ba-groot { display: none; } .ba-klein { display: grid; } .ba-bloktitel { font-size: 20px; } }
</style>
