<script setup lang="ts">
// Route op de telefoon (P30, 8.5.2): kop met de dag, de volgende stop groot met vertrektijd en
// Navigeer, Bel en Pitstop, de tijdlijn met kansen als gele tussenrij, "In de buurt", de bellijst en
// "+ Inloop". Alles uit het dagpakket, dus ook offline. Op de laptop door naar Bezoeken.
import { duurLabel, kaartLink, OVERSLA_REDENEN, routeVanDag, vertrekMoment, type Kaartapp } from '~~/shared/route'
const klasse = useSchermklasse()
onMounted(() => { if (klasse.value !== 'telefoon') navigateTo('/bezoeken', { replace: true }) })
const { functie, me } = useMe()
const toast = useToast()
const { voegToe } = useSyncQueue()
const { pakket, laad, bezig } = useDagpakket()
onMounted(() => { void laad() })
const dag = computed(() => pakket.value?.dagen?.[0] ?? null)
const app = computed<Kaartapp>(() => ((me.value?.gebruiker as any)?.route?.kaartapp ?? 'google') as Kaartapp)
const nu = ref(new Date())
let klok: any
onMounted(() => { klok = setInterval(() => (nu.value = new Date()), 30_000) })
onBeforeUnmount(() => clearInterval(klok))
const lokaalAfgerond = ref(new Set<string>())
const verborgen = ref(new Set<string>())
const stops = computed(() => (dag.value?.stops ?? []).map((s: any) => (lokaalAfgerond.value.has(s.id) ? { ...s, status: 'afgerond' } : s)))
const reistijden = computed(() => stops.value.map((_s: any, i: number) => (i === 0 ? null : stops.value[i - 1]?.reistijdNaVolgende?.minuten ?? null)))
const kansen = computed(() => (dag.value?.kansen ?? []).filter((k: any) => !verborgen.value.has(k.id)).slice(0, functie('bezoeken.kansenAlle')?.beschikbaar ? 10 : 3))
const tijdlijn = computed(() => routeVanDag(stops.value, kansen.value, reistijden.value, nu.value))
const volgende = computed(() => tijdlijn.value.find((r: any) => r.soort === 'stop' && ['gepland', 'onderweg', 'bezig'].includes(r.status)) as any)
const vertrek = computed(() => (volgende.value?.reistijdNaar != null ? vertrekMoment(volgende.value.stop, volgende.value.reistijdNaar, nu.value) : null))
const tijd = (iso: string) => new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })
const kop = computed(() => (dag.value ? `Route · ${dag.value.stops.length === 1 ? '1 bezoek' : `${dag.value.stops.length} bezoeken`} · ${dag.value.stat.km} km · ${duurLabel(dag.value.stat.rijMin)} rijden` : 'Route'))
const kaartAan = ref(false)
const STATUS: Record<string, string> = { gepland: 'gepland', onderweg: 'onderweg', bezig: 'bezig', afgerond: 'afgerond', 'zonder-verslag': 'zonder verslag' }
const telLink = (n?: string | null) => (n ? `tel:${n.replace(/[^\d+]/g, '')}` : undefined)

// Bezoek afronden: uitkomsten van de meetingsoort uit het dagpakket.
const afronden = ref<any>(null)
const taakOpen = ref<string | null>(null)
function rondAf(s: any) {
  if (s.soort === 'taak') { taakOpen.value = s.id; return }
  const ms = (pakket.value?.meetingsoorten ?? []).find((m: any) => m.slug === s.soortSlug) ?? (pakket.value?.meetingsoorten ?? []).find((m: any) => m.slug === 'kennismaking')
  afronden.value = { id: s.id, accountId: s.accountId, accountNaam: s.accountNaam, start: s.start, eind: s.eind, eerste: !!ms?.data?.eersteAfspraak && s.faseId === 'afspraak-gepland', uitkomsten: ms?.data?.uitkomsten ?? [] }
}
function bewaard(id: string) { lokaalAfgerond.value = new Set([...lokaalAfgerond.value, id]) }

