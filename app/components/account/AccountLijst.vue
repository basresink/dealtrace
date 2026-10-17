<script setup lang="ts">
// De lijst voor prospects en klanten (F03), in de opzet van DealDrive: kop met kruimel,
// werkbalk (zoeken, AI en hulp, nieuw, filters en Meer met taak, afspraak en export), een uitklapbare filterstrook
// met het zoekveld, de weergave, de sortering en meerekenende tellers (in de URL) en één witte kaart met AccountRij-rijen.
// Contextmenu en "Toon meer" blijven.
import { BEREIK_LABEL, CONTACT_LABEL, STATUS_LABEL, telLink } from '~/utils/accountWeergave'

const props = defineProps<{ soort: 'prospect' | 'klant' }>()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const pagina = ref(1)
const weergave = useCookie<'lijst' | 'compact' | 'kaarten'>('dt_weergave', { default: () => 'lijst' })
const filtersOpen = ref(!!route.query.q)
const nieuwOpen = ref(false)
const nieuweTaak = ref(false)
const nieuweAfspraak = ref(false)
const taakAccount = ref<{ id: string; naam: string } | null>(null)
const afspraakAccount = ref<{ id: string; naam: string } | null>(null)
const keuzemenu = ref<'sortering' | null>(null)
// Zoeken in de lijst en de weergave staan in het filterpaneel; het vergrootglas in de kop opent het zoekvenster.
const query = computed(() => ({ ...route.query, soort: props.soort, pagina: String(pagina.value) }))
const { data, pending, refresh } = await useFetch<any>('/api/accounts', { query, default: () => ({ rijen: [], tellers: {}, klassen: [], eigenVelden: [], kan: {}, totaal: 0, aantal: 0 }) })
const zoek = ref(String(route.query.q ?? ''))
let zoekTimer: any
watch(zoek, (v) => { clearTimeout(zoekTimer); zoekTimer = setTimeout(() => zetQuery({ q: v || undefined }), 300) })

function lijst(k: string): string[] { const v = route.query[k]; return typeof v === 'string' && v ? v.split(',') : [] }
function zetQuery(p: Record<string, string | undefined>) {
  pagina.value = 1
  const q: Record<string, any> = { ...route.query, ...p }
  for (const k of Object.keys(q)) if (q[k] === undefined || q[k] === '') delete q[k]
  router.replace({ query: q })
}
function wissel(groep: string, waarde: string) {
  const huidig = lijst(groep)
  const nieuw = huidig.includes(waarde) ? huidig.filter((w) => w !== waarde) : [...huidig, waarde]
  zetQuery({ [groep]: nieuw.join(',') || undefined })
}
const eigenaar = computed(() => String(route.query.eigenaar ?? 'mij'))
const sort = computed(() => String(route.query.sort ?? 'score'))
const SORTERINGEN = [['score', 'Score'], ['naam', 'Naam'], ['laatsteContact', 'Laatste contact'], ['klasse', 'Klasse'], ['dagenInFase', 'Dagen in fase']] as const
const WEERGAVEN = [['lijst', 'Lijst', 'List'], ['compact', 'Compact', 'LayoutList'], ['kaarten', 'Kaarten', 'LayoutGrid']] as const
const sortLabel = computed(() => SORTERINGEN.find((x) => x[0] === sort.value)?.[1] ?? 'Score')
const EIGENAAR = [['mij', 'Van mij'], ['team', 'Team'], ['iedereen', 'Iedereen']] as const
const eigenaarLabel = computed(() => EIGENAAR.find((x) => x[0] === eigenaar.value)?.[1] ?? 'Van mij')
function kiesSortering(w: string) { keuzemenu.value = null; zetQuery({ sort: w === 'score' ? undefined : w }) }
function wisselFilters() { filtersOpen.value = !filtersOpen.value }
const actieveFilters = computed(() => (actief.value !== 'actief' ? 1 : 0) + ['status', 'fase', 'klasse', 'aanleiding', 'laatsteContact', 'bereikbaarheid', ...Object.keys(route.query).filter((k) => k.startsWith('cf.'))].reduce((s, k) => s + lijst(k).length, 0))
const teller = (groep: string, w: string) => data.value.tellers?.[groep]?.[w] ?? 0
// 0064: Status actief, gedeactiveerd of alle; standaard alleen actieve prospects (één keuze, in de URL als ?actief=).
const ACTIEF = [['actief', 'Actief'], ['gedeactiveerd', 'Gedeactiveerd'], ['alle', 'Alle']] as const
const actief = computed(() => String(route.query.actief ?? 'actief'))
const groepen = computed(() => {
  const g: { sleutel: string; label: string; waarden: { w: string; label: string }[] }[] = []
  if (props.soort === 'prospect') g.push({ sleutel: 'status', label: 'Reisstatus', waarden: ['nieuw', 'in reis', 'wachtend', 'nee', 'gescoord'].map((w) => ({ w, label: STATUS_LABEL[w]! })) })
  if (props.soort === 'prospect' && data.value.kan?.reisFilter) g.push({ sleutel: 'fase', label: 'Reis en fase', waarden: (data.value.fases ?? []).map((f: any) => ({ w: f.id, label: f.label })) })
  g.push({ sleutel: 'klasse', label: 'Klasse', waarden: [...(data.value.klassen ?? []).map((k: any) => ({ w: k.id, label: k.naam.split('·')[0].trim() })), { w: 'geen', label: 'Geen klasse' }] })
  if (data.value.kan?.alleFilters) {
    g.push({ sleutel: 'aanleiding', label: 'Aanleiding', waarden: [{ w: 'met', label: 'Met aanleiding' }] })
    g.push({ sleutel: 'laatsteContact', label: 'Laatste contact', waarden: ['nooit', '30', '90'].map((w) => ({ w, label: CONTACT_LABEL[w]! })) })
    g.push({ sleutel: 'bereikbaarheid', label: 'Bereikbaarheid', waarden: Object.entries(BEREIK_LABEL).map(([w, label]) => ({ w, label })) })
  }
  for (const v of data.value.eigenVelden ?? []) g.push({ sleutel: `cf.${v.sleutel}`, label: v.naam, waarden: v.type === 'janee' ? [{ w: 'ja', label: 'Ja' }, { w: 'nee', label: 'Nee' }] : v.opties.map((o: any) => ({ w: o.waarde, label: o.label })) })
  return g
})

