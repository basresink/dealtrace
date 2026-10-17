<script setup lang="ts">
// Bezoeken (F10) in de opzet van DealDrive: kop met werkbalk (Zoeken, + Afspraak, Analyse naar de bezoekanalyse en Filters),
// een uitklapbaar filterpaneel (periode en de kansfilters), je week met regiodagen, de kaart met
// legenda naast de routelijst per dag (de datum is een link naar de agenda op die dag) en de zwarte statistiekstrook,
// dan de kansen langs de route, de bellijst (Top 5 of Top 10) en de te plannen bezoeken als kaarten: een klik opent de
// taak in het taakvenster. Dagkaarten, dagkop en bellijst delen Bezoeken en Meetings (app/components/dagplan).
// Op de telefoon door naar Onderweg (P30).
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
const dagKaarten = computed(() => weekdagen.value.map((w: any) => ({ datum: w.datum, aantal: w.stat.bezoeken, sub: w.regio ?? 'geen regiodag' })))
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
const plan = reactive({ open: false, account: null as null | { id: string; naam: string }, taskId: null as string | null, contactId: null as string | null, aanleiding: '', voorstel: null as any })
function nieuweAfspraak() { Object.assign(plan, { open: true, account: null, taskId: null, contactId: null, aanleiding: '', voorstel: { vorm: 'bezoek', datum: data.value?.dag } }) }
function tussenstop(k: any) {
  const start = k.momentStart ? tijd(k.momentStart).replace(/:(\d)\d$/, (_m: string, t: string) => `:${Number(t) >= 3 ? '30' : '00'}`) : undefined
  Object.assign(plan, { open: true, account: { id: k.id, naam: k.naam }, taskId: k.taakId ?? null, contactId: k.contact?.id ?? null, aanleiding: k.bronnen[0]?.label ?? '', voorstel: { datum: data.value.dag, start, duurMin: 30, vorm: 'bezoek', soort: 'kennismaking' } })
}
function planBezoek(t: any) { Object.assign(plan, { open: true, account: t.accountId ? { id: t.accountId, naam: t.accountNaam } : null, taskId: t.id, contactId: null, aanleiding: t.titel, voorstel: { vorm: 'bezoek', soort: 'inventarisatie' } }) }
async function gepland() { plan.open = false; await refresh() }
const afspraak = ref<string | null>(null)
const overslaan = ref<any>(null)
const reden = ref('')
async function slaOver() {
  try { await $fetch(`/api/kansen/${overslaan.value.id}/overslaan`, { method: 'POST', body: { reden: reden.value } }); toast.toon(`${overslaan.value.naam} komt 7 dagen niet terug.`); overslaan.value = null; reden.value = ''; await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
// Inloopbezoek: + Afspraak met de prospect, de dag en het moment langs de route, als ongepland bezoek.
function inloop(k: any) {
  const start = k.momentStart ? tijd(k.momentStart).replace(/:(\d)\d$/, (_m: string, t: string) => `:${Number(t) >= 3 ? '30' : '00'}`) : undefined
  Object.assign(plan, { open: true, account: { id: k.id, naam: k.naam }, taskId: k.taakId ?? null, contactId: k.contact?.id ?? null, aanleiding: `Inloopbezoek langs de route${k.bronnen[0]?.label ? `: ${k.bronnen[0].label}` : ''}`, voorstel: { datum: data.value.dag, start, duurMin: 30, vorm: 'bezoek', soort: 'ongepland-bezoek' } })
}
// Eerst bellen: + Taak van het type Bellen met de prospect en het hoofdcontact al ingevuld.
const belTaak = ref<null | { account: { id: string; naam: string }; contact: { id: string; naam: string } | null; titel: string; aanleiding: string }>(null)
function eerstBellen(k: any) {
  belTaak.value = {
    account: { id: k.id, naam: k.naam }, contact: k.contact?.id ? { id: k.contact.id, naam: k.contact.naam } : null,
    titel: `Bellen voor bezoek · ${k.naam}`, aanleiding: `Kans langs de route${k.bronnen[0]?.label ? `: ${k.bronnen[0].label}` : ''}`,
  }
}
const bronnen = (k: any) => [...new Set<string>(k.bronnen.map((b: any) => b.label))]
const opbouw = (k: any) => k.opbouw.map((o: any) => `${o.label} ${o.punten >= 0 ? '+' : ''}${o.punten}`).join(' · ')
// Bellijst en te plannen bezoeken: een klik op een kaart opent de taak in het taakvenster.
const taak = ref<string | null>(null)
useHead({ title: 'Bezoeken · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop :kicker="kicker" :titel="titel" uitleg="Bezoeken op de kaart en op tijd gesorteerd. Het volgende bezoek pulseert rood; kansen langs je route neem je onderweg mee." helpartikel="bezoeken-en-kansen-langs-de-route">
      <template #acties>
        <button v-if="$aan('agenda.basis')" type="button" class="dd-actie dd-actie--zwart" data-test="plus-bezoek" @click="nieuweAfspraak"><Icoon naam="Plus" class="dd-actie-icoon" />Afspraak</button>
        <FunctieLink v-if="data?.kan.analyse" to="/bezoek-analyse" class="dd-actie dd-actie--secundair" data-test="bezoekanalyse-knop"><Icoon naam="ChartLine" class="dd-actie-icoon" />Analyse</FunctieLink>
        <button v-if="heeftFilters" type="button" class="dd-actie dd-actie--secundair" :class="{ 'bz-toggle--aan': filtersOpen || filterTeller }" :aria-expanded="filtersOpen" data-test="bz-filters" @click="filtersOpen = !filtersOpen">
          <Icoon naam="SlidersHorizontal" class="dd-actie-icoon" />Filters<span v-if="filterTeller" class="pil-teller pil-teller--geel">{{ filterTeller }}</span><Icoon naam="ChevronDown" :grootte="14" class="bz-caret" :class="{ 'bz-caret--open': filtersOpen }" />
        </button>
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
        <DagKaartenRij
          v-if="weekdagen.length" :dagen="dagKaarten" :actief="data.dag" :week="week" :week-sub="`${weekStops.length} ${weekStops.length === 1 ? 'bezoek' : 'bezoeken'}`" :vandaag="vandaag"
          @dag="zet({ datum: $event, weergave: undefined })" @week="zet({ weergave: week ? undefined : 'week' })" @stap="naarWeek"
        />

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
              <div class="bz-tel"><span class="bz-tel-num tnum">{{ stat.contact }}</span><span class="bz-tel-label">Contactmomenten</span></div>
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
              <button v-if="data.kan.kansenAlle" type="button" class="dd-act" :data-test="`eerst-bellen-${k.id}`" @click="eerstBellen(k)"><Icoon naam="Phone" />Eerst bellen</button>
              <button v-if="data.kan.inloop" type="button" class="dd-act" :data-test="`inloop-${k.id}`" @click="inloop(k)">Inloopbezoek</button>
              <a class="dd-act" :href="kaartLink({ punt: k.punt }, app) ?? undefined" target="_blank" rel="noopener"><Icoon naam="Navigation" />Navigeer</a>
              <button type="button" class="dd-act" :data-test="`overslaan-${k.id}`" @click="overslaan = k">Overslaan</button>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section v-if="data && data.kan.bellijst" id="bellijst" class="section section--alt">
      <div class="container" data-test="bellijst-naast">
        <BelPrioriteit :lijst="data.bellijst ?? []" :kan="!!data.kan.bellijst" uitleg="Dezelfde lijst als op Belblokken, zonder de accounts die je vandaag al bezoekt. Tijdens reistijd de top 5, voor een lege middag de top 10." @taak="taak = $event" />
      </div>
    </section>

    <section v-if="data && data.kan.teplannen" class="section section--laatste">
      <div class="container" data-test="te-plannen">
        <header class="bz-blokkop">
          <div>
            <span class="kicker kicker--streep">Bezoeklijst</span>
            <h2 class="bz-bloktitel">Te plannen bezoeken</h2>
            <p class="bz-subtitel">Open bezoektaken uit de motor en handmatig. Plan elk bezoek met één klik als afspraak, of cluster ze per regio tot een volle dag.</p>
          </div>
        </header>
        <ol v-if="data.teplannen.length" class="bz-plan">
          <DagKaart v-for="t in data.teplannen" :key="t.id" tag="li" class="bz-plan-kaart" :data-test="`plan-kaart-${t.id}`">
            <div class="dp-kaart-kop"><button type="button" class="dp-kaart-titel" :data-test="`plan-open-${t.id}`" @click="taak = t.id">{{ t.accountNaam ?? t.titel }}</button></div>
            <p v-if="t.accountNaam" class="dp-kaart-tekst">{{ t.titel }}</p>
            <span class="dp-kaart-pillen"><span class="pil pil--grijs">sinds {{ kortDatum(t.sinds) }}</span><span class="pil pil--groen">{{ t.herkomst === 'handmatig' ? 'handmatig' : 'motor' }}</span></span>
            <div class="dp-kaart-acties"><button type="button" class="dd-act" :data-test="`plan-bezoek-${t.id}`" @click="planBezoek(t)"><Icoon naam="Plus" />Plan bezoek</button></div>
          </DagKaart>
        </ol>
        <p v-else class="bz-leeg">Geen open bezoektaken. Het bezoekritme is bij.</p>
      </div>
    </section>

    <PlanAfspraakFlyout :open="plan.open" :account="plan.account" :task-id="plan.taskId" :contact-id="plan.contactId" :aanleiding="plan.aanleiding" :voorstel="plan.voorstel" @sluit="plan.open = false" @gepland="gepland" />
    <NieuweTaakFlyout :open="!!belTaak" :account="belTaak?.account ?? null" :contact="belTaak?.contact ?? null" actiesoort="bellen" :titel="belTaak?.titel" :aanleiding="belTaak?.aanleiding" @sluit="belTaak = null" @gemaakt="belTaak = null; refresh()" />
    <AfspraakFlyout :open="!!afspraak" :afspraak-id="afspraak" @sluit="afspraak = null" @gewijzigd="refresh()" />
    <TaakFlyout :open="!!taak" :taak-id="taak" @sluit="taak = null" @klaar="taak = null; refresh()" @gewijzigd="refresh()" />
    <FlyoutShell v-if="overslaan" open titel-id="os-titel" breedte="smal" @sluit="overslaan = null">
        <template #kop><span class="fo-kicker">Overslaan</span><h2 id="os-titel" class="fo-titel">{{ overslaan.naam }}</h2></template>
        <form id="os-form" class="fs-form" @submit.prevent="slaOver">
          <div class="fo-body fo-body--formulier"><div class="uitkomst-raster"><button v-for="r in OVERSLA_REDENEN" :key="r" type="button" class="uitkomst-knop" :class="{ 'uitkomst-knop--actief': reden === r }" @click="reden = r">{{ r }}</button></div><p class="meta mt-8">De kans komt 7 dagen niet terug.</p></div>
        </form>
        <template #voet>
          <footer class="fo-foot fs-voet">
          <button type="submit" form="os-form" class="dd-actie dd-actie--zwart fs-hoofdactie" :disabled="!reden" data-test="overslaan-bewaar"><Icoon naam="Check" :grootte="16" />Overslaan</button>
          <span class="fo-foot-vul" />
        </footer>
        </template>
      </FlyoutShell>
  </div>
</template>

<style scoped>
.bz-toggle--aan { border-color: var(--ink); }
.bz-caret { transition: transform var(--transition-fast); }
.bz-caret--open { transform: rotate(180deg); }
.bz-datum, .bz-filtersel { width: auto; min-height: 36px; }
.bz-datum--aan { border-color: var(--ink); box-shadow: inset 0 -2px 0 var(--yellow); }

.bz-route-van { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; margin: 0 0 12px; font-size: var(--fs-klein); color: var(--ink-soft); }

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

/* Te plannen bezoeken: kaarten in een raster */
.bz-plan { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); gap: var(--kaart-gap, 16px); }
.bz-plan-kaart { border-left: 3px solid var(--green); }
</style>
