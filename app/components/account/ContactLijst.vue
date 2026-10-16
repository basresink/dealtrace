<script setup lang="ts">
// Alle contacten (F04), in de opzet van DealDrive en gelijk aan AccountLijst: kop met kruimel
// en totaal, uitleg, werkbalk (zoeken, + Contact, Filters en Meer met taak, afspraak en export), een
// uitklapbaar filterpaneel met meerekenende tellers (alles in de URL) en daarin ook de sortering
// (standaard Rol) en de weergave (lijst, compact, kaarten),
// één witte kaart met ContactRij-rijen, "Toon meer" en de stand per rol onderaan.
// Filters: eigenaar ("Van mijn accounts" staat standaard aan), rol, prospects of klanten, en
// vanaf Gevorderd bereikbaarheid, laatste contact en toestemming (bel me niet, geen mail).
// Rechtsklik op een rij opent het contextmenu (bellen, mailen, taak, afspraak, bel me niet, vertrokken).
import { CONTACTROL_LABEL, ROLLEN_CONTACT } from '~~/shared/contactgegevens'
import { telLink } from '~/utils/accountWeergave'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const pagina = ref(1)
const weergave = useCookie<'lijst' | 'compact' | 'kaarten'>('dt_weergave_contacten', { default: () => 'lijst' })
const filtersOpen = ref(false)
const nieuwOpen = ref(false)
const nieuweTaak = ref(false)
const nieuweAfspraak = ref(false)
const taakAccount = ref<{ id: string; naam: string } | null>(null)
const taakContact = ref<{ id: string; naam: string; functie?: string | null } | null>(null)
const afspraakAccount = ref<{ id: string; naam: string } | null>(null)
const zoekOpen = ref(!!route.query.q)
const zoekVeld = ref<HTMLInputElement | null>(null)
async function wisselZoek() {
  zoekOpen.value = !zoekOpen.value
  if (zoekOpen.value) { await nextTick(); zoekVeld.value?.focus() }
}
const query = computed(() => ({ ...route.query, pagina: String(pagina.value) }))
const { data, pending, refresh } = await useFetch<any>('/api/contacten', { query, default: () => ({ contacten: [], aantal: 0, totaal: 0, tellers: {}, stand: {}, kan: {} }) })
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
const iedereen = computed(() => route.query.mijn === '0')
const sort = computed(() => String(data.value.sort ?? route.query.sort ?? 'rol'))
const SORTERINGEN = [['rol', 'Rol'], ['naam', 'Naam'], ['bedrijf', 'Bedrijf'], ['laatsteContact', 'Laatste activiteit']] as const
const WEERGAVEN = [['lijst', 'Lijst', 'List'], ['compact', 'Compact', 'LayoutList'], ['kaarten', 'Kaarten', 'LayoutGrid']] as const
const sortLabel = computed(() => SORTERINGEN.find((x) => x[0] === sort.value)?.[1] ?? 'Rol')
function kiesSortering(w: string) { zetQuery({ sort: w === 'rol' ? undefined : w }) }
function kiesWeergave(w: 'lijst' | 'compact' | 'kaarten') { weergave.value = w }
const teller = (groep: string, w: string) => data.value.tellers?.[groep]?.[w] ?? 0
const groepen = computed(() => {
  const g: { sleutel: string; label: string; waarden: { w: string; label: string }[] }[] = [
    { sleutel: 'rol', label: 'Rol', waarden: ROLLEN_CONTACT.map((r) => ({ w: r, label: CONTACTROL_LABEL[r] })) },
    { sleutel: 'soort', label: 'Accounts', waarden: [{ w: 'prospect', label: 'Bij prospects' }, { w: 'klant', label: 'Bij klanten' }] },
  ]
  if (data.value.kan?.filters) {
    g.push({ sleutel: 'bereikbaarheid', label: 'Bereikbaarheid', waarden: [{ w: 'zonderEmail', label: 'Zonder e-mail' }, { w: 'zonderTelefoon', label: 'Zonder telefoon' }] })
    g.push({ sleutel: 'laatsteContact', label: 'Laatste contact', waarden: [{ w: '30', label: 'Geen contact in 30 dagen' }, { w: '90', label: 'Geen contact in 90 dagen' }] })
    g.push({ sleutel: 'toestemming', label: 'Toestemming', waarden: [{ w: 'belMeNiet', label: 'Bel me niet' }, { w: 'geenMail', label: 'Geen mailtoestemming' }] })
  }
  return g
})
// Oude links (zonderEmail=1, geenContact=30) blijven werken; ze tellen hier ook als actief filter.
const OUD: Record<string, [string, string]> = { zonderEmail: ['bereikbaarheid', 'zonderEmail'], zonderTelefoon: ['bereikbaarheid', 'zonderTelefoon'] }
const actief = (groep: string, w: string) => lijst(groep).includes(w) || Object.entries(OUD).some(([k, [g, v]]) => g === groep && v === w && route.query[k] === '1') || (groep === 'laatsteContact' && route.query.geenContact === w)
const actieveFilters = computed(() => groepen.value.reduce((s, g) => s + g.waarden.filter((w) => actief(g.sleutel, w.w)).length, 0) + (iedereen.value ? 1 : 0))
function wisselFilter(groep: string, w: string) {
  const oud = Object.entries(OUD).find(([, [g, v]]) => g === groep && v === w)?.[0]
  if (oud && route.query[oud] === '1') { zetQuery({ [oud]: undefined }); return }
  if (groep === 'laatsteContact' && route.query.geenContact === w) { zetQuery({ geenContact: undefined }); return }
  wissel(groep, w)
}

