<script setup lang="ts">
// Concepten (8.5.7): alles wat agents voor je klaarzetten, als kaarten in een raster (3 per rij, 2 op een
// tablet, 1 op de telefoon) in de opzet van de inzichtkaarten. Filters in de URL met tellers: status
// (standaard open: klaar en goedgekeurd), soort (`type`), agent, account (`zoek`) en periode (`sinds`).
// De salesmanager ziet met `team=1` ook de concepten van zijn teams (8.12). Een klik op een kaart opent de
// ConceptFlyout; `?concept=<id>` opent er meteen een.
import { agentLabel, CONCEPT_PERIODE, CONCEPT_SOORT, CONCEPT_STATUS } from '~~/shared/concepten'
const { functie } = useMe()
const aan = !!functie('concepten.inbox')?.beschikbaar
const team = !!functie('campagnes.team')?.beschikbaar
const route = useRoute()
const router = useRouter()
const SLEUTELS = ['status', 'type', 'agent', 'zoek', 'sinds', 'account'] as const
const q = (k: string) => (typeof route.query[k] === 'string' ? (route.query[k] as string) : '')
const query = computed(() => ({ ...Object.fromEntries([...SLEUTELS, 'concept'].map((k) => [k, q(k) || undefined])), team: q('team') === '1' ? '1' : undefined }))
const { data, refresh } = await useFetch<any>('/api/concepten', { query, immediate: aan, default: () => ({ concepten: [], totaal: 0, tellers: { soort: {}, status: {}, agent: {} }, uitgelicht: null }) })

function zet(p: Record<string, string | undefined>) {
  const n: Record<string, any> = { ...route.query, ...p }
  for (const k of Object.keys(n)) if (!n[k]) delete n[k]
  router.replace({ query: n })
}

// Zoeken op account (en contact of onderwerp), even wachten na het typen.
const zoekTekst = ref(q('zoek'))
let wacht: ReturnType<typeof setTimeout> | undefined
watch(zoekTekst, (z) => { clearTimeout(wacht); wacht = setTimeout(() => zet({ zoek: z.trim() || undefined }), 250) })
watch(() => route.query.zoek, (z) => { if ((z ?? '') !== zoekTekst.value.trim()) zoekTekst.value = typeof z === 'string' ? z : '' })

const STATUSSEN: [string, string][] = [['', 'Open'], ...Object.entries(CONCEPT_STATUS), ['alle', 'Alle']]
const tel = (groep: 'soort' | 'status' | 'agent', k: string) => Number(data.value.tellers?.[groep]?.[k] ?? 0)
const SOORTEN = computed(() => [['', 'Alle'], ...Object.entries(CONCEPT_SOORT).filter(([k]) => tel('soort', k) > 0 || q('type') === k)] as [string, string][])
const AGENTS = computed(() => [['', 'Alle'], ...[...new Set([...Object.keys(data.value.tellers?.agent ?? {}), ...(q('agent') ? [q('agent')] : [])])].sort().map((k) => [k, agentLabel(k)])] as [string, string][])
const PERIODES: [string, string][] = [['', 'Alles'], ...Object.entries(CONCEPT_PERIODE)]
const somSoort = computed(() => Object.values(data.value.tellers?.soort ?? {}).reduce((a: number, b: any) => a + Number(b), 0))
const somAgent = computed(() => Object.values(data.value.tellers?.agent ?? {}).reduce((a: number, b: any) => a + Number(b), 0))

const filtersOpen = ref(!!(q('agent') || q('sinds')))
const actieveFilters = computed(() => ['type', 'agent', 'zoek', 'sinds', 'account'].filter((k) => q(k)).length + (q('status') ? 1 : 0))
function resetFilters() { zoekTekst.value = ''; zet(Object.fromEntries(SLEUTELS.map((k) => [k, undefined]))) }
const wachten = computed(() => tel('status', 'klaar'))

