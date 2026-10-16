<script setup lang="ts">
// Taken (F06, voorheen /acties): taken in groepen of als horizon (Gevorderd, keuze Weergave in het filterpaneel),
// statkaarten als filter, filters in de URL, contextmenu, vegen en bulk. Inzichten staan op /inzichten; /acties
// stuurt door (pages/acties.vue).
import { CONTACT_ACTIES, HERKOMST_LABEL } from '~~/shared/taken'
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { functie } = useMe()
const { rondAf, versie } = useAfronden()
const motorVersie = useState('motorVersie', () => 0)
function zet(p: Record<string, string | undefined>) { const q: Record<string, any> = { ...route.query, ...p }; for (const k of Object.keys(q)) if (!q[k]) delete q[k]; router.replace({ query: q }) }
// Eerste portie per groep; "Toon meer" haalt per groep de volgende portie op (B09).
const PORTIE = 15
const toon = ref<Record<string, number>>({})
const query = computed(() => ({ ...route.query, per: PORTIE, toon: Object.entries(toon.value).map(([g, n]) => `${g}:${n}`).join(',') || undefined }))
watch(() => ['q', 'eigenaar', 'prioriteit', 'actiesoort', 'herkomst', 'periode', 'fase'].map((k) => route.query[k] ?? '').join('|'), () => { toon.value = {} })
function toonMeer(g: { naam: string; taken: unknown[] }) { toon.value = { ...toon.value, [g.naam]: g.taken.length + PORTIE } }
const { data, refresh } = await useFetch<any>('/api/tasks', { query, default: () => ({ groepen: [], tellers: {}, kan: {}, teamleden: [], titel: '' }) })
watch([versie, motorVersie], () => { refresh() })
const weergave = computed(() => (route.query.weergave === 'horizon' && data.value.kan.horizon ? 'horizon' : 'lijst'))
const FILTERS = ['q', 'eigenaar', 'prioriteit', 'actiesoort', 'herkomst', 'weergave'] as const
const actieveFilters = computed(() => FILTERS.filter((k) => route.query[k]).length)
const filtersOpen = ref(actieveFilters.value > 0)
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
async function vink(t: any) {
  if (CONTACT_ACTIES.has(t.actionType)) { open.value = t.id; return }
  if (await rondAf(t.id, { uitkomst: 'gedaan' }, { mobiel: window.matchMedia('(max-width: 767px)').matches })) await refresh()
}
async function stelUit(t: any, periode: 'werkdag' | 'week' = 'werkdag') {
  try { await $fetch(`/api/tasks/${t.id}/uitstellen`, { method: 'POST', body: { periode } }); toast.toon(periode === 'week' ? 'Uitgesteld met een week.' : 'Uitgesteld met een werkdag.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
// Contextmenu (Gevorderd)
const menu = ref<{ x: number; y: number; taak: any } | null>(null)
function openMenu(e: MouseEvent, t: any) { if (!functie('taken.horizon')?.beschikbaar) return; e.preventDefault(); menu.value = { x: Math.min(e.clientX, window.innerWidth - 220), y: e.clientY, taak: t } }
onMounted(() => window.addEventListener('click', () => { menu.value = null }))
const annuleer = ref<any>(null)
const annuleerReden = ref('')
async function doeAnnuleren() {
  try { await $fetch(`/api/tasks/${annuleer.value.id}/annuleren`, { method: 'POST', body: { reden: annuleerReden.value } }); annuleer.value = null; annuleerReden.value = ''; toast.toon('Taak geannuleerd.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
// Bulk (Gevorderd)
const gekozen = ref<Set<string>>(new Set())
function kies(id: string) { const s = new Set(gekozen.value); s.has(id) ? s.delete(id) : s.add(id); gekozen.value = s }
const toewijzen = ref('')
async function bulk(actie: string) {
  try {
    const r = await $fetch<any>('/api/tasks/bulk', { method: 'POST', body: { ids: [...gekozen.value], actie, ownerId: toewijzen.value || undefined } })
    toast.toon(`${r.aantal} ${r.aantal === 1 ? 'taak' : 'taken'} bijgewerkt.`); gekozen.value = new Set(); await refresh()
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
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
        <NuxtLink to="/briefings" class="dd-actie dd-actie--secundair" data-test="briefings-knop"><Icoon naam="ScrollText" class="dd-actie-icoon" />Briefings</NuxtLink>
        <button type="button" class="dd-actie dd-actie--secundair" :aria-expanded="filtersOpen" data-test="filters-knop" @click="filtersOpen = !filtersOpen"><Icoon naam="Filter" class="dd-actie-icoon" />Filters<span v-if="actieveFilters" class="tk-teller" data-test="filters-teller">{{ actieveFilters }}</span></button>
      </template>
    </PaginaKop>

    <section class="section section--laatste">
      <div class="container">
        <div class="stat-grid stat-grid--4">
          <button v-for="s in STATKAARTEN" :key="s[2]" type="button" class="stat-card" :class="{ 'stat-card--actief': (route.query.periode ?? '') === s[0] }" :data-test="`stat-${s[2]}`" @click="zet({ periode: s[0] || undefined })"><span class="stat-label">{{ s[1] }}</span><span class="stat-num tnum">{{ data.tellers[s[2]] ?? 0 }}</span></button>
        </div>
        <div v-if="filtersOpen" class="filterbalk kaart mt-16" data-test="taak-filters">
          <div v-if="data.kan.horizon" class="tk-weergave">
            <span class="veld-label">Weergave</span>
            <div class="keuzegroep" role="radiogroup" aria-label="Weergave" data-test="weergave">
              <button v-for="[k, l] in ([['lijst', 'Lijst'], ['horizon', 'Horizon']] as const)" :key="k" type="button" role="radio" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': weergave === k }" :aria-checked="weergave === k" :data-test="`weergave-${k}`" @click="zet({ weergave: k === 'horizon' ? 'horizon' : undefined })">{{ l }}</button>
            </div>
          </div>
          <input class="invoer invoer--klein" :value="route.query.q ?? ''" placeholder="Zoeken" aria-label="Zoeken" @input="zet({ q: ($event.target as HTMLInputElement).value || undefined })">
          <select class="invoer invoer--klein" :value="route.query.eigenaar ?? 'mij'" aria-label="Eigenaar" @change="zet({ eigenaar: ($event.target as HTMLSelectElement).value === 'mij' ? undefined : ($event.target as HTMLSelectElement).value })">
            <option value="mij">Van mij</option><option v-if="data.kan.team" value="team">Mijn team</option><option v-for="u in data.teamleden" :key="u.id" :value="u.id">{{ u.naam.replace(/^Testgebruiker /, '') }}</option>
          </select>
          <select class="invoer invoer--klein" :value="route.query.prioriteit ?? ''" aria-label="Prioriteit" @change="zet({ prioriteit: ($event.target as HTMLSelectElement).value || undefined })"><option value="">Alle prioriteiten</option><option value="urgent">Urgent</option><option value="hoog">Hoog</option><option value="middel">Middel</option><option value="laag">Laag</option></select>
          <select class="invoer invoer--klein" :value="route.query.actiesoort ?? ''" aria-label="Actiesoort" @change="zet({ actiesoort: ($event.target as HTMLSelectElement).value || undefined })"><option value="">Alle actiesoorten</option><option value="bellen">Bellen</option><option value="mailen">Mailen</option><option value="linkedin">LinkedIn</option><option value="bezoek">Bezoek</option><option value="bericht">Bericht</option><option value="taak">Te doen</option></select>
          <select class="invoer invoer--klein" :value="route.query.herkomst ?? ''" aria-label="Herkomst" @change="zet({ herkomst: ($event.target as HTMLSelectElement).value || undefined })"><option value="">Alle herkomst</option><option v-for="(l, k) in HERKOMST_LABEL" :key="k" :value="k">{{ l }}</option></select>
        </div>
        <div v-if="data.kan.bulk && gekozen.size" class="kaart kaart--geel mt-16 reis-knoppen" data-test="bulkbalk">
          <span>{{ gekozen.size }} gekozen</span>
          <button type="button" class="dd-act" @click="bulk('uitstellen-werkdag')">Uitstellen 1 werkdag</button>
          <button type="button" class="dd-act" data-test="bulk-week" @click="bulk('uitstellen-week')">Uitstellen 1 week</button>
          <select v-if="data.teamleden.length" v-model="toewijzen" class="invoer invoer--klein" aria-label="Wijs toe aan"><option value="">Wijs toe aan…</option><option v-for="u in data.teamleden" :key="u.id" :value="u.id">{{ u.naam }}</option></select>
          <button v-if="toewijzen" type="button" class="dd-act" @click="bulk('toewijzen')">Wijs toe</button>
        </div>
        <LegeStaat v-if="!alle.length" class="mt-16" :titel="Object.keys(route.query).some((k) => k !== 'weergave') ? 'Geen taken die aan deze filters voldoen.' : 'Niets te doen.'" tekst="De motor zet nieuwe pogingen klaar zodra ze aan de beurt zijn." />
        <button v-if="!alle.length && Object.keys(route.query).length" type="button" class="dd-act mt-8" @click="router.replace({ query: {} })">Toon alles</button>
        <HorizonPaneel v-if="weergave === 'horizon' && data.horizon" class="mt-16" :horizon="data.horizon" @open="openUitHorizon" />
        <template v-else>
          <div v-for="g in data.groepen" :key="g.naam" class="taak-groep mt-16" :data-test="`groep-${g.naam}`">
            <h2 class="kicker kicker--streep">{{ g.naam }} <span class="pil pil--leeg">{{ g.totaal ?? g.taken.length }}</span></h2>
            <TaakKaart v-for="t in g.taken" :key="t.id" :taak="t" :bulk="data.kan.bulk" :gekozen="gekozen.has(t.id)" @open="open = t.id" @vink="vink(t)" @uitstel="stelUit(t)" @menu="openMenu($event, t)" @kies="kies(t.id)" />
            <button v-if="g.totaal > g.taken.length" type="button" class="dd-actie dd-actie--secundair tk-meer" :data-test="`toon-meer-${g.naam}`" @click="toonMeer(g)">Toon meer <span class="tnum">({{ g.taken.length }} van {{ g.totaal }})</span></button>
          </div>
        </template>
      </div>
    </section>

    <div v-if="menu" class="contextmenu" :style="{ left: `${menu.x}px`, top: `${menu.y}px` }" data-test="contextmenu" @click.stop>
      <button type="button" @click="vink(menu.taak); menu = null">Afronden</button>
      <button type="button" @click="stelUit(menu.taak, 'werkdag'); menu = null">Uitstellen 1 werkdag</button>
      <button type="button" @click="stelUit(menu.taak, 'week'); menu = null">Uitstellen 1 week</button>
      <button v-if="menu.taak.account" type="button" @click="navigateTo(`/accounts/${menu.taak.account.id}`)">Open kaart</button>
      <button type="button" @click="annuleer = menu.taak; menu = null">Annuleer met reden</button>
    </div>
    <div v-if="annuleer" class="fo-overlay" @click.self="annuleer = null">
      <form class="fo-panel fo-panel--smal fo-panel--schuif" role="dialog" aria-modal="true" @submit.prevent="doeAnnuleren">
        <header class="fo-head"><div class="fo-head-tekst"><span class="fo-kicker">Annuleren</span><h2 class="fo-titel">{{ annuleer.title }}</h2></div><button type="button" class="fo-sluit" aria-label="Sluiten" @click="annuleer = null"><Icoon naam="X" /></button></header>
        <div class="fo-body"><label class="veld"><span class="veld-label">Reden</span><input v-model="annuleerReden" class="invoer" required></label></div>
        <footer class="fo-foot dd-acties"><span class="dd-acties-vul fo-foot-vul" /><button type="submit" class="dd-act dd-act--primair" :disabled="!annuleerReden.trim()">Annuleer taak</button></footer>
      </form>
    </div>
    <TaakFlyout :open="!!open" :taak-id="open" :basis="alle.find((t: any) => t.id === open)" :volgende="true" :teamleden="data.teamleden" @sluit="open = null" @klaar="klaar" @gewijzigd="refresh" />
    <NieuweTaakFlyout :open="nieuw" :teamleden="data.teamleden" @sluit="nieuw = false" @gemaakt="nieuw = false; refresh()" />
    <PlanAfspraakFlyout :open="nieuweAfspraak" @sluit="nieuweAfspraak = false" @gepland="(id: string) => { nieuweAfspraak = false; navigateTo(`/agenda?weergave=dag&afspraak=${id}`) }" />
  </div>
</template>

<style scoped>
.tk-meer { margin-top: 8px; }
.tk-weergave { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tk-teller { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 5px; margin-left: 6px; border-radius: 2px; background: var(--ink); color: var(--yellow); font-size: 11px; font-weight: 700; }
</style>
