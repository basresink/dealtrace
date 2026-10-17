<script setup lang="ts">
// Terug in beeld (/terug-in-beeld, zijbalk Planning na Prospectplanning): verloren prospects komen hier terug zodra de
// terugkomregel het toestaat. Tellers (deze week, deze maand, later, over tijd, gestart), zoeken en filters op regel,
// kanaal en status (in de URL: ?regel=&kanaal=&status=&q=), groepen Deze week (met over tijd), Deze maand en Later.
// Per prospect verliesreden en bron, terugkomdatum, regel met wachttijd, kanaal, wie het oppakt, aanpak en status.
// Start hercontact opent TerugStartFlyout; Later en Pas datum aan TerugDatumFlyout (nooit binnen de afkoeling).
import { KANAAL_LABEL, type Kanaal } from '~~/shared/nbStatus'
import {
  groepVan, herkomstTekst, pastFilter, regelTekst, statusVan, tellers as telRijen, TERUG_GROEP_LABEL, TERUG_GROEPEN, TERUG_KANALEN, TERUG_STATUS_LABEL, TERUG_STATUSSEN,
  uitlegVan, eindeMaand, dagKort, type TerugGroep, type TerugRij,
} from '~~/shared/terugInBeeld'
import { terugDagKort } from '~~/shared/terugkomBeheer'

const { functie } = useMe()
const aan = !!functie('nav.terugInBeeld')?.beschikbaar
const kanDatum = computed(() => !!functie('account.terugOpAanpassen')?.beschikbaar)
const route = useRoute()
const router = useRouter()
const toast = useToast()
const q = (k: string) => (typeof route.query[k] === 'string' ? (route.query[k] as string) : undefined)
const { data, refresh } = await useFetch<{ vandaag: string; rijen: TerugRij[]; regels: { id: string; naam: string }[]; team: boolean }>('/api/terug-in-beeld', { immediate: aan, default: () => null as any })
function zet(p: Record<string, string | undefined>) {
  const n: Record<string, any> = { ...route.query, ...p }
  for (const k of Object.keys(n)) if (n[k] === undefined || n[k] === '' || n[k] === 'alle') delete n[k]
  router.replace({ query: n })
}
const zoekTekst = ref(q('q') ?? '')
let zoekTimer: ReturnType<typeof setTimeout> | undefined
watch(zoekTekst, (v) => { clearTimeout(zoekTimer); zoekTimer = setTimeout(() => zet({ q: v.trim() || undefined }), 250) })

const vandaag = computed(() => data.value?.vandaag ?? new Date().toISOString().slice(0, 10))
const alle = computed(() => data.value?.rijen ?? [])
const filter = computed(() => ({ regel: q('regel'), kanaal: q('kanaal'), status: q('status'), zoek: q('q') }))
const filtersActief = computed(() => !!(filter.value.regel || filter.value.kanaal || filter.value.status || filter.value.zoek))
const zicht = computed(() => alle.value.filter((r) => pastFilter(r, filter.value, vandaag.value)))
const t = computed(() => telRijen(alle.value, vandaag.value))
const perGroep = (g: TerugGroep) => zicht.value.filter((r) => groepVan(r.terugOp, vandaag.value) === g)
const maandNaam = computed(() => new Intl.DateTimeFormat('nl-NL', { month: 'long', timeZone: 'UTC' }).format(new Date(`${vandaag.value}T12:00:00Z`)))
const eindeMaandKort = computed(() => terugDagKort(eindeMaand(vandaag.value)).replace(/^\S+ /, ''))
const GROEP_UITLEG = computed<Record<TerugGroep, string>>(() => ({
  week: 'Wie nu of deze week weer benaderd mag worden, plus wie over tijd is.',
  maand: `Nog in ${maandNaam.value}. Ze staan op hun datum vanzelf in Vandaag.`,
  later: `Na ${maandNaam.value}. Je hoeft er nu niets mee.`,
}))
const KANAAL_ACTIE: Record<string, string> = { bellen: 'bellen', mail: 'mailen', linkedin: 'linkedin', bezoek: 'bezoek', whatsapp: 'whatsapp' }
const kanalen = computed(() => TERUG_KANALEN.filter((k) => ['bellen', 'mail', 'bezoek'].includes(k) || alle.value.some((r) => r.kanaal === k)))
const regelsInLijst = computed(() => (data.value?.regels ?? []).filter((r) => alle.value.some((x) => x.regel?.id === r.id) || filter.value.regel === r.id))

