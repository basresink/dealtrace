<script setup lang="ts">
// Agenda (F09): dag, week of maand met afspraken (kleur per meetingsoort), belblokken, bezet uit de
// gekoppelde agenda en conflicten met een rode rand. "Gepland door" bij afspraken die een collega
// voor je plande.
import { plusDagen } from '~~/shared/datum'
const route = useRoute()
const router = useRouter()
const { functie } = useMe()
const toast = useToast()
const klasse = useSchermklasse()
const vandaag = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })
type Weergave = 'dag' | 'week' | 'maand'
// "Wie is er aan de beurt?" staat sinds de nieuwe zijbalk op /meetings; oude links gaan daarheen.
if (route.query.weergave === 'meetings') await navigateTo('/meetings', { replace: true })
const weergave = computed<Weergave>(() => (['dag', 'week', 'maand'].includes(String(route.query.weergave)) ? route.query.weergave as Weergave : 'week'))
// Op de telefoon is de dag de standaard; pas na het laden, zodat server en browser hetzelfde tonen.
onMounted(() => { if (!route.query.weergave && klasse.value === 'telefoon') zet({ weergave: 'dag' }) })
const datum = computed(() => (typeof route.query.datum === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(route.query.datum) ? route.query.datum : vandaag))
const gebruiker = computed(() => (typeof route.query.gebruiker === 'string' ? route.query.gebruiker : ''))
const filterSoort = ref('')
const filterVorm = ref('')
const zet = (q: Record<string, string | undefined>) => router.replace({ query: { ...route.query, ...q } })
const wd = (d: string) => (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7
const periode = computed(() => {
  const d = datum.value
  if (weergave.value === 'dag') return { van: d, tot: plusDagen(d, 1), dagen: [d] }
  if (weergave.value === 'maand') {
    const eerste = `${d.slice(0, 8)}01`
    const start = plusDagen(eerste, -wd(eerste))
    const dagen = Array.from({ length: 42 }, (_, i) => plusDagen(start, i))
    return { van: start, tot: plusDagen(start, 42), dagen }
  }
  const ma = plusDagen(d, -wd(d))
  return { van: ma, tot: plusDagen(ma, 7), dagen: Array.from({ length: 5 }, (_, i) => plusDagen(ma, i)) }
})
const { data, refresh } = await useFetch<any>('/api/agenda', { query: computed(() => ({ van: periode.value.van, tot: periode.value.tot, gebruiker: gebruiker.value || undefined })), default: () => ({ afspraken: [], belblokken: [], bezet: [], conflicten: [], gebruikers: [], meetingsoorten: [], titel: '', kan: {} }) })
const afspraken = computed(() => data.value.afspraken.filter((a: any) => (!filterSoort.value || a.soort.slug === filterSoort.value) && (!filterVorm.value || a.vorm === filterVorm.value)))
const conflict = computed(() => new Set<string>(data.value.conflicten))
const dagVan = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })
const tijd = (iso: string) => new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })
const BEGIN = 7; const EIND = 20; const UUR = 56
const minuut = (iso: string) => { const [h, m] = tijd(iso).split(':').map(Number); return h! * 60 + m! }
const plek = (start: string, eind: string) => {
  const s = Math.max(BEGIN * 60, minuut(start)); const e = Math.min(EIND * 60, Math.max(s + 15, minuut(eind)))
  return { top: `${((s - BEGIN * 60) / 60) * UUR}px`, height: `${Math.max(22, ((e - s) / 60) * UUR - 2)}px` }
}
const opDag = (lijst: any[], d: string) => lijst.filter((x) => dagVan(x.start) === d)
// Overlappende afspraken staan naast elkaar: per groep die elkaar raakt een baan per afspraak.
function banen(lijst: any[]) {
  const uit: { a: any; baan: number; van: number }[] = []
  let groep: typeof uit = []; let eindGroep = 0
  const sluit = () => { const n = Math.max(...groep.map((g) => g.baan)) + 1; groep.forEach((g) => (g.van = n)); groep = [] }
  for (const a of [...lijst].sort((x, y) => x.start.localeCompare(y.start))) {
    if (groep.length && Date.parse(a.start) >= eindGroep) sluit()
    const bezet = new Set(groep.filter((g) => Date.parse(g.a.eind) > Date.parse(a.start)).map((g) => g.baan))
    let baan = 0; while (bezet.has(baan)) baan++
    const r = { a, baan, van: 1 }; groep.push(r); uit.push(r); eindGroep = Math.max(eindGroep, Date.parse(a.eind))
  }
  if (groep.length) sluit()
  return uit
}
const kort = (a: any) => (minuut(a.eind) - minuut(a.start)) < 40
const dagKop = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('nl-NL', { weekday: weergave.value === 'dag' ? 'long' : 'short', day: 'numeric', month: weergave.value === 'dag' ? 'long' : undefined, timeZone: 'UTC' })
const kop = computed(() => {
  const n = afspraken.value.filter((a: any) => a.status === 'gepland').length
  const eerste = afspraken.value.filter((a: any) => a.status === 'gepland' && a.soort.type === 'klant').length
  const ander = weergave.value === 'dag' && datum.value !== vandaag
  const w = weergave.value === 'dag' ? (ander ? dagKop(datum.value) : 'Vandaag') : weergave.value === 'week' ? 'Deze week' : 'Deze maand'
  const wanneer = `${w[0]!.toUpperCase()}${w.slice(1)}${ander ? ':' : ''}`
  return n ? `${wanneer} ${n === 1 ? '1 afspraak' : `${n} afspraken`}${eerste && eerste !== n ? `, waarvan ${eerste} met klanten` : ''}.` : `${wanneer} geen afspraken.`
})
function verschuif(stap: number) {
  const d = datum.value
  zet({ datum: weergave.value === 'dag' ? plusDagen(d, stap) : weergave.value === 'week' ? plusDagen(d, 7 * stap) : `${new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1 + stap, 1)).toISOString().slice(0, 10)}` })
}
// Flyouts
const planOpen = ref(false)
const planAccount = ref<{ id: string; naam: string } | null>(null)
function plan(account: { id: string; naam: string } | null = null) { planAccount.value = account; planOpen.value = true }
const afspraakId = computed(() => (typeof route.query.afspraak === 'string' ? route.query.afspraak : null))
async function gepland(id: string) { planOpen.value = false; await refresh(); zet({ afspraak: id }) }
const filtersOpen = ref(false)
const vormLabel: Record<string, string> = { bezoek: 'Bezoek', online: 'Online', telefoon: 'Telefoon' }
useHead({ title: 'Agenda · Dealtrace' })
if (import.meta.client && route.query.melding === 'gekoppeld') toast.toon('Agenda gekoppeld.')
</script>

