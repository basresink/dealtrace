<script setup lang="ts">
// Taken (F06, voorheen /acties): standaard de horizon (wie taken.horizon heeft, vanaf Gevorderd), anders de lijst;
// ?weergave=lijst kiest de lijst (keuze Weergave in het filterpaneel). Statkaarten als filter, de filtergroep
// Periode (Vandaag, Morgen, Deze week, Volgende week of een eigen periode Van/Tot, ook in het verleden met
// afgeronde taken), filters in de URL, contextmenu en vegen. Geen vinkje of afrondknop in de rij: afronden
// gebeurt in het taakvenster. Briefings staat in het hoofdmenu onder Taken. Inzichten staan op /inzichten;
// /acties stuurt door (pages/acties.vue).
import { PERIODE_KEUZES } from '~~/shared/takenPeriode'
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { functie } = useMe()
const { versie } = useAfronden()
const motorVersie = useState('motorVersie', () => 0)
function zet(p: Record<string, string | undefined>) { const q: Record<string, any> = { ...route.query, ...p }; for (const k of Object.keys(q)) if (!q[k]) delete q[k]; router.replace({ query: q }) }
// Eerste portie per groep; "Toon meer" haalt per groep de volgende portie op (B09).
const PORTIE = 15
const toon = ref<Record<string, number>>({})
// Horizon is de standaard voor wie hem heeft; een eigen periode (ook terugkijken) staat altijd als lijst.
const horizonAan = computed(() => !!functie('taken.horizon')?.beschikbaar)
const eigenPeriode = computed(() => !!(route.query.van || route.query.tot))
const weergave = computed(() => (horizonAan.value && route.query.weergave !== 'lijst' && !eigenPeriode.value ? 'horizon' : 'lijst'))
const query = computed(() => ({ ...route.query, weergave: weergave.value, per: PORTIE, toon: Object.entries(toon.value).map(([g, n]) => `${g}:${n}`).join(',') || undefined }))
watch(() => ['q', 'eigenaar', 'prioriteit', 'actiesoort', 'periode', 'van', 'tot', 'fase'].map((k) => route.query[k] ?? '').join('|'), () => { toon.value = {} })
function toonMeer(g: { naam: string; taken: unknown[] }) { toon.value = { ...toon.value, [g.naam]: g.taken.length + PORTIE } }
const { data, refresh } = await useFetch<any>('/api/tasks', { query, default: () => ({ groepen: [], tellers: {}, kan: {}, teamleden: [], titel: '' }) })
watch([versie, motorVersie], () => { refresh() })
// Met een filter (of een gekozen weergave) in de URL staat het paneel bij openen open.
const FILTERS = ['q', 'eigenaar', 'prioriteit', 'actiesoort', 'weergave', 'van', 'tot'] as const
const periodeKeuze = computed(() => (eigenPeriode.value ? '' : String(route.query.periode ?? '')))
const filtersOpen = ref(FILTERS.some((k) => route.query[k]) || PERIODE_KEUZES.some((p) => p.sleutel === route.query.periode))
function kiesPeriode(p: string) { zet({ periode: periodeKeuze.value === p ? undefined : p, van: undefined, tot: undefined }) }
function zetDatum(k: 'van' | 'tot', waarde: string) { zet({ [k]: waarde || undefined, periode: undefined }) }
const datumTekst = (d: string) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`))
const periodeUitleg = computed(() => {
  const p = data.value.periode
  if (!p?.eigen) return ''
  const deel = p.van && p.tot ? `van ${datumTekst(p.van)} tot en met ${datumTekst(p.tot)}` : p.van ? `vanaf ${datumTekst(p.van)}` : `tot en met ${datumTekst(p.tot)}`
  return `Taken ${deel}, ook afgerond en verlopen.`
})
const alle = computed(() => data.value.groepen.flatMap((g: any) => g.taken))

// Flyouts
const open = ref<string | null>(null)
const nieuw = ref(false)
watch(() => route.query.taak, (id) => { if (typeof id === 'string') open.value = id }, { immediate: true })
function volgendeNa(id: string) {
  const lijst = alle.value
  const i = lijst.findIndex((t: any) => t.id === id)
  return lijst[i + 1]?.id ?? null
}
async function klaar(volgende: boolean, vorige: string) {
  const v = volgende ? volgendeNa(vorige) : null
  await refresh()
  if (v) open.value = v
}
async function stelUit(t: any, periode: 'werkdag' | 'week' = 'werkdag') {
  try { await $fetch(`/api/tasks/${t.id}/uitstellen`, { method: 'POST', body: { periode } }); toast.toon(periode === 'week' ? 'Uitgesteld met een week.' : 'Uitgesteld met een werkdag.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
// Contextmenu (Gevorderd)
const menu = ref<{ x: number; y: number; taak: any } | null>(null)
function openMenu(e: MouseEvent, t: any) { if (!horizonAan.value || t.status === 'klaar') return; e.preventDefault(); menu.value = { x: Math.min(e.clientX, window.innerWidth - 220), y: e.clientY, taak: t } }
onMounted(() => window.addEventListener('click', () => { menu.value = null }))
const annuleer = ref<any>(null)
const annuleerReden = ref('')
async function doeAnnuleren() {
  try { await $fetch(`/api/tasks/${annuleer.value.id}/annuleren`, { method: 'POST', body: { reden: annuleerReden.value } }); annuleer.value = null; annuleerReden.value = ''; toast.toon('Taak geannuleerd.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const STATKAARTEN = [['vandaag', 'Vandaag', 'vandaag'], ['week', 'Komende 7 dagen', 'komende7'], ['achterstallig', 'Achterstallig', 'achterstallig'], ['', 'Alles open', 'open']] as const
useHead({ title: 'Taken · Dealtrace' })
// Horizon (DealDrive-opzet): een taak opent het taakvenster, een afspraak de agenda met het afspraakvenster.
function openUitHorizon(id: string) { if (id.startsWith('afspraak:')) navigateTo(`/agenda?weergave=dag&afspraak=${id.slice(9)}`); else open.value = id }
const nieuweAfspraak = ref(false)
</script>

<template>
  <div>
    <PaginaKop kicker="Taken" helpartikel="een-taak-afronden-met-een-uitkomst">
      <template #titel><h1 class="title title--groot" data-test="acties-titel">{{ data.titel }}</h1></template>
      <template #uitleg>
        <p v-if="data.tellers.achterstallig" class="subtitle subtitle--groot tekst-rood" data-test="taken-over-tijd">{{ data.tellers.achterstallig }} {{ data.tellers.achterstallig === 1 ? 'taak staat' : 'taken staan' }} over tijd.</p>
        <p v-else class="subtitle subtitle--groot">Je open taken op volgorde van vervaldatum.</p>
      </template>
      <template #acties>
        <button type="button" class="dd-actie dd-actie--primair" data-test="taak-nieuw" @click="nieuw = true"><Icoon naam="Plus" class="dd-actie-icoon" />Taak</button>
        <button type="button" class="dd-actie dd-actie--zwart" data-test="afspraak-nieuw" @click="nieuweAfspraak = true"><Icoon naam="Plus" class="dd-actie-icoon" />Afspraak</button>
        <button type="button" class="dd-actie dd-actie--secundair" :aria-expanded="filtersOpen" data-test="filters-knop" @click="filtersOpen = !filtersOpen"><Icoon naam="Filter" class="dd-actie-icoon" />Filters</button>
      </template>
    </PaginaKop>

    <section class="section section--laatste">
      <div class="container">
        <div class="stat-grid stat-grid--4">
          <button v-for="s in STATKAARTEN" :key="s[2]" type="button" class="stat-card" :class="{ 'stat-card--actief': periodeKeuze === s[0] && !eigenPeriode }" :data-test="`stat-${s[2]}`" @click="zet({ periode: s[0] || undefined, van: undefined, tot: undefined })"><span class="stat-label">{{ s[1] }}</span><span class="stat-num tnum">{{ data.tellers[s[2]] ?? 0 }}</span></button>
        </div>
        <div v-if="filtersOpen" class="filterbalk kaart mt-16 tk-filters" data-test="taak-filters">
          <div v-if="horizonAan" class="tk-weergave">
            <span class="veld-label">Weergave</span>
            <div class="keuzegroep" role="radiogroup" aria-label="Weergave" data-test="weergave">
              <button v-for="[k, l] in ([['horizon', 'Horizon'], ['lijst', 'Lijst']] as const)" :key="k" type="button" role="radio" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': weergave === k }" :aria-checked="weergave === k" :disabled="k === 'horizon' && eigenPeriode" :title="k === 'horizon' && eigenPeriode ? 'Een eigen periode staat als lijst' : undefined" :data-test="`weergave-${k}`" @click="zet({ weergave: k === 'lijst' ? 'lijst' : undefined })">{{ l }}</button>
            </div>
          </div>
          <div class="tk-periode" role="group" aria-label="Periode" data-test="filter-periode">
            <span class="veld-label">Periode</span>
            <button v-for="p in PERIODE_KEUZES" :key="p.sleutel" type="button" class="filter-pil" :class="{ 'filter-pil--aan': periodeKeuze === p.sleutel }" :aria-pressed="periodeKeuze === p.sleutel" :data-test="`periode-${p.sleutel}`" @click="kiesPeriode(p.sleutel)">{{ p.label }}</button>
            <label class="tk-datum"><span class="tk-datum-label">Van</span><input class="invoer invoer--klein" type="date" :value="route.query.van ?? ''" data-test="periode-van" @change="zetDatum('van', ($event.target as HTMLInputElement).value)"></label>
            <label class="tk-datum"><span class="tk-datum-label">Tot</span><input class="invoer invoer--klein" type="date" :value="route.query.tot ?? ''" data-test="periode-tot" @change="zetDatum('tot', ($event.target as HTMLInputElement).value)"></label>
          </div>
          <input class="invoer invoer--klein" :value="route.query.q ?? ''" placeholder="Zoeken" aria-label="Zoeken" @input="zet({ q: ($event.target as HTMLInputElement).value || undefined })">
          <select class="invoer invoer--klein" :value="route.query.eigenaar ?? 'mij'" aria-label="Eigenaar" @change="zet({ eigenaar: ($event.target as HTMLSelectElement).value === 'mij' ? undefined : ($event.target as HTMLSelectElement).value })">
            <option value="mij">Van mij</option><option v-if="data.kan.team" value="team">Mijn team</option><option v-for="u in data.teamleden" :key="u.id" :value="u.id">{{ u.naam.replace(/^Testgebruiker /, '') }}</option>
          </select>
          <select class="invoer invoer--klein" :value="route.query.prioriteit ?? ''" aria-label="Prioriteit" @change="zet({ prioriteit: ($event.target as HTMLSelectElement).value || undefined })"><option value="">Alle prioriteiten</option><option value="urgent">Urgent</option><option value="hoog">Hoog</option><option value="middel">Middel</option><option value="laag">Laag</option></select>
          <select class="invoer invoer--klein" :value="route.query.actiesoort ?? ''" aria-label="Actiesoort" @change="zet({ actiesoort: ($event.target as HTMLSelectElement).value || undefined })"><option value="">Alle actiesoorten</option><option value="bellen">Bellen</option><option value="mailen">Mailen</option><option value="linkedin">LinkedIn</option><option value="bericht">WhatsApp</option><option value="sms">SMS</option><option value="bezoek">Bezoek</option><option value="taak">Te doen</option></select>
        </div>
        <p v-if="periodeUitleg" class="tk-periode-uitleg mt-16" data-test="periode-uitleg">{{ periodeUitleg }}</p>
        <LegeStaat v-if="!alle.length && weergave === 'lijst'" class="mt-16" :titel="Object.keys(route.query).some((k) => k !== 'weergave') ? 'Geen taken die aan deze filters voldoen.' : 'Niets te doen.'" tekst="De motor zet nieuwe pogingen klaar zodra ze aan de beurt zijn." />
        <button v-if="!alle.length && Object.keys(route.query).length" type="button" class="dd-act mt-8" @click="router.replace({ query: {} })">Toon alles</button>
        <HorizonPaneel v-if="weergave === 'horizon' && data.horizon" class="mt-16" :horizon="data.horizon" @open="openUitHorizon" />
        <template v-else>
          <div v-for="g in data.groepen" :key="g.naam" class="taak-groep mt-16" :data-test="`groep-${g.naam}`">
            <h2 class="kicker kicker--streep">{{ g.naam }} <span class="pil pil--leeg">{{ g.totaal ?? g.taken.length }}</span></h2>
            <TaakKaart v-for="t in g.taken" :key="t.id" :taak="t" @open="open = t.id" @uitstel="stelUit(t)" @menu="openMenu($event, t)" />
            <button v-if="g.totaal > g.taken.length" type="button" class="dd-actie dd-actie--secundair tk-meer" :data-test="`toon-meer-${g.naam}`" @click="toonMeer(g)">Toon meer <span class="tnum">({{ g.taken.length }} van {{ g.totaal }})</span></button>
          </div>
        </template>
      </div>
    </section>

    <div v-if="menu" class="contextmenu" :style="{ left: `${menu.x}px`, top: `${menu.y}px` }" data-test="contextmenu" @click.stop>
      <button type="button" @click="open = menu.taak.id; menu = null">Afronden in het taakvenster</button>
      <button type="button" @click="stelUit(menu.taak, 'werkdag'); menu = null">Uitstellen 1 werkdag</button>
      <button type="button" @click="stelUit(menu.taak, 'week'); menu = null">Uitstellen 1 week</button>
      <button v-if="menu.taak.account" type="button" @click="navigateTo(`/accounts/${menu.taak.account.id}`)">Open kaart</button>
      <button type="button" @click="annuleer = menu.taak; menu = null">Annuleer met reden</button>
    </div>
    <FlyoutShell v-if="annuleer" open titel-id="fs-taken0" breedte="smal" @sluit="annuleer = null">
      <template #kop><span class="fo-kicker">Annuleren</span><h2 id="fs-taken0" class="fo-titel">{{ annuleer.title }}</h2></template>
        <form id="ta-form" class="fs-form" @submit.prevent="doeAnnuleren">
        <div class="fo-body"><label class="veld"><span class="veld-label">Reden</span><input v-model="annuleerReden" class="invoer" required></label></div>
        </form>
      <template #voet>
        <footer class="fo-foot fs-voet">
          <button type="submit" form="ta-form" class="dd-actie dd-actie--zwart fs-hoofdactie" :disabled="!annuleerReden.trim()"><Icoon naam="Check" :grootte="16" />Annuleer taak</button>
          <span class="fo-foot-vul" />
        </footer>
      </template>
    </FlyoutShell>
    <TaakFlyout :open="!!open" :taak-id="open" :basis="alle.find((t: any) => t.id === open)" :lijst="alle.map((t: any) => t.id)" :volgende="true" :teamleden="data.teamleden" @sluit="open = null" @klaar="klaar" @gewijzigd="refresh" />
    <NieuweTaakFlyout :open="nieuw" :teamleden="data.teamleden" @sluit="nieuw = false" @gemaakt="nieuw = false; refresh()" />
    <PlanAfspraakFlyout :open="nieuweAfspraak" @sluit="nieuweAfspraak = false" @gepland="(id: string) => { nieuweAfspraak = false; navigateTo(`/agenda?weergave=dag&afspraak=${id}`) }" />
  </div>
</template>

<style scoped>
.tk-meer { margin-top: 8px; }
.tk-weergave { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tk-periode { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; flex-basis: 100%; }
.tk-datum { display: inline-flex; align-items: center; gap: 6px; }
.tk-datum-label { font-size: 12px; font-weight: 600; color: var(--muted); }
.tk-datum .invoer { width: auto; }
.tk-periode-uitleg { margin-bottom: 0; font-size: 13px; color: var(--muted); }
.keuzegroep-knop:disabled { color: var(--muted); cursor: not-allowed; }
</style>