// Flyout: een klik op een kaart, of ?concept=<id>.
const open = ref<any>(null)
watch(() => data.value.uitgelicht, (u) => { if (u) open.value = u }, { immediate: true })
function sluit() { open.value = null; if (q('concept')) zet({ concept: undefined }) }
async function bijgewerkt() {
  const id = open.value?.id
  await refresh()
  if (!id) return
  const nieuw = data.value.concepten.find((c: any) => c.id === id)
  open.value = nieuw ?? (await $fetch<any>('/api/concepten', { query: { ...query.value, concept: id } }).catch(() => null))?.uitgelicht ?? null
}
async function kaartGewijzigd() { await refresh() }
useHead({ title: 'Concepten · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="concepten.inbox" />
    <template v-else>
      <PaginaKop :kicker="`Concepten · ${wachten} ${wachten === 1 ? 'wacht' : 'wachten'}`" titel="Concepten" uitleg="Wat agents voor je klaarzetten. Jij keurt goed, past aan of wijst af; niets gaat zonder jou de deur uit." helpartikel="concepten-goedkeuren-en-versturen">
        <template #acties>
          <label v-if="team" class="keuze cp-team"><input type="checkbox" :checked="q('team') === '1'" data-test="concepten-team" @change="zet({ team: ($event.target as HTMLInputElement).checked ? '1' : undefined })"> Ook van mijn team</label>
        </template>
      </PaginaKop>

      <section class="cp-werkbalk-sectie">
        <div class="container">
          <div class="cp-werkbalk">
            <label class="zoekveld cp-zoek"><span class="sr-only">Zoek op account</span><Icoon naam="Search" :grootte="16" class="cp-zoek-icoon" /><input v-model="zoekTekst" type="search" class="zoekinvoer" placeholder="Zoek op account of contact" data-test="concepten-zoek"></label>
            <button type="button" class="dd-actie dd-actie--secundair" :class="{ 'cp-filters--aan': filtersOpen || actieveFilters }" :aria-expanded="filtersOpen" data-test="concepten-filters" @click="filtersOpen = !filtersOpen">
              <Icoon naam="SlidersHorizontal" class="dd-actie-icoon" />Filters<span v-if="actieveFilters" class="cp-teller">{{ actieveFilters }}</span><Icoon naam="ChevronDown" :grootte="14" class="cp-pijl" :class="{ 'cp-pijl--open': filtersOpen }" />
            </button>
          </div>
          <div class="cp-groep cp-groep--strook" role="group" aria-label="Status" data-test="filter-status">
            <button v-for="[k, l] in STATUSSEN" :key="k" type="button" class="filter-pil" :class="{ 'filter-pil--aan': q('status') === k }" :aria-pressed="q('status') === k" :data-test="`status-${k || 'open'}`" @click="zet({ status: k || undefined })">{{ l }}<span class="pil-teller tnum">{{ tel('status', k || 'open') }}</span></button>
          </div>
          <div class="cp-groep cp-groep--strook" role="group" aria-label="Soort" data-test="filter-soort">
            <button v-for="[k, l] in SOORTEN" :key="k" type="button" class="filter-pil" :class="{ 'filter-pil--aan': q('type') === k }" :aria-pressed="q('type') === k" :data-test="`soort-${k || 'alle'}`" @click="zet({ type: k || undefined })">{{ l }}<span class="pil-teller tnum">{{ k ? tel('soort', k) : somSoort }}</span></button>
          </div>
          <div v-if="filtersOpen" class="cp-paneel" data-test="concepten-filterpaneel">
            <div class="cp-groep" role="group" aria-label="Agent" data-test="filter-agent"><span class="filter-label">Agent</span>
              <button v-for="[k, l] in AGENTS" :key="k" type="button" class="filter-pil" :class="{ 'filter-pil--aan': q('agent') === k }" :aria-pressed="q('agent') === k" :data-test="`agent-${k || 'alle'}`" @click="zet({ agent: k || undefined })">{{ l }}<span class="pil-teller tnum">{{ k ? tel('agent', k) : somAgent }}</span></button>
            </div>
            <div class="cp-groep" role="group" aria-label="Periode" data-test="filter-periode"><span class="filter-label">Periode</span>
              <button v-for="[k, l] in PERIODES" :key="k" type="button" class="filter-pil" :class="{ 'filter-pil--aan': q('sinds') === k }" :aria-pressed="q('sinds') === k" :data-test="`sinds-${k || 'alles'}`" @click="zet({ sinds: k || undefined })">{{ l }}</button>
            </div>
            <div v-if="actieveFilters" class="cp-groep cp-groep--eind"><button type="button" class="dd-act" data-test="concepten-reset" @click="resetFilters">Reset filters</button></div>
          </div>
        </div>
      </section>

      <section class="section section--laatste">
        <div class="container">
          <div class="cp-feedkop">
            <h2 class="cp-feedtitel tnum" data-test="concepten-aantal">{{ data.totaal }} {{ data.totaal === 1 ? 'concept' : 'concepten' }}</h2>
            <span class="cp-feedmeta">Klik op een kaart voor het volledige concept<template v-if="data.totaal > data.concepten.length"> · de nieuwste {{ data.concepten.length }} staan hier</template></span>
          </div>
          <LegeStaat v-if="!data.concepten.length" kicker="Niets gevonden" :titel="actieveFilters ? 'Geen concepten in dit filter.' : 'Geen concepten.'" :tekst="actieveFilters ? 'Probeer een breder filter of een andere periode.' : 'Wat agents voor je klaarzetten, verschijnt hier.'">
            <button v-if="actieveFilters" type="button" class="dd-act mt-8" @click="resetFilters">Toon alles</button>
          </LegeStaat>
          <div v-else class="cp-raster" data-test="concepten">
            <ConceptRasterKaart v-for="c in data.concepten" :key="c.id" :concept="c" :met-eigenaar="q('team') === '1'" @open="open = c" @gewijzigd="kaartGewijzigd" />
          </div>
        </div>
      </section>

      <ConceptFlyout :concept="open" @sluit="sluit" @gewijzigd="bijgewerkt" />
    </template>
  </div>
</template>

<style scoped>
.cp-werkbalk-sectie { padding: 0 0 8px; }
.cp-werkbalk { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.cp-zoek { flex: 1 1 260px; max-width: 420px; display: flex; align-items: center; }
.cp-zoek .zoekinvoer { width: 100%; min-height: 44px; padding-left: 36px; }
.cp-zoek-icoon { position: absolute; left: 12px; color: var(--muted); pointer-events: none; }
.cp-filters--aan { background: var(--ink); color: var(--yellow); border-color: var(--ink); }
.cp-teller { display: inline-flex; align-items: center; height: 18px; padding: 0 7px; margin-left: 2px; background: var(--yellow); color: var(--ink); font-size: 11px; font-weight: 800; border-radius: 2px; }
.cp-pijl { transition: transform var(--transition-fast); }
.cp-pijl--open { transform: rotate(180deg); }
.cp-groep { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.cp-groep .filter-label { min-width: 72px; }
.cp-groep--strook + .cp-groep--strook { margin-top: 8px; }
.cp-groep--eind { justify-content: flex-end; }
.cp-paneel { display: flex; flex-direction: column; gap: 12px; background: var(--wit); border: 1px solid var(--border); padding: 16px 18px; margin-top: 12px; }
.cp-feedkop { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
.cp-feedtitel { font-family: var(--font-serif); font-size: 22px; font-weight: 700; letter-spacing: -0.01em; margin: 0; color: var(--ink); }
.cp-feedmeta { font-size: 12px; color: var(--muted); }
.cp-raster { display: grid; grid-template-columns: 1fr; gap: var(--kaart-gap); align-items: stretch; }
@media (min-width: 720px) { .cp-raster { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 1100px) { .cp-raster { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 719px) {
  .cp-zoek { max-width: none; flex-basis: 100%; }
  .cp-groep .filter-label { width: 100%; }
  .cp-groep .filter-pil { min-height: var(--touch-target-min); }
  .cp-team { min-height: var(--touch-target-min); display: inline-flex; align-items: center; gap: 6px; }
}
</style>
