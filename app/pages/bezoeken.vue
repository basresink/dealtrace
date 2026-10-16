<script setup lang="ts">
// Bezoeken (F10) in de opzet van DealDrive: kop met werkbalk (Zoeken, + Afspraak, Filters, Meer met Agenda en Bezoekanalyse),
// een uitklapbaar filterpaneel (periode en de kansfilters), je week met regiodagen, de kaart met
// legenda naast de routelijst per dag en de zwarte statistiekstrook, dan de kansen langs de route,
// de bellijst (Top 5 of Top 10) en de te plannen bezoeken. Op de telefoon door naar Onderweg (P30).
import { nlMoment, plusDagen } from '~~/shared/datum'
import { duurLabel, kaartLink, OVERSLA_REDENEN, type Kaartapp } from '~~/shared/route'
const route = useRoute()
const router = useRouter()
const toast = useToast()
const klasse = useSchermklasse()
onMounted(() => { if (klasse.value === 'telefoon') navigateTo('/onderweg', { replace: true }) })
const zet = (q: Record<string, string | undefined>) => router.replace({ query: { ...route.query, ...q } })
const q = computed(() => ({ ...route.query }))
const { data, refresh, status } = await useFetch<any>('/api/bezoeken', { query: q, default: () => null })
const tijd = (iso: string) => new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })
const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('nl-NL', { ...o, timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`))
const dagLabel = (d: string) => fmt(d, { weekday: 'long', day: 'numeric', month: 'long' })
const kortDatum = (iso: string) => new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' })
const vandaag = nlMoment(new Date()).datum
const morgen = plusDagen(vandaag, 1)
const maandagVan = (d: string) => plusDagen(d, -((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7))
const app = computed<Kaartapp>(() => data.value?.kaartapp ?? 'google')
const week = computed(() => data.value?.weergave === 'week')

// Periode: vaste keuzes zoals in DealDrive, plus een eigen datum. De dag staat in ?datum=.
type Periode = 'vandaag' | 'morgen' | 'deze-week' | 'volgende-week' | 'datum'
const periode = computed<Periode>(() => {
  const d = data.value?.dag ?? vandaag
  if (week.value) return maandagVan(d) === maandagVan(vandaag) ? 'deze-week' : maandagVan(d) === plusDagen(maandagVan(vandaag), 7) ? 'volgende-week' : 'datum'
  return d === vandaag ? 'vandaag' : d === morgen ? 'morgen' : 'datum'
})
const PERIODES: { id: Exclude<Periode, 'datum'>; label: string; query: Record<string, string | undefined> }[] = [
  { id: 'vandaag', label: 'Vandaag', query: { datum: undefined, weergave: undefined } },
  { id: 'morgen', label: 'Morgen', query: { datum: morgen, weergave: undefined } },
  { id: 'deze-week', label: 'Deze week', query: { datum: undefined, weergave: 'week' } },
  { id: 'volgende-week', label: 'Volgende week', query: { datum: plusDagen(maandagVan(vandaag), 7), weergave: 'week' } },
]
const periodeLabel = computed(() => {
  if (!data.value) return ''
  if (week.value) return periode.value === 'deze-week' ? 'Deze week' : periode.value === 'volgende-week' ? 'Volgende week' : `Week van ${fmt(maandagVan(data.value.dag), { day: 'numeric', month: 'long' })}`
  return data.value.dag === vandaag ? 'Vandaag' : data.value.dag === morgen ? 'Morgen' : dagLabel(data.value.dag)
})
const kicker = computed(() => ['Bezoeken', periodeLabel.value, !week.value ? data.value?.regio?.naam : null].filter(Boolean).join(' · '))
const weekStops = computed(() => (data.value?.weekdagen ?? []).flatMap((d: any) => d.stops))
const aantal = computed(() => (week.value ? weekStops.value.length : data.value?.stops.length ?? 0))
const titel = computed(() => (aantal.value === 0 ? 'Geen bezoeken gepland.' : aantal.value === 1 ? 'Eén bezoek op de planning.' : `${aantal.value} bezoeken op de planning.`))

// Filters: periode en de kansfilters in één paneel; de teller telt wat afwijkt van de standaard.
const filtersOpen = ref(false)
const KANSFILTERS = ['bron', 'maxOmrij', 'aantal', 'alleenMijn', 'alleenProspects', 'ongepland'] as const
const filterTeller = computed(() => (periode.value !== 'vandaag' ? 1 : 0) + KANSFILTERS.filter((k) => route.query[k] != null).length)
const heeftFilters = computed(() => !!(data.value?.kan.periode || data.value?.kan.kansenAlle))

// Je week: dag kiezen, week vooruit of terug, of de hele week.
const weekdagen = computed(() => data.value?.weekdagen ?? [])
const naarWeek = (stap: number) => zet({ datum: plusDagen(maandagVan(data.value?.dag ?? vandaag), stap * 7), weergave: week.value ? 'week' : undefined })

// Routelijst: één blok per dag (in de week alleen de dagen met bezoeken).
const dagGroepen = computed(() => {
  if (!data.value) return []
  if (!week.value) return [{ datum: data.value.dag, stops: data.value.stops, vanaf: 0 }]
  let n = 0
  return weekdagen.value.filter((d: any) => d.stops.length).map((d: any) => { const g = { datum: d.datum, stops: d.stops, vanaf: n }; n += d.stops.length; return g })
})
const kaartStops = computed(() => (week.value ? weekStops.value : data.value?.stops ?? []).map((s: any) => ({ id: s.id, punt: s.punt, volgende: !week.value && s.volgende, label: s.accountNaam })))
const stat = computed(() => {
  if (!data.value) return null
  if (!week.value) return { bezoeken: data.value.stat.bezoeken, contact: duurLabel(data.value.stat.contactMin), rij: duurLabel(data.value.stat.rijMin), km: data.value.stat.km }
  const t = weekdagen.value.reduce((s: any, d: any) => ({ b: s.b + d.stat.bezoeken, c: s.c + d.stat.contactMin, r: s.r + d.stat.rijMin, k: s.k + d.stat.km }), { b: 0, c: 0, r: 0, k: 0 })
  return { bezoeken: t.b, contact: duurLabel(t.c), rij: duurLabel(t.r), km: t.k }
})

// Flyouts
const plan = reactive({ open: false, account: null as null | { id: string; naam: string }, taskId: null as string | null, aanleiding: '', voorstel: null as any })
function nieuweAfspraak() { Object.assign(plan, { open: true, account: null, taskId: null, aanleiding: '', voorstel: { vorm: 'bezoek', datum: data.value?.dag } }) }
function tussenstop(k: any) {
  const start = k.momentStart ? tijd(k.momentStart).replace(/:(\d)\d$/, (_m: string, t: string) => `:${Number(t) >= 3 ? '30' : '00'}`) : undefined
  Object.assign(plan, { open: true, account: { id: k.id, naam: k.naam }, taskId: k.taakId ?? null, aanleiding: k.bronnen[0]?.label ?? '', voorstel: { datum: data.value.dag, start, duurMin: 30, vorm: 'bezoek', soort: 'kennismaking' } })
}
function planBezoek(t: any) { Object.assign(plan, { open: true, account: t.accountId ? { id: t.accountId, naam: t.accountNaam } : null, taskId: t.id, aanleiding: t.titel, voorstel: { vorm: 'bezoek', soort: 'inventarisatie' } }) }
async function gepland() { plan.open = false; await refresh() }
const afspraak = ref<string | null>(null)
const overslaan = ref<any>(null)
const reden = ref('')
async function slaOver() {
  try { await $fetch(`/api/kansen/${overslaan.value.id}/overslaan`, { method: 'POST', body: { reden: reden.value } }); toast.toon(`${overslaan.value.naam} komt 7 dagen niet terug.`); overslaan.value = null; reden.value = ''; await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function inloop(k: any) {
  try { const r: any = await $fetch('/api/afspraken/inloop', { method: 'POST', body: { accountId: k.id } }); toast.toon(r.tekst); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const bronnen = (k: any) => [...new Set<string>(k.bronnen.map((b: any) => b.label))]
const opbouw = (k: any) => k.opbouw.map((o: any) => `${o.label} ${o.punten >= 0 ? '+' : ''}${o.punten}`).join(' · ')
// Bellijst: Top 5 of Top 10, dezelfde rangorde als op Belblokken zonder wie je vandaag bezoekt.
const belTop = ref<5 | 10>(5)
const bellijst = computed(() => (data.value?.bellijst ?? []).slice(0, belTop.value))
useHead({ title: 'Bezoeken · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop :kicker="kicker" :titel="titel" uitleg="Bezoeken op de kaart en op tijd gesorteerd. Het volgende bezoek pulseert rood; kansen langs je route neem je onderweg mee." helpartikel="bezoeken-en-kansen-langs-de-route">
      <template #acties>
        <button type="button" class="dd-actie dd-actie--zwart" data-test="plus-bezoek" @click="nieuweAfspraak"><Icoon naam="Plus" class="dd-actie-icoon" />Afspraak</button>
        <button v-if="heeftFilters" type="button" class="dd-actie dd-actie--secundair" :class="{ 'bz-toggle--aan': filtersOpen || filterTeller }" :aria-expanded="filtersOpen" data-test="bz-filters" @click="filtersOpen = !filtersOpen">
          <Icoon naam="SlidersHorizontal" class="dd-actie-icoon" />Filters<span v-if="filterTeller" class="pil-teller pil-teller--geel">{{ filterTeller }}</span><Icoon naam="ChevronDown" :grootte="14" class="bz-caret" :class="{ 'bz-caret--open': filtersOpen }" />
        </button>
        <KopMeer :items="[{ label: 'Agenda', icoon: 'Calendar', to: '/agenda?weergave=dag', test: 'bz-agenda' }, ...(data?.kan.analyse ? [{ label: 'Bezoekanalyse', icoon: 'ChartLine', to: '/bezoek-analyse', test: 'bezoekanalyse-knop' }] : [])]" />
      </template>
    </PaginaKop>

    <section v-if="data && filtersOpen" class="section section--filter" data-test="bz-filterpaneel">
      <div class="container filters">
        <div v-if="data.kan.periode" class="filter-groep" data-test="periode">
          <span class="filter-label">Periode</span>
          <button v-for="p in PERIODES" :key="p.id" type="button" class="filter-pil" :class="{ 'filter-pil--aan': periode === p.id }" :data-test="`periode-${p.id}`" @click="zet(p.query)">{{ p.label }}</button>
          <label class="datum-veld"><span class="filter-label">Datum</span><input type="date" class="invoer invoer--klein bz-datum" :class="{ 'bz-datum--aan': periode === 'datum' }" :value="data.dag" data-test="periode-datum" @change="zet({ datum: ($event.target as HTMLInputElement).value || undefined })"></label>
        </div>
        <template v-if="data.kan.kansenAlle">
          <div class="filter-groep">
            <span class="filter-label">Kansen</span>
            <select class="invoer invoer--klein bz-filtersel" aria-label="Bron" :value="route.query.bron ?? ''" @change="zet({ bron: ($event.target as HTMLSelectElement).value || undefined })"><option value="">Alle bronnen</option><option value="bezoektaak">Open bezoektaak</option><option value="klaargezet">Klaargezet</option><option value="aanleiding">Hete aanleiding</option><option value="ritme">Bezoekritme achter</option><option value="ongepland">Ongepland</option></select>
            <select class="invoer invoer--klein bz-filtersel" aria-label="Maximale omrijtijd" :value="route.query.maxOmrij ?? '20'" @change="zet({ maxOmrij: ($event.target as HTMLSelectElement).value === '20' ? undefined : ($event.target as HTMLSelectElement).value })"><option value="10">10 min omrijden</option><option value="20">20 min omrijden</option><option value="30">30 min omrijden</option></select>
            <select class="invoer invoer--klein bz-filtersel" aria-label="Aantal" :value="route.query.aantal ?? '10'" @change="zet({ aantal: ($event.target as HTMLSelectElement).value === '10' ? undefined : ($event.target as HTMLSelectElement).value })"><option value="4">4 kansen</option><option value="10">10 kansen</option><option value="alles">Alle kansen</option></select>
          </div>
          <div class="filter-groep">
            <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': route.query.alleenMijn !== '0' }" :aria-pressed="route.query.alleenMijn !== '0'" @click="zet({ alleenMijn: route.query.alleenMijn === '0' ? undefined : '0' })">Alleen mijn accounts</button>
            <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': route.query.alleenProspects !== '0' }" :aria-pressed="route.query.alleenProspects !== '0'" @click="zet({ alleenProspects: route.query.alleenProspects === '0' ? undefined : '0' })">Alleen prospects</button>
            <button v-if="data.kan.eigenRegels" type="button" class="filter-pil" :class="{ 'filter-pil--aan': route.query.ongepland === '1' }" :aria-pressed="route.query.ongepland === '1'" @click="zet({ ongepland: route.query.ongepland === '1' ? undefined : '1' })">Ook ongeplande prospects</button>
          </div>
        </template>
      </div>
    </section>

    <section v-if="data" class="section section--alt">
      <div class="container">
        <p v-if="data.schatting || data.team.length" class="bz-route-van">
            <span v-if="data.schatting" class="pil pil--leeg">schatting</span>
            <label v-if="data.team.length">Route van <select class="invoer invoer--klein" :value="data.gebruiker.id" @change="zet({ gebruiker: ($event.target as HTMLSelectElement).value })"><option v-for="u in data.team" :key="u.id" :value="u.id">{{ u.naam.replace(/^Testgebruiker /, '') }}</option></select></label>
        </p>
        <nav v-if="weekdagen.length" class="bz-dagen" aria-label="Je week" data-test="bz-week">
          <button type="button" class="bz-pijl" aria-label="Vorige week" @click="naarWeek(-1)"><Icoon naam="ArrowLeft" /></button>
          <NuxtLink v-for="w in weekdagen" :key="w.datum" :to="{ query: { ...route.query, datum: w.datum, weergave: undefined } }" class="bz-dag" :class="{ 'bz-dag--aan': !week && w.datum === data.dag, 'bz-dag--vandaag': w.datum === vandaag }" :data-test="`week-dag-${w.datum}`">
            <span class="bz-dag-naam">{{ fmt(w.datum, { weekday: 'short', day: 'numeric' }) }}<span class="pil-teller">{{ w.stat.bezoeken }}</span></span>
            <span class="bz-dag-regio">{{ w.regio ?? 'geen regiodag' }}</span>
          </NuxtLink>
          <button type="button" class="bz-dag bz-dag--week" :class="{ 'bz-dag--aan': week }" data-test="weergave-week" @click="zet({ weergave: week ? undefined : 'week' })"><span class="bz-dag-naam">Hele week</span><span class="bz-dag-regio">{{ weekStops.length }} bezoeken</span></button>
          <button type="button" class="bz-pijl" aria-label="Volgende week" @click="naarWeek(1)"><Icoon naam="ArrowRight" /></button>
        </nav>

        <div class="bz-grid">
          <div class="bz-kaartkant">
            <KaartSchets :punten="week ? [] : data.punten" :stops="kaartStops" :kansen="week ? [] : data.kansen" />
            <div class="bz-legenda">
              <span><svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4" fill="var(--red)" /></svg>Volgend bezoek (pulserend)</span>
              <span><svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4" fill="var(--ink)" stroke="var(--yellow)" stroke-width="2" /></svg>Overige stops</span>
              <span v-if="!week"><svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4" fill="var(--yellow)" stroke="var(--ink)" stroke-width="1.5" /></svg>Kans langs de route</span>
            </div>
          </div>
          <div class="bz-lijstkant" data-test="routelijst">
            <BezoekRouteLijst v-for="g in dagGroepen" :key="g.datum" :datum="g.datum" :stops="g.stops" :nummer-vanaf="g.vanaf" :app="app" :leeg-tekst="'Geen bezoeken gepland op deze dag. Kansen in je regio staan hieronder.'" @open="afspraak = $event" />
            <div v-if="!dagGroepen.length" class="rl-leeg-week">Geen bezoeken gepland in deze week.</div>
            <div v-if="stat" class="bz-tellers" data-test="dagstat">
              <div class="bz-tel"><span class="bz-tel-num tnum">{{ stat.bezoeken }}</span><span class="bz-tel-label">Bezoeken</span></div>
              <div class="bz-tel"><span class="bz-tel-num tnum">{{ stat.contact }}</span><span class="bz-tel-label">Klantcontact</span></div>
              <div class="bz-tel"><span class="bz-tel-num tnum">{{ stat.rij }}</span><span class="bz-tel-label">Rijtijd</span></div>
              <div class="bz-tel"><span class="bz-tel-num tnum">{{ stat.km }}</span><span class="bz-tel-label">Geschat km</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section v-if="data" class="section">
      <div class="container" data-test="kansen">
        <header class="bz-blokkop">
          <div>
            <span class="kicker kicker--streep">Kansen langs de route · {{ data.kansen.length }}</span>
            <h2 class="bz-bloktitel">Accounts vlak bij je bezoeken van {{ data.dag === vandaag ? 'vandaag' : dagLabel(data.dag) }}</h2>
            <p class="bz-subtitel">Op score: open bezoektaken, klaargezette accounts, hete aanleidingen en een achterlopend ritme, min de omrijtijd.</p>
          </div>
        </header>
        <LegeStaat v-if="!data.kansen.length && status !== 'pending'" titel="Geen kansen binnen deze omrijtijd." tekst="Zet de maximale omrijtijd hoger of toon ook ongeplande prospects onder Filters." />
        <div class="bz-knlijst">
          <article v-for="k in data.kansen" :key="k.id" class="bz-kn" :data-test="`kans-${k.id}`">
            <span class="bz-kn-nr tnum">{{ k.rang }}</span>
            <div class="bz-kn-body">
              <h3 class="bz-kn-titel"><NuxtLink :to="`/accounts/${k.id}`">{{ k.naam }}</NuxtLink> <span v-if="k.faseId" class="pil pil--grijs">{{ k.faseId }}</span></h3>
              <p v-for="b in bronnen(k)" :key="b" class="bz-kn-bron">{{ b }}</p>
              <p class="bz-kn-meta"><span>{{ k.omrij }} min omrijden, {{ k.tussen }}</span><span v-if="k.schatting" class="pil pil--leeg">schatting</span><span v-if="k.moment">{{ k.moment }}</span></p>
              <p v-if="k.contact" class="bz-kn-meta">{{ k.contact.naam }}<template v-if="k.contact.rol"> · {{ k.contact.rol }}</template><template v-if="k.laatsteContactOp"> · laatste contact {{ new Date(k.laatsteContactOp).toLocaleDateString('nl-NL') }}</template></p>
              <p class="bz-opbouw" :title="opbouw(k)">Score {{ k.score }}: {{ opbouw(k) }}</p>
            </div>
            <div class="bz-kn-acties">
              <button type="button" class="dd-act dd-act--primair" :data-test="`tussenstop-${k.id}`" @click="tussenstop(k)"><Icoon naam="Plus" />Tussenstop</button>
              <NuxtLink v-if="data.kan.kansenAlle" class="dd-act" :to="`/accounts/${k.id}?bel=1`"><Icoon naam="Phone" />Eerst bellen</NuxtLink>
              <button v-if="data.kan.inloop" type="button" class="dd-act" :data-test="`inloop-${k.id}`" @click="inloop(k)">Inloopbezoek</button>
              <a class="dd-act" :href="kaartLink({ punt: k.punt }, app) ?? undefined" target="_blank" rel="noopener"><Icoon naam="Navigation" />Navigeer</a>
              <button type="button" class="dd-act" :data-test="`overslaan-${k.id}`" @click="overslaan = k">Overslaan</button>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section v-if="data" id="bellijst" class="section section--alt">
      <div class="container" data-test="bellijst-naast">
        <header class="bz-blokkop">
          <div>
            <span class="kicker kicker--streep">Bellijst · vandaag</span>
            <h2 class="bz-bloktitel">Bel-prioriteit naast je bezoeken</h2>
            <p class="bz-subtitel">Dezelfde lijst als op Belblokken, zonder de accounts die je vandaag al bezoekt. Tijdens reistijd de top 5, voor een lege middag de top 10.</p>
          </div>
          <div v-if="data.kan.bellijst" class="keuzegroep keuzegroep--klein" role="group" aria-label="Aantal">
            <button type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': belTop === 5 }" data-test="bel-top-5" @click="belTop = 5">Top 5</button>
            <button type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': belTop === 10 }" data-test="bel-top-10" @click="belTop = 10">Top 10</button>
          </div>
        </header>
        <NietAangezetKop v-if="!data.kan.bellijst" sleutel="bezoeken.bellijst" />
        <ol v-else-if="bellijst.length" class="bz-bel">
          <li v-for="(b, i) in bellijst" :key="b.accountId" class="bz-bel-rij">
            <span class="bz-bel-rang tnum">{{ Number(i) + 1 }}</span>
            <div class="bz-bel-info">
              <NuxtLink :to="`/accounts/${b.accountId}`" class="bz-bel-naam">{{ b.accountNaam }}</NuxtLink>
              <span class="bz-bel-reden">{{ b.reden }}</span>
              <span v-if="b.contactNaam" class="bz-bel-contact">{{ b.contactNaam }}<template v-if="b.telefoon"> · <a :href="`tel:${b.telefoon}`" class="tnum">{{ b.telefoon }}</a></template></span>
              <span class="bz-bel-pillen"><span class="pil pil--grijs">Score {{ b.score }}</span><span v-if="b.openTaken" class="pil pil--zwart">{{ b.openTaken }} open {{ b.openTaken === 1 ? 'taak' : 'taken' }}</span><span v-if="b.heet" class="pil pil--rood">Heet</span></span>
            </div>
            <a v-if="b.telefoon" class="dd-act" :href="`tel:${b.telefoon}`"><Icoon naam="Phone" />Bel</a>
            <NuxtLink v-else class="dd-act" :to="`/accounts/${b.accountId}?bel=1`"><Icoon naam="Phone" />Bel</NuxtLink>
          </li>
        </ol>
        <p v-else class="bz-leeg">Niemand om te bellen.</p>
      </div>
    </section>

    <section v-if="data" class="section section--laatste">
      <div class="container" data-test="te-plannen">
        <header class="bz-blokkop">
          <div>
            <span class="kicker kicker--streep">Bezoeklijst</span>
            <h2 class="bz-bloktitel">Te plannen bezoeken</h2>
            <p class="bz-subtitel">Open bezoektaken uit de motor en handmatig. Plan elk bezoek met één klik als afspraak, of cluster ze per regio tot een volle dag.</p>
          </div>
        </header>
        <NietAangezetKop v-if="!data.kan.teplannen" sleutel="bezoeken.teplannen" />
        <ol v-else-if="data.teplannen.length" class="bz-plan">
          <li v-for="t in data.teplannen" :key="t.id" class="bz-plan-rij">
            <div class="bz-plan-info">
              <NuxtLink v-if="t.accountId" :to="`/accounts/${t.accountId}`" class="bz-plan-naam">{{ t.accountNaam }}</NuxtLink>
              <span class="bz-plan-taak">{{ t.titel }}</span>
              <span class="bz-bel-pillen"><span class="pil pil--grijs">sinds {{ kortDatum(t.sinds) }}</span><span class="pil pil--groen">{{ t.herkomst === 'handmatig' ? 'handmatig' : 'motor' }}</span></span>
            </div>
            <button type="button" class="dd-act" :data-test="`plan-bezoek-${t.id}`" @click="planBezoek(t)"><Icoon naam="Plus" />Plan bezoek</button>
          </li>
        </ol>
        <p v-else class="bz-leeg">Geen open bezoektaken. Het bezoekritme is bij.</p>
      </div>
    </section>

    <PlanAfspraakFlyout :open="plan.open" :account="plan.account" :task-id="plan.taskId" :aanleiding="plan.aanleiding" :voorstel="plan.voorstel" @sluit="plan.open = false" @gepland="gepland" />
    <AfspraakFlyout :open="!!afspraak" :afspraak-id="afspraak" @sluit="afspraak = null" @gewijzigd="refresh()" />
    <Teleport to="body">
      <div v-if="overslaan" class="fo-overlay" @click.self="overslaan = null">
        <form class="fo-panel fo-panel--smal fo-panel--schuif" role="dialog" aria-modal="true" aria-labelledby="os-titel" @submit.prevent="slaOver">
          <header class="fo-head"><div class="fo-head-tekst"><span class="fo-kicker">Overslaan</span><h2 id="os-titel" class="fo-titel">{{ overslaan.naam }}</h2></div><button type="button" class="fo-sluit" aria-label="Sluiten" @click="overslaan = null"><Icoon naam="X" /></button></header>
          <div class="fo-body fo-body--formulier"><div class="uitkomst-raster"><button v-for="r in OVERSLA_REDENEN" :key="r" type="button" class="uitkomst-knop" :class="{ 'uitkomst-knop--actief': reden === r }" @click="reden = r">{{ r }}</button></div><p class="meta mt-8">De kans komt 7 dagen niet terug.</p></div>
          <footer class="fo-foot dd-acties"><span class="dd-acties-vul fo-foot-vul" /><button type="submit" class="dd-act dd-act--primair" :disabled="!reden" data-test="overslaan-bewaar">Overslaan</button></footer>
        </form>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.bz-toggle--aan { border-color: var(--ink); }
.bz-caret { transition: transform var(--transition-fast); }
.bz-caret--open { transform: rotate(180deg); }
.bz-datum, .bz-filtersel { width: auto; min-height: 36px; }
.bz-datum--aan { border-color: var(--ink); box-shadow: inset 0 -2px 0 var(--yellow); }

.bz-route-van { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; margin: 0 0 12px; font-size: var(--fs-klein); color: var(--ink-soft); }

/* Je week: dagknoppen zoals de dagwisselaar van DealDrive */
.bz-dagen { display: flex; gap: 6px; margin-bottom: 16px; overflow-x: auto; scrollbar-width: none; }
.bz-pijl { flex: 0 0 44px; min-height: 44px; display: grid; place-items: center; background: var(--wit); border: 1px solid var(--border-strong); border-radius: var(--radius); cursor: pointer; color: var(--ink); }
.bz-pijl:hover { border-color: var(--ink); }
.bz-dag { flex: 1 1 0; min-width: 104px; min-height: 52px; display: flex; flex-direction: column; justify-content: center; gap: 2px; padding: 6px 12px; background: var(--wit); color: var(--muted); border: 1px solid var(--border-strong); border-radius: var(--radius); text-decoration: none; font: inherit; text-align: left; cursor: pointer; transition: border-color var(--transition-fast); }
.bz-dag:hover { border-color: var(--ink); color: var(--ink); }
.bz-dag-naam { display: flex; align-items: center; justify-content: space-between; gap: 6px; font-size: var(--fs-klein); font-weight: 700; color: var(--ink); text-transform: capitalize; }
.bz-dag-regio { font-size: var(--fs-label); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bz-dag--vandaag { box-shadow: inset 0 3px 0 var(--yellow); }
.bz-dag--aan { background: var(--ink); border-color: var(--ink); color: var(--wit-70); }
.bz-dag--aan .bz-dag-naam { color: var(--yellow); }
.bz-dag--aan .pil-teller { background: var(--yellow-teller); color: var(--yellow); }
.bz-dag--week .bz-dag-naam { text-transform: none; }

/* Kaart naast de routelijst */
.bz-grid { display: grid; grid-template-columns: 1fr; gap: 24px; }
@media (min-width: 900px) { .bz-grid { grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 32px; align-items: start; } .bz-kaartkant { position: sticky; top: 24px; } }
.bz-legenda { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; padding: 14px 16px; background: var(--wit); border: 1px solid var(--border); font-size: var(--fs-meta); color: var(--ink-soft); }
.bz-legenda span { display: flex; align-items: center; gap: 10px; }
.bz-legenda svg { width: 14px; height: 14px; flex: none; }
.bz-lijstkant { display: grid; gap: 12px; min-width: 0; }
.rl-leeg-week { padding: 32px 24px; background: var(--wit); border: 1px solid var(--border); text-align: center; font-style: italic; color: var(--muted); }
.bz-tellers { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; padding: 16px 20px; background: var(--ink); color: var(--wit); }
@media (min-width: 600px) and (max-width: 899px) { .bz-tellers { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.bz-tel { display: flex; flex-direction: column; gap: 2px; padding-top: 6px; border-top: 1px solid var(--yellow); }
.bz-tel-num { font-family: var(--font-serif); font-size: 22px; font-weight: 700; color: var(--wit); white-space: nowrap; }
.bz-tel-label { font-size: var(--fs-label); font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--wit-70); }

/* Blokkoppen */
.bz-blokkop { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 16px; margin-bottom: 18px; }
.bz-bloktitel { margin: 8px 0 0; font-family: var(--font-serif); font-size: var(--fs-venstertitel); font-weight: 700; color: var(--ink); }
.bz-subtitel { margin: 6px 0 0; max-width: 620px; font-size: var(--fs-klein); line-height: 1.5; color: var(--ink-soft); }
.bz-leeg { margin: 0; padding: 24px 0; font-size: var(--fs-klein); font-style: italic; color: var(--muted); }

/* Kansen langs de route */
.bz-knlijst { display: flex; flex-direction: column; gap: 12px; }
.bz-kn { display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; gap: 16px; align-items: start; padding: 18px 22px; background: var(--wit); border: 1px solid var(--border); }
.bz-kn-nr { font-family: var(--font-serif); font-size: 26px; font-weight: 700; line-height: 1; color: var(--yellow-dark); }
.bz-kn-titel { margin: 0 0 6px; font-family: var(--font-serif); font-size: 17px; font-weight: 700; }
.bz-kn-titel a { color: var(--ink); text-decoration: none; border-bottom: 2px solid var(--yellow); }
.bz-kn-bron { margin: 0; font-size: var(--fs-body); line-height: 1.5; color: var(--ink-soft); }
.bz-kn-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; margin: 4px 0 0; font-size: var(--fs-meta); color: var(--muted); }
.bz-opbouw { margin: 6px 0 0; font-size: var(--fs-meta); color: var(--muted); }
.bz-kn-acties { display: flex; flex-direction: column; align-items: stretch; gap: 6px; min-width: 150px; }
@media (max-width: 760px) {
  .bz-kn { grid-template-columns: 28px minmax(0, 1fr); padding: 16px; }
  .bz-kn-acties { grid-column: 1 / -1; flex-direction: row; flex-wrap: wrap; min-width: 0; }
  .bz-kn-acties .dd-act { min-height: 44px; }
}

/* Bellijst */
.bz-bel, .bz-plan { list-style: none; margin: 0; padding: 0; }
.bz-bel { background: var(--wit); border: 1px solid var(--border); }
.bz-bel-rij { display: grid; grid-template-columns: 48px minmax(0, 1fr) auto; gap: 14px; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--border); }
.bz-bel-rij:last-child { border-bottom: 0; }
.bz-bel-rang { font-family: var(--font-serif); font-size: 26px; font-weight: 700; text-align: center; line-height: 1; }
.bz-bel-info, .bz-plan-info { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.bz-bel-naam, .bz-plan-naam { font-family: var(--font-serif); font-size: 16px; font-weight: 700; color: var(--ink); text-decoration: none; }
.bz-bel-naam:hover, .bz-plan-naam:hover { text-decoration: underline; text-underline-offset: 3px; }
.bz-bel-reden, .bz-plan-taak { font-size: var(--fs-meta); color: var(--ink-soft); }
.bz-bel-contact { width: fit-content; padding: 4px 10px; background: var(--surface); border-left: 3px solid var(--ink); font-size: var(--fs-meta); font-weight: 700; }
.bz-bel-contact a { color: var(--ink); }
.bz-bel-pillen { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }

/* Te plannen bezoeken */
.bz-plan { display: grid; gap: 8px; }
.bz-plan-rij { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 18px; background: var(--wit); border: 1px solid var(--border); border-left: 3px solid var(--green); }
@media (max-width: 720px) { .keuzegroep-knop { min-height: 44px; } }
@media (max-width: 600px) {
  .bz-bel-rij { grid-template-columns: 32px minmax(0, 1fr); }
  .bz-bel-rij > .dd-act { grid-column: 1 / -1; min-height: 44px; justify-content: center; }
  .bz-bel-rang { font-size: 20px; }
  .bz-plan-rij { flex-direction: column; align-items: stretch; }
  .bz-plan-rij .dd-act { min-height: 44px; justify-content: center; }
}
</style>
