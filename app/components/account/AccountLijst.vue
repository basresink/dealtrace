<script setup lang="ts">
// De lijst voor prospects en klanten (F03): zoeken, filters met meerekenende
// tellers (in de URL), sortering, weergaven, contextmenu en "Toon meer".
import { BEREIK_LABEL, CONTACT_LABEL, STATUS_LABEL, STATUS_PIL, datumKort, initialen, klasseKort, telLink } from '~/utils/accountWeergave'
import { CONTACTROL_LABEL } from '~~/shared/contactgegevens'

const props = defineProps<{ soort: 'prospect' | 'klant' }>()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const pagina = ref(1)
const weergave = useCookie<'lijst' | 'compact' | 'kaarten'>('dt_weergave', { default: () => 'lijst' })
const filtersOpen = ref(false)
const nieuwOpen = ref(false)
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
const actieveFilters = computed(() => ['status', 'fase', 'klasse', 'aanleiding', 'laatsteContact', 'bereikbaarheid', ...Object.keys(route.query).filter((k) => k.startsWith('cf.'))].reduce((s, k) => s + lijst(k).length, 0))
const teller = (groep: string, w: string) => data.value.tellers?.[groep]?.[w] ?? 0
const groepen = computed(() => {
  const g: { sleutel: string; label: string; waarden: { w: string; label: string }[] }[] = []
  if (props.soort === 'prospect') g.push({ sleutel: 'status', label: 'Status', waarden: ['nieuw', 'in reis', 'wachtend', 'nee', 'gescoord'].map((w) => ({ w, label: STATUS_LABEL[w]! })) })
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
onMounted(() => window.addEventListener('click', () => { menu.value = null }))
const primair = (r: any) => r.contacten.find((c: any) => c.rol === 'beslisser') ?? r.contacten[0]

async function aangemaakt(id: string) { nieuwOpen.value = false; await navigateTo(`/accounts/${id}`) }
const exportUrl = computed(() => `/api/accounts/export?${new URLSearchParams({ ...(route.query as any), soort: props.soort }).toString()}`)
</script>

<template>
  <div>
    <section class="section">
      <div class="container">
        <div class="sec-head">
          <div>
            <NuxtLink v-if="soort === 'prospect'" to="/prospects" class="kruimel"><Icoon naam="ArrowLeft" :grootte="14" /> Prospects · {{ data.totaal }} prospects totaal</NuxtLink>
            <h1 class="title title--groot">{{ soort === 'prospect' ? 'Alle prospects' : 'Klanten' }}</h1>
            <p v-if="soort === 'klant'" class="subtitle">Klanten komen uit DealDrive of je CRM, voor kansen langs de route en winback. Dealtrace maakt zelf geen klant van een prospect.</p>
          </div>
        </div>
        <div class="werkbalk" data-test="werkbalk">
          <input v-model="zoek" class="invoer zoekinvoer" type="search" placeholder="Zoek op naam of plaats" aria-label="Zoeken" data-test="zoek">
          <button v-if="soort === 'prospect'" type="button" class="dd-actie dd-actie--primair" data-test="nieuwe-prospect" @click="nieuwOpen = true"><Icoon naam="Plus" class="dd-actie-icoon" />Prospect</button>
          <div v-if="data.kan?.weergaven" class="keuzegroep keuzegroep--klein" role="group" aria-label="Weergave">
            <button v-for="w in (['lijst', 'compact', 'kaarten'] as const)" :key="w" type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': weergave === w }" :aria-pressed="weergave === w" @click="weergave = w">{{ { lijst: 'Lijst', compact: 'Compact', kaarten: 'Kaarten' }[w] }}</button>
          </div>
          <label class="veld veld--rij"><span class="sr-only">Sortering</span>
            <select class="invoer invoer--klein" :value="sort" aria-label="Sortering" data-test="sortering" @change="zetQuery({ sort: ($event.target as HTMLSelectElement).value === 'score' ? undefined : ($event.target as HTMLSelectElement).value })">
              <option value="score">Score</option><option value="naam">Naam</option><option value="laatsteContact">Laatste contact</option><option value="klasse">Klasse</option><option value="dagenInFase">Dagen in fase</option>
            </select>
          </label>
          <button type="button" class="dd-actie dd-actie--secundair" :aria-expanded="filtersOpen" data-test="filters-knop" @click="filtersOpen = !filtersOpen"><Icoon naam="Filter" class="dd-actie-icoon" />Filters<span v-if="actieveFilters" class="pil-teller pil-teller--zwart">{{ actieveFilters }}</span></button>
          <a v-if="data.kan?.export" :href="exportUrl" class="dd-actie dd-actie--secundair"><Icoon naam="Download" class="dd-actie-icoon" />Exporteren</a>
        </div>
        <div class="filters mt-16">
          <div class="filter-groep" role="group" aria-label="Eigenaar">
            <button v-for="e in [['mij', 'Van mij'], ['team', 'Team'], ['iedereen', 'Iedereen']]" :key="e[0]" type="button" class="filter-pil" :class="{ 'filter-pil--aan': eigenaar === e[0] }" :aria-pressed="eigenaar === e[0]" :data-test="`eigenaar-${e[0]}`" @click="zetQuery({ eigenaar: e[0] === 'mij' ? undefined : e[0] })">{{ e[1] }}</button>
          </div>
        </div>
        <div v-show="filtersOpen" class="filterpaneel mt-16" data-test="filterpaneel">
          <div v-for="g in groepen" :key="g.sleutel" class="filter-groep">
            <span class="filter-label">{{ g.label }}</span>
            <button
              v-for="w in g.waarden" :key="w.w" type="button" class="filter-pil" :class="{ 'filter-pil--aan': lijst(g.sleutel).includes(w.w) }"
              :aria-pressed="lijst(g.sleutel).includes(w.w)" :disabled="!lijst(g.sleutel).includes(w.w) && teller(g.sleutel, w.w) === 0" :data-test="`filter-${g.sleutel}-${w.w}`" @click="wissel(g.sleutel, w.w)"
            >{{ w.label }} <span class="pil-teller">{{ teller(g.sleutel, w.w) }}</span></button>
          </div>
          <div class="filter-groep filter-groep--eind"><button type="button" class="dd-tekstknop" @click="router.replace({ query: {} })">Reset filters</button></div>
        </div>
      </div>
    </section>
    <section class="section section--laatste">
      <div class="container">
        <p class="meta" data-test="aantal">{{ data.aantal }} {{ data.aantal === 1 ? 'resultaat' : 'resultaten' }}</p>
        <div v-if="!data.rijen.length && !pending" class="lege-staat"><p class="lege-staat-titel">Niets gevonden.</p><button type="button" class="dd-act" @click="router.replace({ query: { eigenaar: 'iedereen' } })">Toon alles</button></div>
        <ul v-else class="account-lijst" :class="`account-lijst--${weergave}`" data-test="account-lijst">
          <li v-for="r in data.rijen" :key="r.id" class="account-rij" :data-account="r.id" @contextmenu="openMenu($event, r)">
            <NuxtLink :to="`/accounts/${r.id}`" class="account-rij-link">
              <span class="account-logo" :class="`account-logo--${r.klasse ? klasseKort(r.klasse, data.klassen).toLowerCase() : 'geen'}`">{{ initialen(r.name) }}</span>
              <span class="account-hoofd">
                <span class="account-naam"><strong>{{ r.name }}</strong>
                  <span v-if="r.klasse" class="pil pil--zwart">{{ klasseKort(r.klasse, data.klassen) }}</span>
                  <span class="pil" :class="STATUS_PIL[r.nbStatus]">{{ STATUS_LABEL[r.nbStatus] ?? r.nbStatus }}</span>
                </span>
                <span v-if="weergave !== 'compact'" class="account-meta">
                  <span v-if="r.branche">{{ r.branche }}</span><span v-if="r.city">{{ r.city }}</span>
                  <span v-if="r.telefoon">{{ r.telefoon }}</span>
                  <span>Laatste contact: {{ datumKort(r.laatsteContactOp) }}</span>
                  <span v-if="data.kan?.alleFilters">Score {{ r.score }}</span>
                </span>
                <span v-if="r.aanleiding && weergave !== 'compact'" class="account-aanleiding" :class="{ 'account-aanleiding--heet': r.aanleiding.heet }">{{ r.aanleiding.tekst }}</span>
              </span>
              <span class="account-contacten">
                <template v-if="r.contacten.length"><span v-for="c in r.contacten" :key="c.id" class="contact-bol" :title="`${c.naam} · ${CONTACTROL_LABEL[c.rol as keyof typeof CONTACTROL_LABEL] ?? c.rol}`">{{ initialen(c.naam) }}</span></template>
                <span v-else class="meta">Geen contactpersoon</span>
              </span>
            </NuxtLink>
          </li>
        </ul>
        <button v-if="data.meer" type="button" class="dd-act mt-16" data-test="toon-meer" @click="pagina++">Toon meer</button>
      </div>
    </section>
    <Teleport to="body">
      <div v-if="menu" class="contextmenu" :style="{ left: `${menu.x}px`, top: `${menu.y}px` }" role="menu" data-test="contextmenu">
        <NuxtLink role="menuitem" :to="`/accounts/${menu.rij.id}`">Open kaart</NuxtLink>
        <a v-if="primair(menu.rij)?.telefoon || menu.rij.telefoon" role="menuitem" :href="telLink(primair(menu.rij)?.telefoon ?? menu.rij.telefoon)">Bel primaire contact</a>
        <a v-if="primair(menu.rij)?.email" role="menuitem" :href="`mailto:${primair(menu.rij).email}`">Stuur e-mail</a>
      </div>
    </Teleport>
    <NieuweProspectFlyout :open="nieuwOpen" @sluit="nieuwOpen = false" @aangemaakt="aangemaakt" @bestaand="(id) => navigateTo(`/accounts/${id}`)" />
  </div>
</template>
