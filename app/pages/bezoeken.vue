<script setup lang="ts">
// Bezoeken (F10): de rijdag van de buitendienst. Kop met regio en dagstatistiek, kaart en route,
// kansen langs de route met filters, de bellijst naast je bezoeken en te plannen bezoeken. Op de
// telefoon door naar Onderweg (P30).
import { duurLabel, kaartLink, OVERSLA_REDENEN, type Kaartapp } from '~~/shared/route'
const route = useRoute()
const router = useRouter()
const { functie } = useMe()
const toast = useToast()
const klasse = useSchermklasse()
onMounted(() => { if (klasse.value === 'telefoon') navigateTo('/onderweg', { replace: true }) })
const zet = (q: Record<string, string | undefined>) => router.replace({ query: { ...route.query, ...q } })
const q = computed(() => ({ ...route.query }))
const { data, refresh, status } = await useFetch<any>('/api/bezoeken', { query: q, default: () => null })
const tijd = (iso: string) => new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })
const dagLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
const vandaag = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })
const app = computed<Kaartapp>(() => data.value?.kaartapp ?? 'google')
const kicker = computed(() => ['BEZOEKEN', data.value?.dag === vandaag ? 'VANDAAG' : data.value ? dagLabel(data.value.dag).toUpperCase() : '', data.value?.regio?.naam?.toUpperCase()].filter(Boolean).join(' · '))
const titel = computed(() => { const n = data.value?.stops.length ?? 0; return n ? `${n === 1 ? '1 bezoek' : `${n} bezoeken`} op de planning.` : 'Geen bezoeken op deze dag.' })
// Flyouts
const plan = reactive({ open: false, account: null as null | { id: string; naam: string }, taskId: null as string | null, aanleiding: '', voorstel: null as any })
function tussenstop(k: any) {
  const start = k.momentStart ? tijd(k.momentStart).replace(/:(\d)\d$/, (_m: string, t: string) => `:${Number(t) >= 3 ? '30' : '00'}`) : undefined
  Object.assign(plan, { open: true, account: { id: k.id, naam: k.naam }, taskId: k.taakId ?? null, aanleiding: k.bronnen[0]?.label ?? '', voorstel: { datum: data.value.dag, start, duurMin: 30, vorm: 'bezoek', soort: 'kennismaking' } })
}
function planBezoek(t: any) { Object.assign(plan, { open: true, account: t.accountId ? { id: t.accountId, naam: t.accountNaam } : null, taskId: t.id, aanleiding: t.titel, voorstel: { vorm: 'bezoek', soort: 'inventarisatie' } }) }
async function gepland() { plan.open = false; await refresh() }
const afspraak = ref<string | null>(null)
const overslaan = ref<any>(null)
const reden = ref('')
async function slaOver() {
  try { await $fetch(`/api/kansen/${overslaan.value.id}/overslaan`, { method: 'POST', body: { reden: reden.value } }); toast.toon(`${overslaan.value.naam} komt 7 dagen niet terug.`); overslaan.value = null; reden.value = ''; await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function inloop(k: any) {
  try { const r: any = await $fetch('/api/afspraken/inloop', { method: 'POST', body: { accountId: k.id } }); toast.toon(r.tekst); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const filtersOpen = ref(false)
const opbouw = (k: any) => k.opbouw.map((o: any) => `${o.label} ${o.punten >= 0 ? '+' : ''}${o.punten}`).join(' · ')
useHead({ title: 'Bezoeken · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop :kicker="kicker" :titel="titel" uitleg="Je route met kaart, en wie je onderweg meeneemt." helpartikel="bezoeken-en-kansen-langs-de-route">
      <template #acties>
        <button type="button" class="dd-actie dd-actie--primair" data-test="plus-bezoek" @click="Object.assign(plan, { open: true, account: null, taskId: null, aanleiding: '', voorstel: { vorm: 'bezoek', datum: data?.dag } })"><Icoon naam="Plus" class="dd-actie-icoon" />Bezoek</button>
        <button v-if="data?.kan.kansenAlle" type="button" class="dd-actie dd-actie--secundair" :aria-expanded="filtersOpen" @click="filtersOpen = !filtersOpen"><Icoon naam="Filter" class="dd-actie-icoon" />Filters</button>
        <NuxtLink to="/agenda?weergave=dag" class="dd-actie dd-actie--secundair"><Icoon naam="Calendar" class="dd-actie-icoon" />Agenda</NuxtLink>
      </template>
    </PaginaKop>
    <section v-if="data" class="section">
      <div class="container">
        <p class="bz-stat" data-test="dagstat"><span>Bezoeken <strong>{{ data.stat.bezoeken }}</strong></span><span>Klantcontact <strong>{{ duurLabel(data.stat.contactMin) }}</strong></span><span>Rijtijd <strong>{{ duurLabel(data.stat.rijMin) }}</strong></span><span><strong>{{ data.stat.km }}</strong> km</span><span v-if="data.schatting" class="pil pil--leeg">schatting</span>
          <template v-if="data.team.length"> · <label>Route van <select class="invoer invoer--klein" :value="data.gebruiker.id" @change="zet({ gebruiker: ($event.target as HTMLSelectElement).value })"><option v-for="u in data.team" :key="u.id" :value="u.id">{{ u.naam.replace(/^Testgebruiker /, '') }}</option></select></label></template>
        </p>
        <nav v-if="data.kan.periode" class="bz-week mt-16" aria-label="Je week">
          <NuxtLink v-for="w in data.week" :key="w.datum" :to="{ query: { ...route.query, datum: w.datum } }" :class="{ 'bz-week--nu': w.datum === data.dag }"><strong>{{ dagLabel(w.datum).split(' ')[0] }}</strong><br>{{ w.regio ?? 'geen regiodag' }}</NuxtLink>
        </nav>
        <div class="bz-raster mt-16">
          <KaartSchets :punten="data.punten" :stops="data.stops.map((s: any) => ({ id: s.id, punt: s.punt, volgende: s.volgende, label: s.accountNaam }))" :kansen="data.kansen" />
          <div data-test="routelijst">
            <LegeStaat v-if="!data.stops.length" titel="Geen bezoeken op deze dag." tekst="Kansen in je regio staan hieronder." />
            <template v-for="(s, i) in data.stops" :key="s.id">
              <article class="bz-stop" :class="{ 'bz-stop--volgende': s.volgende }">
                <p class="taak-meta"><strong>{{ tijd(s.start) }} tot {{ tijd(s.eind) }}</strong><span v-if="s.volgende" class="pil pil--rood">VOLGENDE</span> · {{ s.titel }}</p>
                <p><strong>{{ Number(i) + 1 }}. {{ s.accountNaam }}</strong></p>
                <p class="meta">{{ s.adres || 'Geen adres bekend' }}<template v-if="s.geoBron && s.geoBron !== 'adres'"> · punt op {{ s.geoBron }}</template></p>
                <p class="dd-acties">
                  <a class="dd-act" :href="kaartLink({ adres: s.adres, punt: s.punt }, app) ?? undefined" target="_blank" rel="noopener"><Icoon naam="Navigation" />Navigeer</a>
                  <button v-if="s.soort === 'afspraak'" type="button" class="dd-act" @click="afspraak = s.id">Open</button>
                  <button v-if="s.soort === 'afspraak' && s.status === 'gepland'" type="button" class="dd-act dd-act--geel" @click="afspraak = s.id">Rond af</button>
                </p>
              </article>
              <p v-if="s.reistijdNaVolgende" class="bz-reis">{{ s.reistijdNaVolgende.minuten }} min rijden · {{ s.reistijdNaVolgende.km }} km<template v-if="s.reistijdNaVolgende.schatting"> · schatting</template></p>
            </template>
          </div>
        </div>
      </div>
    </section>
    <section v-if="data" class="section">
      <div class="container" data-test="kansen">
        <span class="kicker kicker--streep">KANSEN LANGS DE ROUTE · {{ data.kansen.length }}</span>
        <h2 class="title">Prospects en kansen vlak bij je bezoeken</h2>
        <div v-if="filtersOpen && data.kan.kansenAlle" class="bz-filters">
          <label class="veld"><span class="veld-label">Bron</span><select class="invoer" :value="route.query.bron ?? ''" @change="zet({ bron: ($event.target as HTMLSelectElement).value || undefined })"><option value="">Alle</option><option value="bezoektaak">Open bezoektaak</option><option value="klaargezet">Klaargezet</option><option value="aanleiding">Hete aanleiding</option><option value="ritme">Bezoekritme achter</option><option value="ongepland">Ongepland</option></select></label>
          <label class="veld"><span class="veld-label">Maximale omrijtijd</span><select class="invoer" :value="route.query.maxOmrij ?? '20'" @change="zet({ maxOmrij: ($event.target as HTMLSelectElement).value })"><option value="10">10 minuten</option><option value="20">20 minuten</option><option value="30">30 minuten</option></select></label>
          <label class="veld"><span class="veld-label">Aantal</span><select class="invoer" :value="route.query.aantal ?? '10'" @change="zet({ aantal: ($event.target as HTMLSelectElement).value })"><option value="4">4</option><option value="10">10</option><option value="alles">Alles</option></select></label>
          <p class="schakel-rij"><span>Alleen mijn accounts</span><Schakelaar :aan="route.query.alleenMijn !== '0'" label="Alleen mijn accounts" @wissel="zet({ alleenMijn: $event ? undefined : '0' })" /></p>
          <p class="schakel-rij"><span>Alleen prospects</span><Schakelaar :aan="route.query.alleenProspects !== '0'" label="Alleen prospects" @wissel="zet({ alleenProspects: $event ? undefined : '0' })" /></p>
          <p v-if="data.kan.eigenRegels" class="schakel-rij"><span>Toon ook ongeplande prospects in dit gebied</span><Schakelaar :aan="route.query.ongepland === '1'" label="Ongeplande prospects" @wissel="zet({ ongepland: $event ? '1' : undefined })" /></p>
        </div>
        <LegeStaat v-if="!data.kansen.length && status !== 'pending'" titel="Geen kansen binnen deze omrijtijd." tekst="Zet de maximale omrijtijd hoger of toon ook ongeplande prospects." />
        <div class="lijst mt-16">
          <article v-for="k in data.kansen" :key="k.id" class="bz-kans" :data-test="`kans-${k.id}`">
            <span class="bz-kans-nr">{{ k.rang }}</span>
            <div>
              <h3 class="rij-titel"><NuxtLink :to="`/accounts/${k.id}`">{{ k.naam }}</NuxtLink> <span v-if="k.faseId" class="pil pil--leeg">{{ k.faseId }}</span></h3>
              <p v-for="b in k.bronnen" :key="b.label" class="taak-meta">{{ b.label }}</p>
              <p class="taak-meta">{{ k.omrij }} min omrijden, {{ k.tussen }}<span v-if="k.schatting" class="pil pil--leeg">schatting</span><template v-if="k.moment"> · {{ k.moment }}</template></p>
              <p v-if="k.contact" class="meta">{{ k.contact.naam }}<template v-if="k.contact.rol"> · {{ k.contact.rol }}</template><template v-if="k.laatsteContactOp"> · laatste contact {{ new Date(k.laatsteContactOp).toLocaleDateString('nl-NL') }}</template></p>
              <p class="bz-opbouw" :title="opbouw(k)">Score {{ k.score }}: {{ opbouw(k) }}</p>
              <p class="dd-acties mt-8">
                <button type="button" class="dd-act dd-act--geel" :data-test="`tussenstop-${k.id}`" @click="tussenstop(k)"><Icoon naam="Plus" />Tussenstop</button>
                <NuxtLink v-if="data.kan.kansenAlle" class="dd-act" :to="`/accounts/${k.id}?bel=1`"><Icoon naam="Phone" />Eerst bellen</NuxtLink>
                <button v-if="data.kan.inloop" type="button" class="dd-act" @click="inloop(k)">Inloopbezoek</button>
                <button type="button" class="dd-act" :data-test="`overslaan-${k.id}`" @click="overslaan = k">Overslaan</button>
                <a class="dd-act" :href="kaartLink({ punt: k.punt }, app) ?? undefined" target="_blank" rel="noopener"><Icoon naam="Navigation" />Navigeer</a>
              </p>
            </div>
          </article>
        </div>
      </div>
    </section>
    <section v-if="data" class="section">
      <div class="container raster raster--2">
        <div data-test="bellijst-naast">
          <h2 class="kop-blok">Bellijst naast je bezoeken</h2>
          <NietAangezetKop v-if="!data.kan.bellijst" sleutel="bezoeken.bellijst" />
          <ul v-else-if="data.bellijst.length" class="schakel-lijst kaart"><li v-for="b in data.bellijst" :key="b.accountId" class="schakel-rij"><NuxtLink :to="`/accounts/${b.accountId}`">{{ b.accountNaam }}</NuxtLink><span class="meta">{{ b.reden }}</span></li></ul>
          <p v-else class="meta">Niemand om te bellen.</p>
        </div>
        <div data-test="te-plannen">
          <h2 class="kop-blok">Te plannen bezoeken</h2>
          <NietAangezetKop v-if="!data.kan.teplannen" sleutel="bezoeken.teplannen" />
          <ul v-else-if="data.teplannen.length" class="schakel-lijst kaart"><li v-for="t in data.teplannen" :key="t.id" class="schakel-rij"><span><strong>{{ t.accountNaam }}</strong> <span class="meta">{{ t.titel }} · sinds {{ new Date(t.sinds).toLocaleDateString('nl-NL') }}</span></span><button type="button" class="dd-act" :data-test="`plan-bezoek-${t.id}`" @click="planBezoek(t)"><Icoon naam="Plus" />Plan bezoek</button></li></ul>
          <p v-else class="meta">Geen open bezoektaken.</p>
          <p v-if="data.kan.analyse" class="mt-16"><NuxtLink to="/analyse/regio" class="tekst-link">Waar laat je potentie liggen? Bekijk de regio-analyse</NuxtLink></p>
        </div>
      </div>
    </section>
    <PlanAfspraakFlyout :open="plan.open" :account="plan.account" :task-id="plan.taskId" :aanleiding="plan.aanleiding" :voorstel="plan.voorstel" @sluit="plan.open = false" @gepland="gepland" />
    <AfspraakFlyout :open="!!afspraak" :afspraak-id="afspraak" @sluit="afspraak = null" @gewijzigd="refresh()" />
    <Teleport to="body">
      <div v-if="overslaan" class="fo-overlay" @click.self="overslaan = null">
        <form class="fo-panel fo-panel--smal fo-panel--schuif" role="dialog" aria-modal="true" aria-labelledby="os-titel" @submit.prevent="slaOver">
          <header class="fo-head"><div class="fo-head-tekst"><span class="fo-kicker">Overslaan</span><h2 id="os-titel" class="fo-titel">{{ overslaan.naam }}</h2></div><button type="button" class="fo-sluit" aria-label="Sluiten" @click="overslaan = null"><Icoon naam="X" /></button></header>
          <div class="fo-body fo-body--formulier"><div class="uitkomst-raster"><button v-for="r in OVERSLA_REDENEN" :key="r" type="button" class="uitkomst-knop" :class="{ 'uitkomst-knop--actief': reden === r }" @click="reden = r">{{ r }}</button></div><p class="meta mt-8">De kans komt 7 dagen niet terug.</p></div>
          <footer class="fo-foot dd-acties"><span class="dd-acties-vul fo-foot-vul" /><button type="submit" class="dd-act dd-act--primair" :disabled="!reden" data-test="overslaan-bewaar">Overslaan</button></footer>
        </form>
      </div>
    </Teleport>
  </div>
</template>
