<script setup lang="ts">
// Inzichtenfeed in de opzet van DealDrive (pagina /inzichten en het tabblad Inzichten van Acties):
// werkbalk met Alle, Klanten en Prospects, Filters (gelezen, bron, agent, periode, fase, tegengehouden),
// statkaarten die ook filteren, "Waarom niet?" (Expert), een kopregel met het aantal en een raster van
// InzichtKaart (3 per rij, 2 op een tablet, 1 op de telefoon). Alle filters staan in de URL.
// Een klik op een kaart opent de InzichtFlyout; ?inzicht=<id> opent er meteen een.
const props = defineProps<{ metKop?: boolean }>()
const emit = defineEmits<{ gewijzigd: [] }>()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { functie } = useMe()
const magAfwijzen = computed(() => !!functie('inzichten.afwijzen')?.beschikbaar)
const magWaaromNiet = computed(() => !!functie('agents.waaromNiet')?.beschikbaar)
const magMetBron = computed(() => !!functie('inzichten.handmatig')?.beschikbaar)

const SLEUTELS = ['gelezen', 'soort', 'bron', 'agent', 'sinds', 'fase', 'teller'] as const
const q = (k: string) => (typeof route.query[k] === 'string' ? (route.query[k] as string) : '')
const query = computed(() => Object.fromEntries([...SLEUTELS, 'inzicht'].map((k) => [k, q(k) || undefined])))
const { data, refresh } = await useFetch<any>('/api/signals', { query, default: () => ({ inzichten: [], tellers: {}, fases: [], uitgelicht: null }) })
const versie = useState('motorVersie', () => 0)
watch(versie, () => refresh())

function zet(p: Record<string, string | undefined>) {
  const n: Record<string, any> = { ...route.query, ...p }
  for (const k of Object.keys(n)) if (!n[k]) delete n[k]
  router.replace({ query: n })
}
const filtersOpen = ref(false)
const actieveFilters = computed(() => ['gelezen', 'bron', 'agent', 'sinds', 'fase'].filter((k) => q(k)).length)
function resetFilters() { zet(Object.fromEntries(SLEUTELS.map((k) => [k, undefined]))); toonTegengehouden(false) }

const SOORTEN = [['', 'Alle'], ['klant', 'Klanten'], ['prospect', 'Prospects']] as const
const GELEZEN = [['', 'Ongelezen'], ['gelezen', 'Gelezen'], ['alle', 'Beide']] as const
const BRONNEN = [['', 'Alle'], ['extern', 'Extern'], ['intern', 'Intern']] as const
const PERIODES = [['', 'Alles'], ['vandaag', 'Vandaag'], ['week', 'Afgelopen week'], ['maand', 'Afgelopen maand'], ['kwartaal', 'Afgelopen kwartaal']] as const
const AGENT_NAAM: Record<string, string> = { waarnemer: 'Waarnemer', verrijker: 'Verrijker', profielbouwer: 'Profielbouwer', notulist: 'Notulist', handmatig: 'Handmatig' }
const AGENTS = computed(() => [['', 'Alle'], ['motor', 'Motor'], ...Object.entries(AGENT_NAAM)] as [string, string][])
const TELLERS = [['nieuw', 'Nieuw', 'vandaag binnen'], ['hot', 'Hot', 'relevantie 75 of hoger'], ['week', 'Deze week', 'afgelopen 7 dagen'], ['', 'Totaal open', 'in dit filter']] as const

// Tegengehouden (Expert) en "Waarom niet?".
const tegengehouden = ref<any[] | null>(null)
async function toonTegengehouden(aan: boolean) { tegengehouden.value = aan ? await $fetch<any[]>('/api/signals/tegengehouden').catch(() => []) : null }
const waaromNiet = ref<any[] | null>(null)
async function laadWaaromNiet() { if (!waaromNiet.value) waaromNiet.value = await $fetch<any[]>('/api/agents/tegengehouden').catch(() => []) }