// Contextmenu (rechtsklik of lang drukken).
const menu = ref<{ x: number; y: number; rij: any } | null>(null)
function openMenu(e: MouseEvent, rij: any) { e.preventDefault(); menu.value = { x: Math.min(e.clientX, window.innerWidth - 220), y: e.clientY, rij } }
function sluitMenus() { menu.value = null; keuzemenu.value = null }
function opEscape(e: KeyboardEvent) { if (e.key === 'Escape' && (menu.value || keuzemenu.value)) sluitMenus() }
onMounted(() => { window.addEventListener('click', sluitMenus); window.addEventListener('keydown', opEscape) })
onBeforeUnmount(() => { window.removeEventListener('click', sluitMenus); window.removeEventListener('keydown', opEscape) })
const primair = (r: any) => r.contacten.find((c: any) => c.id === r.primairContact) ?? r.contacten.find((c: any) => c.rol === 'beslisser') ?? r.contacten[0]
function taakVoor(r: any | null) { taakAccount.value = r ? { id: r.id, naam: r.name } : null; nieuweTaak.value = true }
function afspraakVoor(r: any | null) { afspraakAccount.value = r ? { id: r.id, naam: r.name } : null; nieuweAfspraak.value = true }
// Minder gebruikte acties staan onder Meer, zodat de kop op een laptop op één regel blijft.
const meerItems = computed(() => [
  { label: 'Nieuwe taak', icoon: 'ListTodo', actie: () => taakVoor(null), test: 'lijst-taak' },
  { label: 'Nieuwe afspraak', icoon: 'CalendarCheck', actie: () => afspraakVoor(null), test: 'lijst-afspraak' },
  ...(data.value?.kan?.export ? [{ label: 'Exporteren', icoon: 'Download', href: exportUrl.value, test: 'exporteren' }] : []),
])

async function aangemaakt(id: string) { nieuwOpen.value = false; await navigateTo(`/accounts/${id}`) }
const exportUrl = computed(() => `/api/accounts/export?${new URLSearchParams({ ...(route.query as any), soort: props.soort }).toString()}`)
</script>