// Kansen: tussenstop (online via de flyout, offline in de wachtrij) en overslaan.
const plan = reactive({ open: false, account: null as any, taskId: null as string | null, voorstel: null as any })
async function tussenstop(k: any) {
  const start = k.momentStart ? tijd(k.momentStart).replace(/:(\d)\d$/, (_m: string, t: string) => `:${Number(t) >= 3 ? '30' : '00'}`) : '12:00'
  if (navigator.onLine) { Object.assign(plan, { open: true, account: { id: k.id, naam: k.naam }, taskId: k.taakId ?? null, voorstel: { datum: dag.value.dag, start, duurMin: 30, vorm: 'bezoek', soort: 'kennismaking' } }); return }
  const ms = (pakket.value?.meetingsoorten ?? []).find((m: any) => m.slug === 'kennismaking')
  const id = crypto.randomUUID()
  const iso = k.momentStart ?? new Date().toISOString()
  await voegToe({ tabel: 'appointments', op: 'patch', recordId: id, patch: { soort: 'afspraak.nieuw', accountId: k.id, meetingsoortId: ms?.id, vorm: 'bezoek', start: iso, duurMin: 30, taskId: k.taakId ?? null } })
  // Lokaal invoegen met de geschatte reistijd; de route wordt herberekend zodra er verbinding is.
  dag.value.stops = [...dag.value.stops, { id, soort: 'afspraak', titel: 'Kennismaking', accountId: k.id, accountNaam: k.naam, adres: '', start: iso, eind: new Date(Date.parse(iso) + 30 * 60_000).toISOString(), status: 'gepland', punt: k.punt, soortSlug: 'kennismaking', reistijdNaVolgende: null }].sort((a: any, b: any) => a.start.localeCompare(b.start))
  verborgen.value = new Set([...verborgen.value, k.id])
  toast.toon(`Tussenstop bij ${k.naam} bewaard op je telefoon.`)
}
async function geplandOnline() { plan.open = false; await laad({ forceer: true }) }
const overslaan = ref<any>(null)
async function slaOver(reden: string) {
  const k = overslaan.value
  await voegToe({ tabel: 'kans_overslaan', op: 'patch', recordId: k.id, patch: { soort: 'kans.overslaan', reden } })
  verborgen.value = new Set([...verborgen.value, k.id]); overslaan.value = null
  toast.toon(`${k.naam} komt 7 dagen niet terug.`)
}

// In de buurt en inloop.
const buurtOpen = ref(false)
const inloopOpen = ref(false)
async function startInloop(a: { id: string; naam: string }) {
  buurtOpen.value = false; inloopOpen.value = false
  const id = crypto.randomUUID()
  const start = new Date()
  await voegToe({ tabel: 'appointments', op: 'patch', recordId: id, patch: { soort: 'inloop.vastleggen', accountId: a.id, tijd: start.toISOString() } })
  const ms = (pakket.value?.meetingsoorten ?? []).find((m: any) => m.slug === 'ongepland-bezoek')
  afronden.value = { id, accountId: a.id, accountNaam: a.naam, start: start.toISOString(), eind: new Date(start.getTime() + 30 * 60_000).toISOString(), eerste: false, uitkomsten: ms?.data?.uitkomsten ?? [] }
}
useHead({ title: 'Route · Dealtrace' })
</script>