// Flyouts en acties.
const open = ref<any>(null)
const metBron = ref(false)
watch(() => data.value.uitgelicht, (u) => { if (u) open.value = u }, { immediate: true })
function sluit() { open.value = null; if (q('inzicht')) zet({ inzicht: undefined }) }
async function bijgewerkt() { await refresh(); emit('gewijzigd') }
async function maakTaak(i: any) {
  try { await $fetch(`/api/signals/${i.id}/omzetten`, { method: 'POST', body: {} }); toast.toon('Taak gemaakt uit het inzicht.'); await bijgewerkt() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function markeer(i: any) {
  try { await $fetch(`/api/signals/${i.id}/gelezen`, { method: 'POST' }); await bijgewerkt() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const gefilterd = computed(() => actieveFilters.value > 0 || !!q('soort') || !!q('teller'))
defineExpose({ refresh })
</script>

<template>
  <div class="if">
    <section :class="props.metKop ? 'section' : 'if-werkbalk-sectie'">
      <div class="container">
        <div :class="props.metKop ? 'sec-head' : 'if-werkbalk'">
          <div v-if="props.metKop">
            <span class="kicker kicker--streep">Accounts · Inzichten</span>
            <h1 class="title title--groot" data-test="inzichten-titel">Wat speelt er bij je accounts?</h1>
            <p class="subtitle subtitle--groot">Interne en externe inzichten uit je CRM, nieuws, vacatures, KvK en bedrijfssites, gefilterd op je accounts. Elk inzicht heeft een AI-context en directe acties.</p>
          </div>
          <div class="toolbar-buttons if-knoppen">
            <div class="keuzegroep" role="radiogroup" aria-label="Soort account" data-test="filter-soort">
              <button v-for="[k, l] in SOORTEN" :key="k" type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': q('soort') === k }" :aria-pressed="q('soort') === k" @click="zet({ soort: k || undefined })">{{ l }}</button>
            </div>
            <button type="button" class="dd-actie dd-actie--secundair" :class="{ 'if-filters--aan': filtersOpen || actieveFilters }" :aria-expanded="filtersOpen" data-test="inzicht-filters" @click="filtersOpen = !filtersOpen">
              <Icoon naam="SlidersHorizontal" class="dd-actie-icoon" />Filters<span v-if="actieveFilters" class="if-teller">{{ actieveFilters }}</span><Icoon naam="ChevronDown" :grootte="14" class="if-pijl" :class="{ 'if-pijl--open': filtersOpen }" />
            </button>
            <button v-if="magMetBron" type="button" class="dd-actie dd-actie--secundair" data-test="inzicht-met-bron-knop" @click="metBron = true"><Icoon naam="Plus" class="dd-actie-icoon" />Inzicht met bron</button>
            <HulpKnop v-if="props.metKop" artikel="inzichten" />
          </div>
        </div>
      </div>
    </section>

    <section v-if="filtersOpen" class="if-filter-sectie">
      <div class="container">
        <div class="if-paneel" data-test="inzicht-filterpaneel">
          <div class="if-groep"><span class="filter-label">Gelezen</span>
            <button v-for="[k, l] in GELEZEN" :key="k" type="button" class="filter-pil" :class="{ 'filter-pil--aan': q('gelezen') === k }" :aria-pressed="q('gelezen') === k" :data-test="`gelezen-${k || 'ongelezen'}`" @click="zet({ gelezen: k || undefined })">{{ l }}</button>
          </div>
          <div class="if-groep"><span class="filter-label">Bronnen</span>
            <button v-for="[k, l] in BRONNEN" :key="k" type="button" class="filter-pil" :class="{ 'filter-pil--aan': q('bron') === k }" :aria-pressed="q('bron') === k" @click="zet({ bron: k || undefined })">{{ l }}</button>
          </div>
          <div v-if="magAfwijzen" class="if-groep" data-test="filter-agent"><span class="filter-label">Agent</span>
            <button v-for="[k, l] in AGENTS" :key="k" type="button" class="filter-pil" :class="{ 'filter-pil--aan': q('agent') === k }" :aria-pressed="q('agent') === k" :data-test="`agent-${k || 'alle'}`" @click="zet({ agent: k || undefined })">{{ l }}</button>
          </div>
          <div class="if-groep"><span class="filter-label">Periode</span>
            <button v-for="[k, l] in PERIODES" :key="k" type="button" class="filter-pil" :class="{ 'filter-pil--aan': q('sinds') === k }" :aria-pressed="q('sinds') === k" :data-test="`sinds-${k || 'alles'}`" @click="zet({ sinds: k || undefined })">{{ l }}</button>
          </div>
          <div class="if-groep if-groep--onder">
            <label v-if="data.fases.length || q('fase')" class="if-fase"><span class="filter-label">Fase</span>
              <select class="invoer invoer--klein" :value="q('fase')" aria-label="Fase" data-test="filter-fase" @change="zet({ fase: ($event.target as HTMLSelectElement).value || undefined })"><option value="">Alle fases</option><option v-for="f in data.fases" :key="f.id" :value="f.id">{{ f.label }}</option></select>
            </label>
            <label v-if="magWaaromNiet" class="schakel-inline"><input type="checkbox" :checked="!!tegengehouden" data-test="toon-tegengehouden" @change="toonTegengehouden(($event.target as HTMLInputElement).checked)"> Toon tegengehouden</label>
            <span class="dd-acties-vul" />
            <button v-if="actieveFilters || tegengehouden" type="button" class="dd-act" data-test="reset-filters" @click="resetFilters">Reset filters</button>
          </div>
        </div>
      </div>
    </section>

    <section class="if-stats">
      <div class="container">
        <div class="stat-grid stat-grid--4">
          <button v-for="[k, l, voet] in TELLERS" :key="k" type="button" class="stat-card" :class="{ 'stat-card--actief': q('teller') === k }" :aria-pressed="q('teller') === k" :data-test="`inzicht-stat-${k || 'totaal'}`" @click="zet({ teller: q('teller') === k ? undefined : k || undefined })">
            <span class="stat-label">{{ l }}</span><span class="stat-num tnum">{{ data.tellers[k || 'totaal'] ?? 0 }}</span><span class="stat-foot">{{ voet }}</span>
          </button>
        </div>
        <details v-if="magWaaromNiet" class="kaart mt-16" data-test="waarom-niet" @toggle="laadWaaromNiet">
          <summary class="kaart-titel">Waarom niet?</summary>
          <p class="kaart-meta mt-8">Wat de Bewaker vandaag bij je accounts tegenhield, met de reden.</p>
          <p v-if="waaromNiet && !waaromNiet.length" class="kaart-meta mt-8">De Bewaker heeft vandaag niets tegengehouden.</p>
          <ul v-else-if="waaromNiet" class="schakel-lijst mt-8">
            <li v-for="r in waaromNiet" :key="r.id" class="schakel-rij"><span><strong>{{ r.reden }}</strong><br><span class="meta">{{ r.handeling }}<template v-if="r.account"> · {{ r.account }}</template></span></span></li>
          </ul>
        </details>
      </div>
    </section>

    <section class="section section--laatste">
      <div class="container">
        <div class="if-feedkop">
          <h2 class="if-feedtitel tnum" data-test="inzichten-aantal">{{ data.inzichten.length }} {{ data.inzichten.length === 1 ? 'inzicht' : 'inzichten' }}</h2>
          <span class="if-feedmeta">Klik op een kaart voor de volledige context</span>
        </div>
        <LegeStaat v-if="!data.inzichten.length" kicker="Niets gevonden" :titel="gefilterd ? 'Geen inzichten in dit filter.' : 'Geen nieuwe inzichten.'" :tekst="gefilterd ? 'Probeer een breder filter of een andere periode.' : 'De agents hebben sinds gisteren niets gevonden bij je accounts.'">
          <button v-if="gefilterd" type="button" class="dd-act mt-8" @click="zet({ soort: undefined, teller: undefined }); resetFilters()">Toon alles</button>
        </LegeStaat>
        <div v-else class="if-raster" data-test="inzichten">
          <InzichtKaart v-for="i in data.inzichten" :key="i.id" :inzicht="i" @open="open = i" @taak="maakTaak(i)" @gelezen="markeer(i)" />
        </div>

        <div v-if="tegengehouden" class="mt-24" data-test="tegengehouden">
          <h2 class="if-feedtitel if-feedtitel--klein">Tegengehouden</h2>
          <p v-if="!tegengehouden.length" class="kaart-meta mt-8">Er is de laatste 30 dagen niets tegengehouden.</p>
          <div v-else class="if-raster mt-16">
            <article v-for="t in tegengehouden" :key="t.id" class="kaart inzicht-kaart inzicht-kaart--grijs">
              <div class="taak-labels"><span class="pil pil--leeg">TEGENGEHOUDEN</span><span class="taak-meta">{{ t.specifiekeBron }} · {{ new Date(t.createdAt).toLocaleDateString('nl-NL') }}</span></div>
              <p class="taak-titel">{{ t.title }}</p>
              <p class="taak-meta">{{ t.reden }}<template v-if="t.account"> · {{ t.account.naam }}</template></p>
            </article>
          </div>
        </div>
      </div>
    </section>

    <InzichtMetBron :open="metBron" @sluit="metBron = false" @opgeslagen="bijgewerkt" />
    <InzichtFlyout :open="!!open" :inzicht="open" @sluit="sluit" @gewijzigd="bijgewerkt" />
  </div>
</template>

<style scoped>
.if-werkbalk-sectie { padding: 0 0 8px; }
.if-werkbalk { display: flex; justify-content: flex-end; }
.if-knoppen { align-items: center; }
.if-filters--aan { background: var(--ink); color: var(--yellow); border-color: var(--ink); }
.if-teller { display: inline-flex; align-items: center; height: 18px; padding: 0 7px; margin-left: 2px; background: var(--yellow); color: var(--ink); font-size: 11px; font-weight: 800; border-radius: 2px; }
.if-pijl { transition: transform var(--transition-fast); }
.if-pijl--open { transform: rotate(180deg); }
.if-filter-sectie { padding: 16px 0 0; }
.if-paneel { display: flex; flex-direction: column; gap: 12px; background: var(--wit); border: 1px solid var(--border); padding: 16px 18px; }
.if-groep { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.if-groep .filter-label { min-width: 72px; }
.if-groep--onder { gap: 12px; }
.if-fase { display: inline-flex; align-items: center; gap: 8px; }
.if-stats { padding: 16px 0 0; }
.if-feedkop { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
.if-feedtitel { font-family: var(--font-serif); font-size: 22px; font-weight: 700; letter-spacing: -0.01em; margin: 0; color: var(--ink); }
.if-feedtitel--klein { font-size: 18px; }
.if-feedmeta { font-size: 12px; color: var(--muted); }
.if-raster { display: grid; grid-template-columns: 1fr; gap: var(--kaart-gap); align-items: stretch; }
@media (min-width: 720px) { .if-raster { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 1100px) { .if-raster { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 719px) {
  .if-werkbalk { justify-content: stretch; }
  .if-knoppen { width: 100%; }
  .if-groep .filter-label { width: 100%; }
}
</style>
