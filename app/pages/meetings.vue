<script setup lang="ts">
// Meetings (Plannen) in de opzet van DealDrive: het werkscherm voor gesprekken die niet op locatie
// zijn (online meetings, belafspraken en intern overleg); bezoeken staan op /bezoeken. De komende
// 30 dagen per week en per dag, met een uitklapbare filterstrook (soort en vorm, in de URL), en
// daaronder de Meetinglijst "Wie is er aan de beurt?" (vanaf Gevorderd) met per account de reden,
// een uitleg, het advies en een planknop die het afspraakvenster opent met account en vorm.
import { nlMoment, plusDagen } from '~~/shared/datum'
const { functie } = useMe()
const route = useRoute()
const router = useRouter()
const vandaag = nlMoment(new Date()).datum
const tot = plusDagen(vandaag, 30)
const { data, refresh } = await useFetch<any>('/api/agenda', { query: { van: vandaag, tot }, default: () => ({ afspraken: [], meetingsoorten: [] }) })
const soort = computed(() => (route.query.soort as string) || '')
const vorm = computed(() => (route.query.vorm as string) || '')
const zet = (k: string, v: string) => router.replace({ query: { ...route.query, [k]: v || undefined } })
const filtersOpen = ref(!!(route.query.soort || route.query.vorm))
const filterAantal = computed(() => Number(!!soort.value) + Number(!!vorm.value))
function wisFilters() { router.replace({ query: { ...route.query, soort: undefined, vorm: undefined } }) }

type Vorm = 'online' | 'telefoon' | 'intern'
const vormVan = (m: any): Vorm => (m.soort.type === 'intern' ? 'intern' : m.vorm === 'telefoon' ? 'telefoon' : 'online')
const VORM: Record<Vorm, string> = { online: 'Online', telefoon: 'Belafspraak', intern: 'Intern' }
const dagVan = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })
const tijd = (iso: string) => new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })
const duur = (m: any) => { const n = Math.round((Date.parse(m.eind) - Date.parse(m.start)) / 60000); return n > 0 ? `${n} min` : '' }
const naam = (n?: string | null) => (n ?? '').replace(/^Testgebruiker /, '')

/** Alle geplande meetings vanaf vandaag, zonder bezoeken op locatie. */
const alle = computed(() => data.value.afspraken
  .filter((a: any) => a.status === 'gepland' && a.vorm !== 'bezoek' && dagVan(a.start) >= vandaag)
  .sort((a: any, b: any) => a.start.localeCompare(b.start)))
const soortPillen = computed(() => data.value.meetingsoorten.map((m: any) => ({ ...m, aantal: alle.value.filter((a: any) => a.soort.slug === m.slug && (!vorm.value || vormVan(a) === vorm.value)).length })).filter((m: any) => m.aantal || soort.value === m.slug))
const vormPillen = computed(() => (Object.keys(VORM) as Vorm[]).map((k) => ({ id: k, label: VORM[k], aantal: alle.value.filter((a: any) => vormVan(a) === k && (!soort.value || a.soort.slug === soort.value)).length })))
const meetings = computed(() => alle.value.filter((a: any) => (!soort.value || a.soort.slug === soort.value) && (!vorm.value || vormVan(a) === vorm.value)))
const vandaagAantal = computed(() => alle.value.filter((a: any) => dagVan(a.start) === vandaag).length)