<template>
  <div>
    <PaginaKop kicker="Start · Agenda" :titel="kop" uitleg="Je afspraken, belblokken en wat er in je gekoppelde agenda staat." helpartikel="agenda">
      <template #acties>
        <button type="button" class="dd-actie dd-actie--primair" data-test="plan-afspraak-knop" @click="plan()"><Icoon naam="Plus" class="dd-actie-icoon" />Afspraak</button>
        <NuxtLink v-if="functie('briefing.bewerken')?.beschikbaar" to="/briefings" class="dd-actie dd-actie--secundair" data-test="briefings-knop"><Icoon naam="ScrollText" class="dd-actie-icoon" />Briefings</NuxtLink>
      </template>
    </PaginaKop>
    <section class="section">
      <div class="container">
        <div class="kop-rij ag-werkbalk">
          <div class="keuzegroep keuzegroep--klein" role="group" aria-label="Weergave">
            <button v-for="w in (['dag', 'week', 'maand'] as const)" :key="w" type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': weergave === w }" :aria-pressed="weergave === w" :data-test="`weergave-${w}`" @click="zet({ weergave: w })">{{ w[0]!.toUpperCase() + w.slice(1) }}</button>
          </div>
          <div class="ag-nav">
            <button type="button" class="dd-act dd-act--icoon" aria-label="Vorige" @click="verschuif(-1)"><Icoon naam="ArrowLeft" /></button>
            <button type="button" class="dd-act" @click="zet({ datum: undefined })">Vandaag</button>
            <button type="button" class="dd-act dd-act--icoon" aria-label="Volgende" @click="verschuif(1)"><Icoon naam="ArrowRight" /></button>
            <button type="button" class="dd-act" :aria-expanded="filtersOpen" data-test="agenda-filters" @click="filtersOpen = !filtersOpen"><Icoon naam="Filter" />Filters</button>
          </div>
        </div>
        <div v-if="filtersOpen" class="formulier-raster ag-filters">
          <label v-if="data.gebruikers.length > 1" class="veld"><span class="veld-label">Gebruiker</span><select class="invoer" :value="gebruiker" data-test="filter-gebruiker" @change="zet({ gebruiker: ($event.target as HTMLSelectElement).value || undefined })"><option value="">Mijn agenda</option><option v-for="u in data.gebruikers" :key="u.id" :value="u.id">{{ u.naam.replace(/^Testgebruiker /, '') }}</option></select></label>
          <label class="veld"><span class="veld-label">Meetingsoort</span><select v-model="filterSoort" class="invoer"><option value="">Alle</option><option v-for="m in data.meetingsoorten" :key="m.id" :value="m.slug">{{ m.naam }}</option></select></label>
          <label class="veld"><span class="veld-label">Vorm</span><select v-model="filterVorm" class="invoer"><option value="">Alle</option><option v-for="(l, k) in vormLabel" :key="k" :value="k">{{ l }}</option></select></label>
        </div>

        <!-- Maand -->
        <div v-if="weergave === 'maand'" class="ag-maand" data-test="agenda-maand">
          <span v-for="d in ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']" :key="d" class="ag-maand-kop">{{ d }}</span>
          <div v-for="d in periode.dagen" :key="d" class="ag-maand-dag" :class="{ 'ag-maand-dag--anders': d.slice(5, 7) !== datum.slice(5, 7), 'ag-maand-dag--vandaag': d === vandaag }">
            <button type="button" class="ag-maand-nr" @click="zet({ weergave: 'dag', datum: d })">{{ Number(d.slice(8)) }}</button>
            <button v-for="a in opDag(afspraken, d).slice(0, 3)" :key="a.id" type="button" class="ag-maand-item" :class="[`ag-kleur--${a.soort.kleur ?? 'grijs'}`, { 'ag-conflict': conflict.has(a.id) }]" @click="zet({ afspraak: a.id })">{{ tijd(a.start) }} {{ a.accountNaam ?? a.soort.naam }}</button>
            <span v-if="opDag(afspraken, d).length > 3" class="meta">+{{ opDag(afspraken, d).length - 3 }}</span>
          </div>
        </div>

        <!-- Dag en week -->
        <template v-else>
          <p v-if="!afspraken.length" class="meta ag-leeg" data-test="agenda-leeg">{{ filterSoort || filterVorm ? 'Geen afspraken met dit filter.' : 'Geen afspraken in deze periode.' }} <button v-if="filterSoort || filterVorm" type="button" class="tekst-link" @click="filterSoort = ''; filterVorm = ''">Toon alles</button></p>
          <div class="ag-raster" :class="`ag-raster--${weergave}`" :style="{ '--ag-kolommen': periode.dagen.length }" data-test="agenda-raster">
            <div class="ag-uren"><span class="ag-dagkop" /><div class="ag-kolom-body" :style="{ height: `${(EIND - BEGIN) * UUR}px` }"><span v-for="h in EIND - BEGIN" :key="h" class="ag-uur" :style="{ top: `${(h - 1) * UUR}px` }">{{ String(BEGIN + h - 1).padStart(2, '0') }}:00</span></div></div>
            <div v-for="d in periode.dagen" :key="d" class="ag-kolom">
              <span class="ag-dagkop" :class="{ 'ag-dagkop--vandaag': d === vandaag }">{{ dagKop(d) }}</span>
              <div class="ag-kolom-body" :style="{ height: `${(EIND - BEGIN) * UUR}px` }">
                <span v-for="(b, i) in opDag(data.bezet, d)" :key="`z${i}`" class="ag-bezet" :style="plek(b.start, b.eind)" :title="b.titel">{{ b.titel ?? 'Bezet' }}</span>
                <span v-for="b in opDag(data.belblokken, d)" :key="b.id" class="ag-belblok" :style="plek(b.start, b.eind)">Belblok</span>
                <button v-for="{ a, baan, van } in banen(opDag(afspraken, d))" :key="a.id" type="button" class="ag-afspraak" :class="[`ag-kleur--${a.soort.kleur ?? 'grijs'}`, { 'ag-conflict': conflict.has(a.id), 'ag-afspraak--klaar': a.status !== 'gepland', 'ag-afspraak--kort': kort(a) }]" :style="{ ...plek(a.start, a.eind), left: `calc(${(baan / van) * 100}% + 3px)`, width: `calc(${100 / van}% - 6px)`, right: 'auto' }" :data-test="`afspraak-${a.id}`" :title="`${tijd(a.start)} ${a.accountNaam ?? a.soort.naam} · ${a.soort.naam}`" @click="zet({ afspraak: a.id })">
                  <strong>{{ tijd(a.start) }} {{ a.accountNaam ?? a.soort.naam }}</strong>
                  <span v-if="!kort(a)">{{ a.soort.naam }} · {{ vormLabel[a.vorm] }}<template v-if="gebruiker && gebruiker.includes(',')"> · {{ a.ownerNaam }}</template></span>
                  <span v-if="a.geplandDoor && !kort(a)" class="ag-door">Gepland door {{ a.geplandDoor.replace(/^Testgebruiker /, '') }}</span>
                </button>
              </div>
            </div>
          </div>
        </template>
      </div>
    </section>
    <PlanAfspraakFlyout :open="planOpen" :account="planAccount" @sluit="planOpen = false" @gepland="gepland" />
    <AfspraakFlyout :open="!!afspraakId" :afspraak-id="afspraakId" @sluit="zet({ afspraak: undefined })" @gewijzigd="refresh()" />
  </div>
</template>