<template>
  <div class="ow" data-test="onderweg">
    <header class="ow-kop">
      <h1 data-test="ow-kop">{{ kop }}</h1>
      <button type="button" class="dd-act" :aria-pressed="kaartAan" @click="kaartAan = !kaartAan"><Icoon :naam="kaartAan ? 'List' : 'MapPin'" />{{ kaartAan ? 'Lijst' : 'Kaart' }}</button>
    </header>
    <p v-if="!pakket && bezig" class="meta" style="padding: 0 16px">Je dag laden…</p>
    <template v-if="dag">
      <KaartSchets v-if="kaartAan" :punten="dag.punten" :stops="stops.map((s: any) => ({ id: s.id, punt: s.punt, volgende: s.id === volgende?.stop.id, label: s.accountNaam }))" :kansen="kansen" style="margin: 0 16px" />
      <section v-else-if="volgende" class="ow-volgende" data-test="ow-volgende">
        <p class="ow-status">Volgende · {{ tijd(volgende.stop.start) }}</p>
        <h2>{{ volgende.stop.accountNaam }}</h2>
        <p class="meta">{{ volgende.stop.adres || volgende.stop.plaats }}</p>
        <p v-if="vertrek" :class="{ 'ow-vertrek--rood': vertrek.rood }" data-test="ow-vertrek">Vertrek om {{ tijd(vertrek.vertrek) }} · {{ volgende.reistijdNaar }} min rijden</p>
        <div class="ow-knoppen">
          <a class="dd-act dd-act--primair" :href="kaartLink({ adres: volgende.stop.adres, punt: volgende.stop.punt }, app) ?? undefined" target="_blank" rel="noopener" data-test="ow-navigeer"><Icoon naam="Navigation" />Navigeer</a>
          <a class="dd-act" :class="{ 'knop-uit': !volgende.stop.telefoon }" :href="telLink(volgende.stop.telefoon)" :aria-disabled="!volgende.stop.telefoon" :title="volgende.stop.telefoon ? undefined : 'Geen telefoonnummer bekend'"><Icoon naam="Phone" />Bel</a>
          <NuxtLink class="dd-act" :to="volgende.stop.soort === 'afspraak' ? `/agenda?afspraak=${volgende.stop.id}` : `/accounts/${volgende.stop.accountId}`">Pitstop</NuxtLink>
        </div>
      </section>
      <LegeStaat v-if="!dag.stops.length" titel="Geen bezoeken vandaag." :tekst="functie('onderweg.inDeBuurt')?.beschikbaar ? 'Kansen in je regio vind je onder In de buurt.' : ''" />
      <ol class="ow-tijdlijn" data-test="ow-tijdlijn">
        <template v-for="r in tijdlijn" :key="r.soort === 'stop' ? (r as any).stop.id : `k-${(r as any).kans.id}`">
          <li v-if="r.soort === 'stop'" class="ow-stop" :class="{ 'ow-stop--afgerond': r.status === 'afgerond' }" :data-test="`ow-stop-${(r as any).stop.id}`">
            <p v-if="(r as any).reistijdNaar != null && r.status !== 'afgerond'" class="ow-reis">{{ (r as any).reistijdNaar }} min rijden</p>
            <p class="ow-stop-rij"><span><span v-if="r.status === 'afgerond'" class="ow-vink"><Icoon naam="CircleCheck" :grootte="16" /></span> <strong>{{ tijd((r as any).stop.start) }} {{ (r as any).stop.accountNaam }}</strong></span><span class="ow-status" :class="`ow-status--${r.status}`">{{ STATUS[r.status] }}</span></p>
            <template v-if="r.status !== 'afgerond'">
              <p class="meta">{{ (r as any).stop.plaats }} · {{ (r as any).stop.titel }}</p>
              <p class="ow-stop-acties">
                <a class="dd-act" :href="kaartLink({ adres: (r as any).stop.adres, punt: (r as any).stop.punt }, app) ?? undefined" target="_blank" rel="noopener" aria-label="Navigeer"><Icoon naam="Navigation" /></a>
                <a class="dd-act" :href="telLink((r as any).stop.telefoon)" :aria-disabled="!(r as any).stop.telefoon" aria-label="Bel"><Icoon naam="Phone" /></a>
                <button v-if="r.status === 'zonder-verslag'" type="button" class="dd-act ow-rood" data-test="ow-verslag" @click="rondAf((r as any).stop)">Verslag vastleggen</button>
                <button v-else type="button" class="dd-act dd-act--geel" :data-test="`ow-rond-af-${(r as any).stop.id}`" @click="rondAf((r as any).stop)">Bezoek afronden</button>
              </p>
            </template>
          </li>
          <li v-else class="ow-kans" :data-test="`ow-kans-${(r as any).kans.id}`">
            <p><strong>{{ (r as any).kans.naam }}</strong></p>
            <p class="meta">{{ (r as any).kans.bronnen[0]?.label }}</p>
            <p class="meta">{{ (r as any).kans.omrij }} min omrijden<template v-if="(r as any).kans.moment"> · past {{ (r as any).kans.moment.replace(/^\d+ min vrij /, '') }}</template><template v-if="(r as any).kans.schatting"> · schatting</template></p>
            <p class="ow-stop-acties"><button type="button" class="dd-act dd-act--geel" @click="tussenstop((r as any).kans)"><Icoon naam="Plus" />Tussenstop</button><button type="button" class="dd-act" @click="overslaan = (r as any).kans">Overslaan</button></p>
          </li>
        </template>
      </ol>
      <div class="ow-onder">
        <button v-if="functie('onderweg.inloop')?.beschikbaar" type="button" class="dd-act dd-act--geel ow-knop-groot" data-test="ow-inloop" @click="inloopOpen = true"><Icoon naam="Plus" />Inloop</button>
        <button v-if="functie('onderweg.inDeBuurt')?.beschikbaar" type="button" class="dd-act ow-knop-groot" data-test="ow-in-de-buurt" @click="buurtOpen = true"><Icoon naam="LocateFixed" />In de buurt</button>
        <div v-if="functie('bezoeken.bellijst')?.beschikbaar && dag.bellijst.length">
          <h2 class="kop-blok">Bellijst naast je route</h2>
          <ul class="schakel-lijst kaart"><li v-for="b in dag.bellijst.slice(0, 5)" :key="b.accountId" class="schakel-rij"><span><strong>{{ b.accountNaam }}</strong><br><span class="meta">{{ b.reden }}</span></span><a class="dd-act" :href="telLink(b.telefoon)" :aria-disabled="!b.telefoon" aria-label="Bel"><Icoon naam="Phone" /></a></li></ul>
        </div>
      </div>
    </template>
    <BezoekAfrondenVenster :open="!!afronden" :afspraak="afronden" @sluit="afronden = null" @bewaard="bewaard" />
    <TaakFlyout :open="!!taakOpen" :taak-id="taakOpen" @sluit="taakOpen = null" @klaar="laad({ forceer: true })" />
    <PlanAfspraakFlyout :open="plan.open" :account="plan.account" :task-id="plan.taskId" :voorstel="plan.voorstel" @sluit="plan.open = false" @gepland="geplandOnline" />
    <InDeBuurtVenster :open="buurtOpen" :kaartapp="app" @sluit="buurtOpen = false" @inloop="startInloop" />
    <InloopKiezer :open="inloopOpen" @sluit="inloopOpen = false" @gekozen="startInloop" />
    <Teleport to="body">
      <div v-if="overslaan" class="fo-overlay" @click.self="overslaan = null">
        <aside class="fo-panel fo-panel--smal fo-panel--schuif" role="dialog" aria-modal="true" aria-label="Overslaan">
          <header class="fo-head"><div class="fo-head-tekst"><span class="fo-kicker">Overslaan</span><h2 class="fo-titel">{{ overslaan.naam }}</h2></div><button type="button" class="fo-sluit" aria-label="Sluiten" @click="overslaan = null"><Icoon naam="X" /></button></header>
          <div class="fo-body"><div class="uitkomst-raster"><button v-for="r in OVERSLA_REDENEN" :key="r" type="button" class="uitkomst-knop" @click="slaOver(r)">{{ r }}</button></div></div>
        </aside>
      </div>
    </Teleport>
  </div>
</template>