function telKlik(k: 'week' | 'maand' | 'later' | 'overtijd' | 'gestart') {
  if (k === 'overtijd' || k === 'gestart') { zet({ status: q('status') === k ? undefined : k }); return }
  document.getElementById(`tib-groep-${k}`)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
}
function wisFilters() { zoekTekst.value = ''; router.replace({ query: {} }) }

const startRij = ref<TerugRij | null>(null)
const datumRij = ref<TerugRij | null>(null)
const datumLater = ref(false)
function openDatum(r: TerugRij, later: boolean) { datumLater.value = later; datumRij.value = r }
async function gestart(tekst: string) { startRij.value = null; toast.toon(tekst); await refresh() }
async function bewaard(tekst: string) { datumRij.value = null; toast.toon(tekst); await refresh() }
const eigenaar = (r: TerugRij) => (data.value?.team && r.eigenaar.naam ? r.eigenaar.naam.replace(/^Testgebruiker /, '') : null)
useHead({ title: 'Terug in beeld · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="nav.terugInBeeld" />
    <template v-else>
      <PaginaKop kicker="Planning · Terug in beeld" titel="Terug in beeld" uitleg="Prospects die je verloor, komen hier terug zodra jullie terugkomregel het toestaat. Per prospect zie je waarom hij terugkomt, wanneer, via welk kanaal en met welke aanpak. Start het hercontact met één knop." helpartikel="wanneer-we-iemand-terugbellen">
        <template #acties>
          <NuxtLink to="/planning?tab=terugkom" class="dd-actie dd-actie--secundair" data-test="tib-regels">Terugkomregels<Icoon naam="ArrowRight" class="dd-actie-icoon" /></NuxtLink>
        </template>
      </PaginaKop>

      <section class="section section--laatste">
        <div v-if="data" class="container">
          <div class="tib-tellers" data-test="tib-tellers">
            <button v-for="[k, l, sub] in ([['week', 'Deze week', 'terug in beeld'], ['maand', 'Deze maand', `tot en met ${eindeMaandKort}`], ['later', 'Later', `na ${maandNaam}`], ['overtijd', 'Over tijd', t.overtijd ? 'datum voorbij, nog niet gestart' : 'niemand blijft liggen'], ['gestart', 'Gestart', 'hercontact loopt']] as const)" :key="k" type="button" class="stat-card" :class="{ 'stat-card--alert': k === 'overtijd' && t.overtijd, 'stat-card--actief': q('status') === k }" :aria-pressed="k === 'overtijd' || k === 'gestart' ? q('status') === k : undefined" :data-test="`tib-tel-${k}`" @click="telKlik(k)">
              <span class="stat-label">{{ l }}</span><span class="stat-num tnum">{{ t[k] }}</span><span class="stat-foot">{{ sub }}</span>
            </button>
          </div>

          <div class="filterpaneel mt-16" data-test="tib-filters">
            <div class="filter-groep">
              <label class="sr-only" for="tib-zoek">Zoek een prospect</label>
              <input id="tib-zoek" v-model="zoekTekst" class="invoer invoer--klein tib-zoek" type="search" placeholder="Zoek op naam of plaats" data-test="tib-zoek">
            </div>
            <div class="filter-groep" role="group" aria-label="Regel">
              <span class="filter-label">Regel</span>
              <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': !filter.regel }" :aria-pressed="!filter.regel" @click="zet({ regel: undefined })">Alle</button>
              <button v-for="r in regelsInLijst" :key="r.id" type="button" class="filter-pil" :class="{ 'filter-pil--aan': filter.regel === r.id }" :aria-pressed="filter.regel === r.id" :data-test="`tib-regel-${r.id}`" @click="zet({ regel: filter.regel === r.id ? undefined : r.id })">{{ r.naam }}</button>
              <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': filter.regel === 'geen' }" :aria-pressed="filter.regel === 'geen'" data-test="tib-regel-geen" @click="zet({ regel: filter.regel === 'geen' ? undefined : 'geen' })">Zonder regel</button>
            </div>
            <div class="filter-groep" role="group" aria-label="Kanaal">
              <span class="filter-label">Kanaal</span>
              <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': !filter.kanaal }" :aria-pressed="!filter.kanaal" @click="zet({ kanaal: undefined })">Alle</button>
              <button v-for="k in kanalen" :key="k" type="button" class="filter-pil" :class="{ 'filter-pil--aan': filter.kanaal === k }" :aria-pressed="filter.kanaal === k" :data-test="`tib-kanaal-${k}`" @click="zet({ kanaal: filter.kanaal === k ? undefined : k })">{{ KANAAL_LABEL[k] }}</button>
            </div>
            <div class="filter-groep" role="group" aria-label="Status">
              <span class="filter-label">Status</span>
              <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': !filter.status }" :aria-pressed="!filter.status" @click="zet({ status: undefined })">Alle</button>
              <button v-for="s in TERUG_STATUSSEN" :key="s" type="button" class="filter-pil" :class="{ 'filter-pil--aan': filter.status === s }" :aria-pressed="filter.status === s" :data-test="`tib-status-${s}`" @click="zet({ status: filter.status === s ? undefined : s })">{{ TERUG_STATUS_LABEL[s] }}</button>
            </div>
          </div>

          <div aria-live="polite">
            <LegeStaat v-if="!alle.length" class="mt-16" kicker="Nog niets" titel="Nog niemand terug in beeld" tekst="Zodra je een prospect verliest met een reden, zie je hier wanneer je hem weer mag benaderen en hoe. Jullie regels staan bij Terugkomregels." data-test="tib-leeg">
              <NuxtLink to="/planning?tab=terugkom" class="dd-actie dd-actie--secundair">Bekijk de terugkomregels</NuxtLink>
            </LegeStaat>
            <LegeStaat v-else-if="!zicht.length" class="mt-16" titel="Niemand past bij deze filters" :tekst="`Er ${alle.length === 1 ? 'is 1 prospect' : `zijn ${alle.length} prospects`} terug in beeld, maar geen enkele met deze combinatie.`" data-test="tib-geen-treffers">
              <button type="button" class="dd-actie dd-actie--secundair" data-test="tib-wis" @click="wisFilters">Wis de filters</button>
            </LegeStaat>
            <template v-else>
              <section v-for="g in TERUG_GROEPEN" :id="`tib-groep-${g}`" :key="g" class="tib-groep" :aria-labelledby="`tib-gk-${g}`" :data-test="`tib-groep-${g}`">
                <div class="tib-groep-kop">
                  <h2 :id="`tib-gk-${g}`" class="tib-groep-titel">{{ TERUG_GROEP_LABEL[g] }} <span class="meta tnum">{{ perGroep(g).length }}</span></h2>
                  <span class="meta">{{ GROEP_UITLEG[g] }}</span>
                </div>
                <div class="tib-lijst">
                  <p v-if="!perGroep(g).length" class="meta tib-niemand">Niemand in deze periode{{ filtersActief ? ' met deze filters' : '' }}.</p>
                  <article v-for="r in perGroep(g)" :key="r.id" class="tib-rij" data-test="tib-rij" :data-id="r.id">
                    <div class="tib-hoofd">
                      <div class="tib-naam">
                        <NuxtLink :to="`/accounts/${r.id}`" class="tib-link">{{ r.naam }}</NuxtLink>
                        <Label v-if="r.klasse" soort="klasse" :waarde="r.klasse" />
                        <Label :soort="statusVan(r, vandaag) === 'overtijd' ? 'urgentie' : 'terug'" :waarde="statusVan(r, vandaag) === 'overtijd' ? 'over-tijd' : statusVan(r, vandaag)" :data-test="`tib-status-label-${r.id}`" />
                      </div>
                      <p class="meta mt-8">{{ [r.plaats, herkomstTekst(r), eigenaar(r) ? `van ${eigenaar(r)}` : null].filter(Boolean).join(' · ') }}<template v-if="r.toelichting"> · "{{ r.toelichting }}"</template></p>
                      <dl class="tib-feiten">
                        <div><dt>Terug op</dt><dd>{{ dagKort(r.terugOp, vandaag) }}<span v-if="r.opgeschoven" class="meta tib-blok">opgeschoven door de afkoeling</span><span v-if="r.hand" class="meta tib-blok">met de hand aangepast</span></dd></div>
                        <div><dt>Regel</dt><dd>{{ regelTekst(r) }}</dd></div>
                        <div><dt>Kanaal</dt><dd><Label soort="actie" :waarde="KANAAL_ACTIE[r.kanaal]" :tekst="KANAAL_LABEL[r.kanaal as Kanaal]" /></dd></div>
                        <div><dt>Wie</dt><dd>{{ r.regel?.oppakker ?? 'Eigenaar van de prospect' }}</dd></div>
                      </dl>
                      <p class="tib-aanpak"><b>Aanpak:</b> {{ r.aanpak }}</p>
                    </div>
                    <div class="tib-acties">
                      <template v-if="statusVan(r, vandaag) === 'gestart'">
                        <NuxtLink :to="`/accounts/${r.id}`" class="dd-actie dd-actie--secundair" data-test="tib-open">Open prospect<Icoon naam="ArrowRight" class="dd-actie-icoon" /></NuxtLink>
                      </template>
                      <template v-else-if="statusVan(r, vandaag) === 'afkoeling'">
                        <button type="button" class="dd-actie dd-actie--primair" disabled :aria-describedby="`tib-u-${r.id}`" data-test="tib-start">Start hercontact</button>
                      </template>
                      <template v-else-if="statusVan(r, vandaag) === 'gepland'">
                        <button v-if="kanDatum" type="button" class="dd-actie dd-actie--secundair" data-test="tib-pas-datum" @click="openDatum(r, false)">Pas datum aan</button>
                      </template>
                      <template v-else>
                        <button type="button" class="dd-actie dd-actie--primair" data-test="tib-start" @click="startRij = r">Start hercontact</button>
                        <button v-if="kanDatum" type="button" class="dd-act" data-test="tib-later" @click="openDatum(r, true)">Later</button>
                      </template>
                      <p :id="`tib-u-${r.id}`" class="meta tib-uitleg" data-test="tib-uitleg">{{ uitlegVan(r, vandaag) }}</p>
                    </div>
                  </article>
                </div>
              </section>
            </template>
          </div>
        </div>
      </section>
      <TerugStartFlyout :open="!!startRij" :rij="startRij" @sluit="startRij = null" @gestart="gestart" />
      <TerugDatumFlyout :open="!!datumRij" :rij="datumRij" :vandaag="vandaag" :later="datumLater" @sluit="datumRij = null" @bewaard="bewaard" />
    </template>
  </div>
</template>

<style scoped>
.tib-tellers { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr)); gap: 12px; }
.tib-zoek { flex: 1 1 220px; max-width: 360px; min-width: 0; }
.tib-groep { margin-top: 28px; scroll-margin-top: 16px; }
.tib-groep-kop { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }
.tib-groep-titel { margin: 0; font-family: var(--font-serif); font-size: 20px; }
.tib-lijst { background: var(--wit); border: 1px solid var(--border); border-top: 0; }
.tib-niemand { margin: 0; padding: 16px 20px; }
.tib-rij { display: grid; grid-template-columns: minmax(0, 1fr) 230px; gap: 12px 20px; padding: 16px 20px; border-top: 1px solid var(--border); }
.tib-rij:first-child { border-top: 0; }
.tib-hoofd { min-width: 0; }
.tib-naam { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; }
.tib-link { font: 700 17px/1.25 var(--font-serif); color: var(--ink); text-decoration: none; }
.tib-link:hover { text-decoration: underline; }
.tib-feiten { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px 16px; margin: 10px 0 0; }
.tib-feiten dt { font-size: var(--fs-label); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.tib-feiten dd { margin: 2px 0 0; font-size: 13px; }
.tib-blok { display: block; }
.tib-aanpak { margin: 10px 0 0; padding: 8px 12px; background: var(--surface); border-left: 3px solid var(--yellow); font-size: 13px; }
.tib-acties { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; min-width: 0; }
.tib-uitleg { max-width: 220px; margin: 0; text-align: right; }
@media (max-width: 900px) { .tib-feiten { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 719px) {
  .tib-rij { grid-template-columns: minmax(0, 1fr); padding: 14px 16px; }
  .tib-acties { align-items: stretch; min-width: 0; }
  .tib-acties .dd-actie, .tib-acties .dd-act { width: 100%; justify-content: center; min-height: var(--touch-target-min); }
  .tib-uitleg { max-width: none; text-align: left; }
  .tib-link { display: inline-flex; align-items: center; min-height: var(--touch-target-min); }
  .tib-zoek { max-width: none; }
}
</style>