// Contextmenu (rechtsklik of lang drukken).
const menu = ref<{ x: number; y: number; c: any } | null>(null)
function openMenu(e: MouseEvent, c: any) { e.preventDefault(); menu.value = { x: Math.min(e.clientX, window.innerWidth - 230), y: Math.min(e.clientY, window.innerHeight - 380), c } }
function sluitMenus() { menu.value = null }
function opEscape(e: KeyboardEvent) { if (e.key === 'Escape' && menu.value) sluitMenus() }
onMounted(() => { window.addEventListener('click', sluitMenus); window.addEventListener('keydown', opEscape) })
onBeforeUnmount(() => { window.removeEventListener('click', sluitMenus); window.removeEventListener('keydown', opEscape) })
function taakVoor(c: any | null) { taakAccount.value = c ? { id: c.accountId, naam: c.bedrijf } : null; taakContact.value = c ? { id: c.id, naam: c.naam, functie: c.functie ?? null } : null; nieuweTaak.value = true }
function afspraakVoor(c: any | null) { afspraakAccount.value = c ? { id: c.accountId, naam: c.bedrijf } : null; nieuweAfspraak.value = true }
async function wijzig(c: any, patch: Record<string, unknown>, melding: string) {
  try { await $fetch(`/api/contacten/${c.id}`, { method: 'PUT', body: patch }); toast.toon(melding); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const nummer = (c: any) => c.mobiel ?? c.telefoon

async function aangemaakt(id: string) { nieuwOpen.value = false; await navigateTo(`/contacten/${id}`) }
const exportUrl = computed(() => `/api/contacten/export?${new URLSearchParams(Object.entries(route.query).filter(([, v]) => typeof v === 'string') as [string, string][]).toString()}`)
// Minder gebruikte acties staan onder Meer, zodat de kop op een laptop op één regel blijft.
const meerItems = computed(() => [
  { label: 'Nieuwe taak', icoon: 'ListTodo', actie: () => taakVoor(null), test: 'lijst-taak' },
  { label: 'Nieuwe afspraak', icoon: 'CalendarCheck', actie: () => afspraakVoor(null), test: 'lijst-afspraak' },
  ...(data.value?.kan?.export ? [{ label: 'Exporteren', icoon: 'Download', href: exportUrl.value, test: 'exporteren' }] : []),
])
const resultaat = computed(() => `${data.value.aantal} ${data.value.aantal === 1 ? 'contact' : 'contacten'}`)
</script>

<template>
  <div>
    <section class="section">
      <div class="container">
        <div class="sec-head sec-head--naast">
          <div class="sec-head-tekst">
            <NuxtLink to="/contacten" class="kicker kicker--paars lijst-kruimel" data-test="kruimel"><Icoon naam="ArrowLeft" :grootte="14" /> Contacten · {{ data.totaal }} contacten totaal</NuxtLink>
            <h1 class="title title--groot">Alle contacten</h1>
            <p class="subtitle subtitle--groot">Zoek op naam, functie of bedrijf. Filter op rol om snel beslissers, champions of beïnvloeders te vinden.</p>
          </div>
          <div class="toolbar-buttons lijst-werkbalk" data-test="werkbalk">
            <KopIconen artikel="contacten" :zoeken="{ actie: wisselZoek, aan: zoekOpen, label: 'Zoeken in contacten', test: 'zoek-knop' }" />
            <button type="button" class="dd-actie dd-actie--zwart" data-test="nieuw-contact-knop" @click="nieuwOpen = true"><Icoon naam="Plus" class="dd-actie-icoon" />Contact</button>
            <button type="button" class="dd-actie dd-actie--secundair" :class="{ 'dd-actie--filters-aan': filtersOpen || actieveFilters }" :aria-expanded="filtersOpen" data-test="filters-knop" @click="filtersOpen = !filtersOpen">
              <Icoon naam="Filter" class="dd-actie-icoon" />Filters<span v-if="actieveFilters" class="pil-teller pil-teller--zwart">{{ actieveFilters }}</span><Icoon naam="ChevronDown" :grootte="14" class="keuzemenu-pijl" :class="{ 'keuzemenu-pijl--open': filtersOpen }" />
            </button>
            <KopMeer :items="meerItems" />
          </div>
        </div>
        <div v-if="zoekOpen" class="werkbalk">
          <input ref="zoekVeld" v-model="zoek" class="invoer zoekinvoer" type="search" placeholder="Zoek op naam, functie of bedrijf" aria-label="Zoeken" data-test="zoek">
        </div>
        <div v-show="filtersOpen" class="filterpaneel mt-16" data-test="filterpaneel">
          <div class="filter-groep" role="group" aria-label="Eigenaar">
            <span class="filter-label">Eigenaar</span>
            <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': !iedereen }" :aria-pressed="!iedereen" data-test="van-mijn" @click="zetQuery({ mijn: undefined })">Van mijn accounts</button>
            <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': iedereen }" :aria-pressed="iedereen" data-test="iedereen" @click="zetQuery({ mijn: '0' })">Iedereen</button>
          </div>
          <div v-for="g in groepen" :key="g.sleutel" class="filter-groep" role="group" :aria-label="g.label">
            <span class="filter-label">{{ g.label }}</span>
            <button
              v-for="w in g.waarden" :key="w.w" type="button" class="filter-pil" :class="{ 'filter-pil--aan': actief(g.sleutel, w.w) }"
              :aria-pressed="actief(g.sleutel, w.w)" :disabled="!actief(g.sleutel, w.w) && teller(g.sleutel, w.w) === 0" :data-test="`filter-${g.sleutel}-${w.w}`" @click="wisselFilter(g.sleutel, w.w)"
            >{{ w.label }} <span class="pil-teller">{{ teller(g.sleutel, w.w) }}</span></button>
          </div>
          <div class="filter-groep" role="radiogroup" aria-label="Sorteer op" data-test="filter-sortering">
            <span class="filter-label">Sorteer op</span>
            <button v-for="o in SORTERINGEN" :key="o[0]" type="button" role="radio" class="filter-pil" :class="{ 'filter-pil--aan': sort === o[0] }" :aria-checked="sort === o[0]" :data-test="`sorteer-${o[0]}`" @click="kiesSortering(o[0])">{{ o[1] }}</button>
          </div>
          <div v-if="data.kan?.weergaven" class="filter-groep" role="radiogroup" aria-label="Weergave" data-test="filter-weergave">
            <span class="filter-label">Weergave</span>
            <button v-for="w in WEERGAVEN" :key="w[0]" type="button" role="radio" class="filter-pil" :class="{ 'filter-pil--aan': weergave === w[0] }" :aria-checked="weergave === w[0]" :data-test="`weergave-${w[0]}`" @click="kiesWeergave(w[0])"><Icoon :naam="w[2]" :grootte="14" class="ct-pil-icoon" />{{ w[1] }}</button>
          </div>
          <div class="filter-groep filter-groep--eind"><button type="button" class="dd-tekstknop" data-test="reset-filters" @click="zoek = ''; router.replace({ query: {} })">Reset filters</button></div>
        </div>
      </div>
    </section>
    <section class="section section--alt">
      <div class="container">
        <p class="meta lijst-aantal"><span data-test="aantal">{{ resultaat }}</span> · {{ iedereen ? 'Iedereen' : 'Van mijn accounts' }} · gesorteerd op {{ sortLabel.toLowerCase() }}</p>
        <div v-if="!data.contacten.length && !pending" class="lege-staat" data-test="lege-staat">
          <p class="lege-staat-titel">Niets gevonden.</p>
          <p class="meta">{{ route.query.q ? `Geen contact met "${route.query.q}" in naam, functie of bedrijf.` : 'Geen contacten binnen deze filters.' }}</p>
          <button type="button" class="dd-act mt-16" @click="zoek = ''; router.replace({ query: { mijn: '0' } })">Toon alles</button>
        </div>
        <ul v-else class="ct-lijst" :class="`ct-lijst--${weergave}`" data-test="contacten-tabel">
          <ContactRij v-for="c in data.contacten" :key="c.id" :contact="c" :weergave="weergave" @contextmenu="openMenu($event, c)" />
        </ul>
        <button v-if="data.meer" type="button" class="dd-act mt-16" data-test="toon-meer" @click="pagina++">Toon meer</button>
      </div>
    </section>
    <section class="section section--laatste">
      <div class="container">
        <dl class="ct-stand" data-test="contact-stand">
          <div><dt>Beslissers</dt><dd class="tnum">{{ data.stand?.beslissers ?? 0 }}</dd></div>
          <div><dt>Champions</dt><dd class="tnum">{{ data.stand?.champions ?? 0 }}</dd></div>
          <div><dt>Beïnvloeders</dt><dd class="tnum">{{ data.stand?.beinvloeders ?? 0 }}</dd></div>
          <div><dt>Accounts</dt><dd class="tnum">{{ data.stand?.accounts ?? 0 }}</dd></div>
        </dl>
      </div>
    </section>
    <Teleport to="body">
      <div v-if="menu" class="contextmenu" :style="{ left: `${menu.x}px`, top: `${menu.y}px` }" role="menu" data-test="contextmenu" @click.stop>
        <NuxtLink role="menuitem" :to="`/contacten/${menu.c.id}`">Open contact</NuxtLink>
        <NuxtLink role="menuitem" :to="`/accounts/${menu.c.accountId}`">Open {{ menu.c.bedrijf }}</NuxtLink>
        <a v-if="nummer(menu.c) && !menu.c.belMeNiet" role="menuitem" :href="telLink(nummer(menu.c))">Bel {{ menu.c.voornaam || menu.c.naam }}</a>
        <a v-if="menu.c.email && menu.c.consent?.email?.status !== 'nee'" role="menuitem" :href="`mailto:${menu.c.email}`">Stuur e-mail</a>
        <button type="button" role="menuitem" @click="taakVoor(menu.c); menu = null">Nieuwe taak</button>
        <button type="button" role="menuitem" @click="afspraakVoor(menu.c); menu = null">Plan afspraak</button>
        <button type="button" role="menuitem" data-test="menu-bel-me-niet" @click="wijzig(menu.c, { belMeNiet: !menu.c.belMeNiet }, menu.c.belMeNiet ? 'Bel me niet staat uit.' : 'Staat op de bel-me-niet-lijst.'); menu = null">{{ menu.c.belMeNiet ? 'Bel me niet uitzetten' : 'Bel me niet' }}</button>
        <button type="button" role="menuitem" @click="wijzig(menu.c, { status: menu.c.status === 'vertrokken' ? 'actief' : 'vertrokken' }, menu.c.status === 'vertrokken' ? 'Weer actief.' : 'Gemarkeerd als vertrokken.'); menu = null">{{ menu.c.status === 'vertrokken' ? 'Weer actief' : 'Markeer als vertrokken' }}</button>
        <NuxtLink v-if="data.kan?.verhuizen" role="menuitem" :to="`/contacten/${menu.c.id}`">Verhuis naar ander bedrijf</NuxtLink>
      </div>
    </Teleport>
    <NieuwContactFlyout :open="nieuwOpen" @sluit="nieuwOpen = false" @aangemaakt="aangemaakt" />
    <NieuweTaakFlyout :open="nieuweTaak" :account="taakAccount" :contact="taakContact" @sluit="nieuweTaak = false" @gemaakt="nieuweTaak = false; refresh()" />
    <PlanAfspraakFlyout :open="nieuweAfspraak" :account="afspraakAccount" @sluit="nieuweAfspraak = false" @gepland="(id: string) => { nieuweAfspraak = false; navigateTo(`/agenda?weergave=dag&afspraak=${id}`) }" />
  </div>
</template>

<style scoped>
.ct-pil-icoon { margin-right: 6px; }
.ct-lijst { margin: 0; padding: 0; list-style: none; background: var(--wit); border: 1px solid var(--border); }
.ct-lijst--kaarten { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); background: transparent; border: 0; }
.ct-stand { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin: 0; }
.ct-stand div { display: flex; flex-direction: column-reverse; gap: 4px; padding: 16px 20px; border-left: 3px solid var(--yellow); background: var(--wit); }
.ct-stand dt { font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.ct-stand dd { margin: 0; font-family: var(--font-serif); font-size: 28px; font-weight: 700; line-height: 1.1; color: var(--ink); }
@media (max-width: 719px) {
  .ct-lijst--kaarten { grid-template-columns: 1fr; }
  .ct-stand { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