// Per week (Deze week, Volgende week, Over 2 weken) en daarbinnen per dag (Vandaag, Morgen, wo 21 okt).
const wd = (d: string) => (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7
const dagTitel = (d: string) => (d === vandaag ? 'Vandaag' : d === plusDagen(vandaag, 1) ? 'Morgen' : new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`)).replace(/\./g, ''))
const weekLabel = (i: number) => (i === 0 ? 'Deze week' : i === 1 ? 'Volgende week' : `Over ${i} weken`)
const weken = computed(() => {
  const maandag = plusDagen(vandaag, -wd(vandaag))
  const uit: { van: string; label: string; aantal: number; dagen: { iso: string; titel: string; items: any[] }[] }[] = []
  for (const m of meetings.value) {
    const d = dagVan(m.start)
    const i = Math.floor((Date.parse(`${d}T12:00:00Z`) - Date.parse(`${maandag}T12:00:00Z`)) / (7 * 864e5))
    const van = plusDagen(maandag, i * 7)
    let w = uit.find((x) => x.van === van)
    if (!w) { w = { van, label: weekLabel(i), aantal: 0, dagen: [] }; uit.push(w) }
    let dag = w.dagen.find((x) => x.iso === d)
    if (!dag) { dag = { iso: d, titel: dagTitel(d), items: [] }; w.dagen.push(dag) }
    dag.items.push(m); w.aantal++
  }
  return uit
})
/** De eerstvolgende meeting krijgt de gele rand (na het laden, zodat server en browser gelijk tekenen). */
const nu = ref<number | null>(null)
onMounted(() => { nu.value = Date.now() })
const eerstvolgende = computed(() => (nu.value === null ? null : meetings.value.find((m: any) => Date.parse(m.eind) >= nu.value!)?.id ?? null))
/** Meetings van vandaag die al voorbij zijn: grijs met "Afgelopen" en de knop Verslag maken (B18). Pas na het laden. */
const voorbij = (m: any) => nu.value !== null && Date.parse(m.eind) < nu.value

const afspraakId = computed(() => (route.query.afspraak as string) || null)
const planOpen = ref(false)
const planAccount = ref<{ id: string; naam: string } | null>(null)
const planVoorstel = ref<{ vorm?: string; soort?: string } | null>(null)
const planAanleiding = ref<string | null>(null)
function plan(account: { id: string; naam: string } | null = null, voorstel: { vorm?: string; soort?: string } | null = null, aanleiding: string | null = null) {
  planAccount.value = account; planVoorstel.value = voorstel; planAanleiding.value = aanleiding; planOpen.value = true
}
async function gepland(id: string) { planOpen.value = false; await Promise.all([refresh(), beurtVernieuw()]); zet('afspraak', id) }

// Meetinglijst: wie is er aan de beurt (vanaf Gevorderd).
const aanDeBeurtAan = computed(() => !!functie('agenda.aanDeBeurt')?.beschikbaar)
const { data: beurt, refresh: beurtVernieuw } = await useFetch<any>('/api/meetings/aan-de-beurt', { immediate: aanDeBeurtAan.value, default: () => null })
const PLAN: Record<string, { knop: string; vorm: string; soort: string }> = {
  belafspraak: { knop: '+ Plan belafspraak', vorm: 'telefoon', soort: 'belafspraak' },
  online: { knop: '+ Plan meeting', vorm: 'online', soort: 'kennismaking' },
  fysiek: { knop: '+ Plan bezoek', vorm: 'bezoek', soort: 'inventarisatie' },
}
function planBeurt(v: any) { const p = PLAN[v.advies] ?? PLAN.belafspraak!; plan({ id: v.accountId, naam: v.naam }, { vorm: p.vorm, soort: p.soort }, v.reden) }
// Rechtsboven Analyse naar de meetinganalyse (vanaf Gevorderd, functie agenda.meetingAnalyse).
const analyseAan = computed(() => !!functie('agenda.meetingAnalyse')?.beschikbaar)
useHead({ title: 'Meetings · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop helpartikel="agenda">
      <template #kicker><span class="kicker kicker--streep" data-test="meetings-kicker">Meetings · 30 dagen<template v-if="vandaagAantal"> · {{ vandaagAantal }} vandaag</template></span></template>
      <template #titel><h1 class="title title--groot">Elk gesprek op het juiste moment.</h1></template>
      <template #uitleg><p class="subtitle subtitle--groot">Online meetings, belafspraken en intern overleg rond je klanten. Voor bezoeken op locatie is er <NuxtLink to="/bezoeken" class="mt-sublink" data-test="meetings-bezoeken">Bezoeken</NuxtLink>.</p></template>
      <template #acties>
        <button type="button" class="dd-actie dd-actie--zwart" data-test="meetings-afspraak" @click="plan()"><Icoon naam="Plus" class="dd-actie-icoon" />Afspraak</button>
        <button type="button" class="dd-actie dd-actie--secundair" :class="{ 'mt-filterknop--aan': filtersOpen || filterAantal }" :aria-expanded="filtersOpen" data-test="meetings-filterknop" @click="filtersOpen = !filtersOpen">
          <Icoon naam="SlidersHorizontal" class="dd-actie-icoon" />Filters<span v-if="filterAantal" class="mt-teller">{{ filterAantal }}</span><Icoon naam="ChevronDown" class="mt-caret" :class="{ 'mt-caret--open': filtersOpen }" />
        </button>
        <KopMeer :items="[{ label: 'Agenda', icoon: 'Calendar', to: '/agenda', test: 'meetings-agenda' }, ...(analyseAan ? [{ label: 'Meetinganalyse', icoon: 'ChartLine', to: '/meeting-analyse', test: 'meetings-analyse' }] : [])]" />
      </template>
    </PaginaKop>

    <section v-if="filtersOpen" class="section mt-filterstrook" data-test="meetings-filters">
      <div class="container mt-filterbalk">
        <div class="mt-filtergroep">
          <span class="mt-filterlabel">Vorm</span>
          <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': !vorm }" @click="zet('vorm', '')">Alles<span class="pil-teller">{{ alle.filter((a: any) => !soort || a.soort.slug === soort).length }}</span></button>
          <button v-for="p in vormPillen" :key="p.id" type="button" class="filter-pil" :class="{ 'filter-pil--aan': vorm === p.id }" :data-test="`meetings-vorm-${p.id}`" @click="zet('vorm', vorm === p.id ? '' : p.id)">{{ p.label }}<span class="pil-teller">{{ p.aantal }}</span></button>
        </div>
        <div class="mt-filtergroep">
          <span class="mt-filterlabel">Soort</span>
          <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': !soort }" @click="zet('soort', '')">Alle soorten</button>
          <button v-for="m in soortPillen" :key="m.id" type="button" class="filter-pil" :class="{ 'filter-pil--aan': soort === m.slug }" :data-test="`meetings-soort-${m.slug}`" @click="zet('soort', soort === m.slug ? '' : m.slug)">{{ m.naam }}<span class="pil-teller">{{ m.aantal }}</span></button>
        </div>
      </div>
    </section>

    <section class="section section--alt">
      <div class="container">
        <div v-if="!meetings.length && alle.length" class="mt-leeg" data-test="meetings-leeg-filter">
          <span class="mt-leeg-kicker">NIETS BINNEN DIT FILTER</span>
          <h2 class="mt-leeg-titel">Geen meetings binnen dit filter.</h2>
          <p class="mt-leeg-tekst">Er {{ alle.length === 1 ? 'staat' : 'staan' }} wel {{ alle.length }} {{ alle.length === 1 ? 'meeting' : 'meetings' }} in de planning, maar niet in de gekozen soort of vorm.</p>
          <button type="button" class="dd-actie dd-actie--secundair" @click="wisFilters">Filters wissen</button>
        </div>
        <div v-else-if="!meetings.length" class="mt-leeg" data-test="meetings-leeg">
          <span class="mt-leeg-kicker">NIETS GEPLAND</span>
          <h2 class="mt-leeg-titel">Geen meetings in de planning.</h2>
          <p class="mt-leeg-tekst">Plan een online meeting, belafspraak of intern overleg. Hij komt in je agenda en, als je agenda gekoppeld is, ook in Outlook of Google Agenda.</p>
          <button type="button" class="dd-actie dd-actie--zwart" data-test="meetings-eerste" @click="plan()">+ Eerste meeting</button>
        </div>
        <template v-else>
          <div v-for="w in weken" :key="w.van" class="mt-week" :data-test="`meetings-week-${w.van}`">
            <div class="mt-week-kop"><span class="kicker">{{ w.label }}</span><span class="mt-week-n tnum">{{ w.aantal }} {{ w.aantal === 1 ? 'meeting' : 'meetings' }}</span></div>
            <div v-for="d in w.dagen" :key="d.iso" class="mt-dag">
              <div class="mt-dag-kop"><h2 class="mt-dag-titel">{{ d.titel }}</h2><span class="mt-dag-n tnum">{{ d.items.length }} {{ d.items.length === 1 ? 'meeting' : 'meetings' }}</span></div>
              <div
                v-for="m in d.items" :key="m.id" class="mt-kaart" :class="{ 'mt-kaart--nu': m.id === eerstvolgende, 'mt-kaart--voorbij': voorbij(m) }" role="button" tabindex="0" :data-test="`meeting-${m.id}`"
                @click="zet('afspraak', m.id)" @keydown.enter.prevent="zet('afspraak', m.id)"
              >
                <div class="mt-tijd"><span class="tnum">{{ tijd(m.start) }}</span><span class="mt-duur tnum">{{ duur(m) }}</span></div>
                <div class="mt-body">
                  <div class="mt-regel1"><span class="mt-vorm" :class="`mt-vorm--${vormVan(m)}`">{{ VORM[vormVan(m)] }}</span><span class="mt-naam">{{ m.accountNaam ?? m.soort.naam }}</span><span v-if="voorbij(m)" class="pil pil--grijs" data-test="mt-afgelopen">Afgelopen</span></div>
                  <span class="mt-sub">{{ m.soort.naam }}<template v-if="m.contactNaam"> · {{ m.contactNaam }}</template><template v-if="vormVan(m) === 'intern'"> · telt niet als klantcontact</template><template v-if="m.geplandDoor"> · gepland door {{ naam(m.geplandDoor) }}</template></span>
                  <div v-if="m.meetinglink || m.accountId || voorbij(m)" class="mt-acties">
                    <button v-if="voorbij(m)" type="button" class="mt-link" data-test="mt-verslag" @click.stop="zet('afspraak', m.id)">Verslag maken</button>
                    <a v-if="m.meetinglink && !voorbij(m)" :href="m.meetinglink" target="_blank" rel="noopener noreferrer" class="mt-link" @click.stop>Deelnemen ↗</a>
                    <NuxtLink v-if="m.accountId" :to="`/accounts/${m.accountId}`" class="mt-link mt-link--stil" @click.stop>Klantkaart</NuxtLink>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </section>

    <section v-if="aanDeBeurtAan" class="section section--laatste" data-test="aan-de-beurt">
      <div class="container">
        <header class="mt-plan-kop">
          <div>
            <span class="kicker kicker--streep">Meetinglijst</span>
            <h2 class="mt-plan-titel">Wie is er aan de beurt?</h2>
            <p class="mt-plan-sub">Wie je vandaag inplant, hoef je morgen niet achterna. Zet elk gesprek met één klik vast in de vorm die het advies aangeeft.</p>
          </div>
        </header>
        <p v-if="beurt && !beurt.voorstellen.length" class="mt-leeg-tekst" data-test="beurt-leeg">Niemand loopt achter op zijn ritme en er wacht geen vervolg op een gesprek. Zo hoort het.</p>
        <ol v-else-if="beurt" class="mt-plan-lijst">
          <li v-for="v in beurt.voorstellen" :key="v.accountId" class="mt-plan-rij" :data-test="`beurt-${v.accountId}`">
            <div class="mt-plan-info">
              <NuxtLink :to="`/accounts/${v.accountId}`" class="mt-plan-naam">{{ v.naam }} · {{ v.reden }}</NuxtLink>
              <p class="mt-plan-reden">{{ v.uitleg }}</p>
              <div><span class="pil pil--geel" :data-test="`beurt-advies-${v.accountId}`">{{ v.adviesLabel }}</span></div>
            </div>
            <NuxtLink v-if="v.advies === 'belblok'" to="/belblokken" class="dd-act mt-plan-knop" :data-test="`beurt-plan-${v.accountId}`">Naar belblok</NuxtLink>
            <button v-else type="button" class="dd-act mt-plan-knop" :data-test="`beurt-plan-${v.accountId}`" @click="planBeurt(v)">{{ (PLAN[v.advies] ?? PLAN.belafspraak!).knop }}</button>
          </li>
        </ol>
      </div>
    </section>
    <PlanAfspraakFlyout :open="planOpen" :account="planAccount" :voorstel="planVoorstel" :aanleiding="planAanleiding" @sluit="planOpen = false" @gepland="gepland" />
    <AfspraakFlyout :open="!!afspraakId" :afspraak-id="afspraakId" @sluit="zet('afspraak', '')" @gewijzigd="refresh()" />
  </div>
</template>

<style scoped>
.mt-sublink { color: var(--ink); text-decoration: underline; text-underline-offset: 2px; font-weight: 600; }
.mt-filterknop--aan { border-color: var(--ink); }
.mt-teller { padding: 0 6px; font-size: var(--fs-label); background: var(--yellow); border-radius: var(--radius); }
.mt-caret { width: 14px; height: 14px; transition: transform 150ms ease-out; }
.mt-caret--open { transform: rotate(180deg); }
.mt-filterstrook { padding: 14px 0; background: var(--surface); }
.mt-filterbalk { display: flex; flex-wrap: wrap; gap: 12px 28px; }
.mt-filtergroep { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.mt-filterlabel { font-size: var(--fs-label); font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }

.mt-leeg { display: grid; justify-items: start; gap: 10px; max-width: 560px; padding: 8px 0; }
.mt-leeg-kicker { font-size: var(--fs-label); font-weight: 700; letter-spacing: .1em; color: var(--muted); }
.mt-leeg-titel { margin: 0; font-family: var(--font-serif); font-size: 22px; font-weight: 700; }
.mt-leeg-tekst { margin: 0; font-size: 14px; line-height: 1.6; color: var(--ink-soft); }

.mt-week + .mt-week { margin-top: 28px; }
.mt-week-kop { display: flex; align-items: baseline; gap: 10px; margin-bottom: 12px; }
.mt-week-n, .mt-dag-n { font-size: 12px; color: var(--muted); }
.mt-dag { margin-bottom: 18px; }
.mt-dag-kop { display: flex; align-items: baseline; gap: 10px; margin-bottom: 10px; }
.mt-dag-titel { margin: 0; font-family: var(--font-serif); font-size: 19px; font-weight: 700; }
.mt-kaart { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 14px; margin-bottom: 8px; padding: 13px 14px; background: var(--wit); border: 1px solid var(--border); border-radius: var(--radius); cursor: pointer; transition: background 120ms ease-out; }
.mt-kaart:hover { background: var(--surface); }
.mt-kaart:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
.mt-kaart--nu { border-color: var(--ink); border-left: 3px solid var(--yellow); }
.mt-kaart--voorbij { background: var(--surface); }
.mt-kaart--voorbij .mt-tijd, .mt-kaart--voorbij .mt-naam { color: var(--muted); }
button.mt-link { padding: 0; background: none; border: 0; cursor: pointer; font-family: inherit; }
.mt-tijd { display: grid; gap: 2px; align-content: start; font-size: 14px; font-weight: 700; }
.mt-duur { font-size: var(--fs-label); font-weight: 400; color: var(--muted); }
.mt-body { display: grid; gap: 3px; min-width: 0; }
.mt-regel1 { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.mt-vorm { padding: 2px 8px; border-radius: var(--radius); font-size: var(--fs-label); font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
.mt-vorm--online { background: var(--blue); color: var(--wit); }
.mt-vorm--telefoon { background: var(--ink); color: var(--yellow); }
.mt-vorm--intern { background: var(--surface); color: var(--ink-soft); border: 1px solid var(--border-strong); }
.mt-naam { font-size: 14px; font-weight: 700; color: var(--ink); overflow-wrap: anywhere; }
.mt-sub { font-size: 12.5px; color: var(--muted); }
.mt-acties { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 6px; }
.mt-link { display: inline-flex; align-items: center; min-height: 28px; font-size: 11.5px; font-weight: 700; letter-spacing: .03em; text-transform: uppercase; color: var(--ink); text-decoration: underline; text-underline-offset: 2px; }
.mt-link--stil { color: var(--muted); }

.mt-plan-kop { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 16px 24px; margin-bottom: 16px; }
.mt-plan-titel { margin: 4px 0 0; font-family: var(--font-serif); font-size: 22px; font-weight: 700; }
.mt-plan-sub { margin: 6px 0 0; max-width: 620px; font-size: 13px; line-height: 1.5; color: var(--ink-soft); }
.mt-plan-lijst { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.mt-plan-rij { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 18px; background: var(--wit); border: 1px solid var(--border); border-left: 3px solid var(--green); }
.mt-plan-info { display: grid; gap: 4px; min-width: 0; }
.mt-plan-naam { font-family: var(--font-serif); font-size: 15px; font-weight: 700; color: var(--ink); text-decoration: none; overflow-wrap: anywhere; }
.mt-plan-naam:hover { text-decoration: underline; text-underline-offset: 3px; }
.mt-plan-reden { margin: 0; font-size: 12px; line-height: 1.5; color: var(--ink-soft); }
.mt-plan-knop { flex-shrink: 0; }
@media (max-width: 719px) {
  .mt-kaart { grid-template-columns: 52px minmax(0, 1fr); gap: 10px; }
  .mt-link { min-height: 44px; }
  .mt-plan-rij { flex-direction: column; align-items: stretch; }
  .mt-plan-knop { min-height: 44px; justify-content: center; }
}
</style>