<template>
  <div>
    <PaginaKop :zonder-hulp="soort === 'prospect'">
      <template #kicker>
        <NuxtLink v-if="soort === 'prospect'" to="/prospects" class="kicker kicker--paars lijst-kruimel"><Icoon naam="ArrowLeft" :grootte="14" /> Prospects · {{ data.totaal }} prospects totaal</NuxtLink>
        <span v-else class="kicker kicker--streep">Alleen lezen · {{ data.totaal }} {{ data.totaal === 1 ? 'klant' : 'klanten' }} totaal</span>
      </template>
      <template #titel><h1 class="title title--groot">{{ soort === 'prospect' ? 'Alle prospects' : 'Bestaande klanten (uit DealDrive)' }}</h1></template>
      <template #uitleg>
        <p v-if="soort === 'prospect'" class="subtitle subtitle--groot">Alle prospects van jouw organisatie, te filteren op accountklasse en functie. Klanten zie je bij <NuxtLink to="/klanten" class="tekst-link">Bestaande klanten →</NuxtLink></p>
        <p v-else class="subtitle subtitle--groot">Klanten komen uit DealDrive of je CRM en zijn hier alleen te lezen: als bron voor kansen langs de route en warme introducties, en om klanten uit je prospectlijsten te houden. Dealtrace maakt zelf geen klant van een prospect.</p>
      </template>
      <template #acties>
        <button v-if="soort === 'prospect'" type="button" class="dd-actie dd-actie--zwart" data-test="nieuwe-prospect" @click="nieuwOpen = true"><Icoon naam="Plus" class="dd-actie-icoon" />Prospect</button>
        <button type="button" class="dd-actie dd-actie--secundair" :class="{ 'dd-actie--filters-aan': filtersOpen || actieveFilters }" :aria-expanded="filtersOpen" data-test="filters-knop" @click="wisselFilters">
          <Icoon naam="Filter" class="dd-actie-icoon" />Filters<span v-if="actieveFilters" class="pil-teller pil-teller--zwart">{{ actieveFilters }}</span><Icoon naam="ChevronDown" :grootte="14" class="keuzemenu-pijl" :class="{ 'keuzemenu-pijl--open': filtersOpen }" />
        </button>
        <KopMeer :items="meerItems" />
      </template>
      <template #na>
        <div v-show="filtersOpen" class="filterpaneel mt-16" data-test="filterpaneel">
          <div class="filter-groep">
            <label class="filter-label" for="lijst-zoek">Zoeken</label>
            <input id="lijst-zoek" v-model="zoek" class="invoer zoekinvoer lijst-zoek" type="search" placeholder="Zoek op naam of plaats" data-test="zoek">
          </div>
          <div v-if="data.kan?.weergaven" class="filter-groep" role="group" aria-label="Weergave" data-test="filter-weergave">
            <span class="filter-label">Weergave</span>
            <button v-for="w in WEERGAVEN" :key="w[0]" type="button" class="filter-pil" :class="{ 'filter-pil--aan': weergave === w[0] }" :aria-pressed="weergave === w[0]" :data-test="`weergave-${w[0]}`" @click="weergave = w[0]"><Icoon :naam="w[2]" :grootte="14" />{{ w[1] }}</button>
          </div>
          <div class="filter-groep" role="group" aria-label="Eigenaar">
            <span class="filter-label">Eigenaar</span>
            <button v-for="e in EIGENAAR" :key="e[0]" type="button" class="filter-pil" :class="{ 'filter-pil--aan': eigenaar === e[0] }" :aria-pressed="eigenaar === e[0]" :data-test="`eigenaar-${e[0]}`" @click="zetQuery({ eigenaar: e[0] === 'mij' ? undefined : e[0] })">{{ e[1] }}</button>
          </div>
          <div class="filter-groep" role="radiogroup" aria-label="Status" data-test="filter-actief">
            <span class="filter-label">Status</span>
            <button
              v-for="s in ACTIEF" :key="s[0]" type="button" role="radio" class="filter-pil" :class="{ 'filter-pil--aan': actief === s[0] }" :aria-checked="actief === s[0]"
              :data-test="`filter-actief-${s[0]}`" @click="zetQuery({ actief: s[0] === 'actief' ? undefined : s[0] })"
            >{{ s[1] }} <span class="pil-teller">{{ data.actiefTellers?.[s[0]] ?? 0 }}</span></button>
          </div>
          <div v-for="g in groepen" :key="g.sleutel" class="filter-groep">
            <span class="filter-label">{{ g.label }}</span>
            <button
              v-for="w in g.waarden" :key="w.w" type="button" class="filter-pil" :class="{ 'filter-pil--aan': lijst(g.sleutel).includes(w.w) }"
              :aria-pressed="lijst(g.sleutel).includes(w.w)" :disabled="!lijst(g.sleutel).includes(w.w) && teller(g.sleutel, w.w) === 0" :data-test="`filter-${g.sleutel}-${w.w}`" @click="wissel(g.sleutel, w.w)"
            >{{ w.label }} <span class="pil-teller">{{ teller(g.sleutel, w.w) }}</span></button>
          </div>
          <div class="filter-groep" role="radiogroup" aria-label="Sorteer op" data-test="filter-sortering">
            <span class="filter-label">Sorteer op</span>
            <button v-for="o in SORTERINGEN" :key="o[0]" type="button" role="radio" class="filter-pil" :class="{ 'filter-pil--aan': sort === o[0] }" :aria-checked="sort === o[0]" :data-test="`sorteer-${o[0]}`" @click="kiesSortering(o[0])">{{ o[1] }}</button>
          </div>
          <div class="filter-groep filter-groep--eind"><button type="button" class="dd-tekstknop" @click="router.replace({ query: {} })">Reset filters</button></div>
        </div>
      </template>
    </PaginaKop>
    <section class="section section--alt section--laatste">
      <div class="container">
        <p class="meta lijst-aantal"><span data-test="aantal">{{ data.aantal }} {{ data.aantal === 1 ? 'resultaat' : 'resultaten' }}</span> · {{ eigenaarLabel }}<template v-if="actief !== 'actief'"> · {{ actief === 'alle' ? 'actief en gedeactiveerd' : 'gedeactiveerd' }}</template> · gesorteerd op {{ sortLabel.toLowerCase() }}</p>
        <div v-if="!data.rijen.length && !pending" class="lege-staat"><p class="lege-staat-titel">Niets gevonden.</p><button type="button" class="dd-act" @click="router.replace({ query: { eigenaar: 'iedereen' } })">Toon alles</button></div>
        <ul v-else class="acc-lijst" :class="`acc-lijst--${weergave}`" data-test="account-lijst">
          <AccountRij v-for="r in data.rijen" :key="r.id" :rij="r" :klassen="data.klassen" :weergave="weergave" :toon-score="!!data.kan?.alleFilters" @contextmenu="openMenu($event, r)" />
        </ul>
        <button v-if="data.meer" type="button" class="dd-act mt-16" data-test="toon-meer" @click="pagina++">Toon meer</button>
      </div>
    </section>
    <Teleport to="body">
      <div v-if="menu" class="contextmenu" :style="{ left: `${menu.x}px`, top: `${menu.y}px` }" role="menu" data-test="contextmenu">
        <NuxtLink role="menuitem" :to="`/accounts/${menu.rij.id}`">Open kaart</NuxtLink>
        <a v-if="primair(menu.rij)?.telefoon || menu.rij.telefoon" role="menuitem" :href="telLink(primair(menu.rij)?.telefoon ?? menu.rij.telefoon)">Bel primaire contact</a>
        <a v-if="primair(menu.rij)?.email" role="menuitem" :href="`mailto:${primair(menu.rij).email}`">Stuur e-mail</a>
        <button type="button" role="menuitem" @click="taakVoor(menu.rij)">Nieuwe taak</button>
        <button type="button" role="menuitem" @click="afspraakVoor(menu.rij)">Plan afspraak</button>
      </div>
    </Teleport>
    <NieuweProspectFlyout :open="nieuwOpen" @sluit="nieuwOpen = false" @aangemaakt="aangemaakt" @bestaand="(id) => navigateTo(`/accounts/${id}`)" />
    <NieuweTaakFlyout :open="nieuweTaak" :account="taakAccount" @sluit="nieuweTaak = false" @gemaakt="nieuweTaak = false; refresh()" />
    <PlanAfspraakFlyout :open="nieuweAfspraak" :account="afspraakAccount" @sluit="nieuweAfspraak = false" @gepland="(id: string) => { nieuweAfspraak = false; navigateTo(`/agenda?weergave=dag&afspraak=${id}`) }" />
  </div>
</template>
