<script setup lang="ts">
// Meetings (Plannen) in de opzet van DealDrive: het werkscherm voor gesprekken die niet op locatie
// zijn (online meetings, belafspraken en intern overleg); bezoeken staan op /bezoeken. Zelfde opzet als
// Bezoeken: de rij dagkaarten (ma tot vr met het aantal meetings, Hele week, pijlen per week; ?datum= en
// ?weergave=week), het blok van de gekozen dag met de meetings als kaarten (de datum is een link naar de
// agenda op die dag, een klik opent het afspraakvenster), daaronder over de hele breedte de belprioriteit
// (BelPrioriteit, een klik opent de beltaak of maakt die eerst). Een uitklapbare filterstrook (soort en vorm,
// in de URL), en onderaan de Meetinglijst "Wie is er aan de beurt?" (vanaf Gevorderd) als kaarten met per
// account de reden, een uitleg, het advies en een planknop die het afspraakvenster opent met account en vorm.
import { nlMoment, plusDagen } from '~~/shared/datum'
import { duurLabel } from '~~/shared/route'
const { functie } = useMe()
const route = useRoute()
const router = useRouter()
const vandaag = nlMoment(new Date()).datum
const tot = plusDagen(vandaag, 30)
// De gekozen dag (?datum=) en de week; de agenda haalt de komende 30 dagen en de gekozen week op.
const wd = (d: string) => (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7
const datum = computed(() => (typeof route.query.datum === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(route.query.datum) ? route.query.datum : vandaag))
const week = computed(() => route.query.weergave === 'week')
const maandag = computed(() => plusDagen(datum.value, -wd(datum.value)))
const venster = computed(() => ({ van: maandag.value < vandaag ? maandag.value : vandaag, tot: plusDagen(maandag.value, 7) > tot ? plusDagen(maandag.value, 7) : tot }))
const { data, refresh } = await useFetch<any>('/api/agenda', { query: venster, default: () => ({ afspraken: [], meetingsoorten: [] }) })
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

/** Alle geplande meetings in de komende 30 dagen, zonder bezoeken op locatie. */
const alle = computed(() => data.value.afspraken
  .filter((a: any) => a.status === 'gepland' && a.vorm !== 'bezoek' && dagVan(a.start) >= vandaag && dagVan(a.start) < tot)
  .sort((a: any, b: any) => a.start.localeCompare(b.start)))
const soortPillen = computed(() => data.value.meetingsoorten.map((m: any) => ({ ...m, aantal: alle.value.filter((a: any) => a.soort.slug === m.slug && (!vorm.value || vormVan(a) === vorm.value)).length })).filter((m: any) => m.aantal || soort.value === m.slug))
const vormPillen = computed(() => (Object.keys(VORM) as Vorm[]).map((k) => ({ id: k, label: VORM[k], aantal: alle.value.filter((a: any) => vormVan(a) === k && (!soort.value || a.soort.slug === soort.value)).length })))
const pastFilter = (a: any) => (!soort.value || a.soort.slug === soort.value) && (!vorm.value || vormVan(a) === vorm.value)
const meetings = computed(() => alle.value.filter(pastFilter))
const vandaagAantal = computed(() => alle.value.filter((a: any) => dagVan(a.start) === vandaag).length)

// De gekozen week: elke meeting die niet geannuleerd is (ook afgeronde), zonder bezoeken op locatie, binnen het filter.
const inWeek = computed(() => data.value.afspraken
  .filter((a: any) => a.status !== 'geannuleerd' && a.vorm !== 'bezoek' && dagVan(a.start) >= maandag.value && dagVan(a.start) < plusDagen(maandag.value, 7))
  .sort((a: any, b: any) => a.start.localeCompare(b.start)))
const weekMeetings = computed(() => inWeek.value.filter(pastFilter))
const opDag = (d: string) => weekMeetings.value.filter((m: any) => dagVan(m.start) === d)
const dagKaarten = computed(() => Array.from({ length: 5 }, (_, i) => {
  const d = plusDagen(maandag.value, i); const items = opDag(d)
  return { datum: d, aantal: items.length, sub: items.length ? `eerste ${tijd(items[0].start)}` : 'vrij' }
}))
const zetDag = (q: Record<string, string | undefined>) => router.replace({ query: { ...route.query, ...q } })
const naarWeek = (stap: number) => zetDag({ datum: plusDagen(maandag.value, stap * 7), weergave: week.value ? 'week' : undefined })
/** De dagblokken: de gekozen dag, of in de week elke dag met meetings. */
const dagBlokken = computed(() => (week.value
  ? Array.from({ length: 7 }, (_, i) => plusDagen(maandag.value, i)).map((d) => ({ iso: d, items: opDag(d) })).filter((d) => d.items.length)
  : [{ iso: datum.value, items: opDag(datum.value) }]))
const getoond = computed(() => dagBlokken.value.reduce((n, d) => n + d.items.length, 0))
const zonderFilter = computed(() => inWeek.value.filter((m: any) => week.value || dagVan(m.start) === datum.value).length)
const minuten = (m: any) => Math.max(0, Math.round((Date.parse(m.eind) - Date.parse(m.start)) / 60000))
const dagMeta = (items: any[]) => `${items.length} ${items.length === 1 ? 'meeting' : 'meetings'} · ${duurLabel(items.reduce((s, m) => s + minuten(m), 0))}`

// Belprioriteit onder de meetings: de bellijst van vandaag zonder wie je die dag al spreekt.
const { data: bel, refresh: belVernieuw } = await useFetch<any>('/api/meetings/bellijst', { query: computed(() => ({ datum: datum.value })), default: () => ({ kan: false, bellijst: [] }) })
const taak = ref<string | null>(null)
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
      <template #uitleg><p class="subtitle subtitle--groot">Online meetings, belafspraken en intern overleg rond je prospects. Voor bezoeken op locatie is er <NuxtLink to="/bezoeken" class="mt-sublink" data-test="meetings-bezoeken">Bezoeken</NuxtLink>.</p></template>
      <template #acties>
        <button type="button" class="dd-actie dd-actie--zwart" data-test="meetings-afspraak" @click="plan()"><Icoon naam="Plus" class="dd-actie-icoon" />Afspraak</button>
        <NuxtLink v-if="analyseAan" to="/meeting-analyse" class="dd-actie dd-actie--secundair" data-test="meetings-analyse"><Icoon naam="ChartLine" class="dd-actie-icoon" />Analyse</NuxtLink>
        <button type="button" class="dd-actie dd-actie--secundair" :class="{ 'mt-filterknop--aan': filtersOpen || filterAantal }" :aria-expanded="filtersOpen" data-test="meetings-filterknop" @click="filtersOpen = !filtersOpen">
          <Icoon naam="SlidersHorizontal" class="dd-actie-icoon" />Filters<span v-if="filterAantal" class="mt-teller">{{ filterAantal }}</span><Icoon naam="ChevronDown" class="mt-caret" :class="{ 'mt-caret--open': filtersOpen }" />
        </button>
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
        <DagKaartenRij
          :dagen="dagKaarten" :actief="datum" :week="week" :week-sub="`${weekMeetings.length} ${weekMeetings.length === 1 ? 'meeting' : 'meetings'}`" :vandaag="vandaag"
          @dag="zetDag({ datum: $event === vandaag ? undefined : $event, weergave: undefined })" @week="zetDag({ weergave: week ? undefined : 'week' })" @stap="naarWeek"
        />
        <div class="mt-dagkant" data-test="meetings-dag">
            <div v-if="!getoond && (soort || vorm)" class="mt-leeg mt-blok" data-test="meetings-leeg-filter">
              <span class="mt-leeg-kicker">NIETS BINNEN DIT FILTER</span>
              <h2 class="mt-leeg-titel">Geen meetings binnen dit filter.</h2>
              <p v-if="zonderFilter" class="mt-leeg-tekst">Er {{ zonderFilter === 1 ? 'staat' : 'staan' }} wel {{ zonderFilter }} {{ zonderFilter === 1 ? 'meeting' : 'meetings' }} op {{ week ? 'deze week' : 'deze dag' }}, maar niet in de gekozen soort of vorm.</p>
              <p v-else class="mt-leeg-tekst">Ook zonder filter staat er niets op {{ week ? 'deze week' : 'deze dag' }}. Kies een andere dag of wis de filters.</p>
              <button type="button" class="dd-actie dd-actie--secundair" @click="wisFilters">Filters wissen</button>
            </div>
            <div v-else-if="!getoond && !alle.length" class="mt-leeg mt-blok" data-test="meetings-leeg">
              <span class="mt-leeg-kicker">NIETS GEPLAND</span>
              <h2 class="mt-leeg-titel">Geen meetings in de planning.</h2>
              <p class="mt-leeg-tekst">Plan een online meeting, belafspraak of intern overleg. Hij komt in je agenda en, als je agenda gekoppeld is, ook in Outlook of Google Agenda.</p>
              <button type="button" class="dd-actie dd-actie--zwart" data-test="meetings-eerste" @click="plan()">+ Eerste meeting</button>
            </div>
            <div v-else-if="week && !dagBlokken.length" class="mt-blok mt-dag-leeg" data-test="meetings-week-leeg">Geen meetings gepland in deze week.</div>
            <template v-else>
            <div v-for="d in dagBlokken" :key="d.iso" class="mt-blok" :data-test="`meetings-dag-${d.iso}`">
              <DagBlokKop :datum="d.iso" :meta="dagMeta(d.items)" />
              <p v-if="!d.items.length" class="mt-dag-leeg" data-test="meetings-dag-leeg">Geen meetings op deze dag. Bel iemand uit je belprioriteit of plan een gesprek.</p>
              <div v-else class="mt-kaarten">
                <DagKaart
                  v-for="m in d.items" :key="m.id" class="mt-kaart" :class="{ 'mt-kaart--nu': m.id === eerstvolgende, 'mt-kaart--voorbij': voorbij(m) }" :data-test="`meeting-${m.id}`"
                >
                  <div class="mt-tijd"><span class="tnum">{{ tijd(m.start) }}</span><span class="mt-duur tnum">{{ duur(m) }}</span></div>
                  <div class="mt-body">
                    <div class="mt-regel1"><span class="mt-vorm" :class="`mt-vorm--${vormVan(m)}`">{{ VORM[vormVan(m)] }}</span><button type="button" class="dp-kaart-titel mt-naam" :data-test="`meeting-open-${m.id}`" @click="zet('afspraak', m.id)">{{ m.accountNaam ?? m.soort.naam }}</button><span v-if="voorbij(m)" class="pil pil--grijs" data-test="mt-afgelopen">{{ m.status === 'afgerond' ? 'Afgerond' : 'Afgelopen' }}</span></div>
                    <span class="mt-sub">{{ m.soort.naam }}<template v-if="m.contactNaam"> · {{ m.contactNaam }}</template><template v-if="vormVan(m) === 'intern'"> · telt niet als contactmoment</template><template v-if="m.geplandDoor"> · gepland door {{ naam(m.geplandDoor) }}</template></span>
                    <div v-if="m.meetinglink || m.accountId || voorbij(m)" class="mt-acties dp-kaart-acties">
                      <button v-if="voorbij(m) && m.status === 'gepland'" type="button" class="mt-link" data-test="mt-verslag" @click="zet('afspraak', m.id)">Verslag maken</button>
                      <a v-if="m.meetinglink && !voorbij(m)" :href="m.meetinglink" target="_blank" rel="noopener noreferrer" class="mt-link">Deelnemen ↗</a>
                      <NuxtLink v-if="m.accountId" :to="`/accounts/${m.accountId}`" class="mt-link mt-link--stil">Open kaart</NuxtLink>
                    </div>
                  </div>
                </DagKaart>
              </div>
            </div>
            </template>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container" data-test="meetings-bellijst">
        <BelPrioriteit :lijst="bel.bellijst" :kan="bel.kan" titel="Bel-prioriteit bij je meetings" uitleg="Dezelfde lijst als op Belblokken, zonder wie je die dag al spreekt. Een klik opent de beltaak; is die er nog niet, dan maakt Dealtrace hem eerst." @taak="taak = $event" />
      </div>
    </section>

    <section v-if="aanDeBeurtAan" class="section section--alt section--laatste" data-test="aan-de-beurt">
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
          <DagKaart v-for="v in beurt.voorstellen" :key="v.accountId" tag="li" class="mt-plan-kaart" :data-test="`beurt-${v.accountId}`">
            <div class="dp-kaart-kop"><NuxtLink :to="`/accounts/${v.accountId}`" class="dp-kaart-titel mt-plan-naam">{{ v.naam }} · {{ v.reden }}</NuxtLink></div>
            <p class="dp-kaart-tekst">{{ v.uitleg }}</p>
            <span class="dp-kaart-pillen"><span class="pil pil--geel" :data-test="`beurt-advies-${v.accountId}`">{{ v.adviesLabel }}</span></span>
            <div class="dp-kaart-acties">
              <NuxtLink v-if="v.advies === 'belblok'" to="/belblokken" class="dd-act" :data-test="`beurt-plan-${v.accountId}`">Naar belblok</NuxtLink>
              <button v-else type="button" class="dd-act" :data-test="`beurt-plan-${v.accountId}`" @click="planBeurt(v)">{{ (PLAN[v.advies] ?? PLAN.belafspraak!).knop }}</button>
            </div>
          </DagKaart>
        </ol>
      </div>
    </section>
    <PlanAfspraakFlyout :open="planOpen" :account="planAccount" :voorstel="planVoorstel" :aanleiding="planAanleiding" @sluit="planOpen = false" @gepland="gepland" />
    <AfspraakFlyout :open="!!afspraakId" :afspraak-id="afspraakId" @sluit="zet('afspraak', '')" @gewijzigd="refresh()" />
    <TaakFlyout :open="!!taak" :taak-id="taak" @sluit="taak = null" @klaar="taak = null; belVernieuw()" @gewijzigd="belVernieuw()" />
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

.mt-dagkant { display: grid; gap: 12px; min-width: 0; }
.mt-blok { background: var(--wit); border: 1px solid var(--border); }
.mt-leeg { display: grid; justify-items: start; gap: 10px; padding: 24px; }
.mt-leeg-kicker { font-size: var(--fs-label); font-weight: 700; letter-spacing: .1em; color: var(--muted); }
.mt-leeg-titel { margin: 0; font-family: var(--font-serif); font-size: 22px; font-weight: 700; }
.mt-leeg-tekst { margin: 0; font-size: 14px; line-height: 1.6; color: var(--ink-soft); }
.mt-dag-leeg { margin: 0; padding: 32px 24px; text-align: center; font-size: var(--fs-body); font-style: italic; color: var(--muted); }
.mt-kaarten { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); gap: 8px; padding: 12px; }
.mt-kaart { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 14px; padding: 13px 14px; }
.mt-kaart:hover { background: var(--surface); }
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
.mt-naam { font-family: var(--font-sans); font-size: 14px; font-weight: 700; color: var(--ink); overflow-wrap: anywhere; }
.mt-sub { font-size: 12.5px; color: var(--muted); }
.mt-acties { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 6px; }
.mt-link { display: inline-flex; align-items: center; min-height: 28px; font-size: 11.5px; font-weight: 700; letter-spacing: .03em; text-transform: uppercase; color: var(--ink); text-decoration: underline; text-underline-offset: 2px; }
.mt-link--stil { color: var(--muted); }

.mt-plan-kop { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 16px 24px; margin-bottom: 16px; }
.mt-plan-titel { margin: 4px 0 0; font-family: var(--font-serif); font-size: 22px; font-weight: 700; }
.mt-plan-sub { margin: 6px 0 0; max-width: 620px; font-size: 13px; line-height: 1.5; color: var(--ink-soft); }
/* Meetinglijst: kaarten in een raster, zoals Te plannen bezoeken op Bezoeken. */
.mt-plan-lijst { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); gap: var(--kaart-gap, 16px); margin: 0; padding: 0; list-style: none; }
.mt-plan-kaart { border-left: 3px solid var(--green); }
@media (max-width: 719px) {
  .mt-kaart { grid-template-columns: 52px minmax(0, 1fr); gap: 10px; }
  .mt-kaarten { padding: 8px; }
  .mt-link { min-height: 44px; }
}
</style>
