<script setup lang="ts">
// Acties (F06): tabbladen Taken en Inzichten. Taken in groepen of als horizon
// (Gevorderd), statkaarten als filter, filters in de URL, contextmenu, vegen en bulk.
import { CONTACT_ACTIES, HERKOMST_LABEL } from '~~/shared/taken'
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { functie } = useMe()
const waaromNiet = ref<any[] | null>(null)
async function laadWaaromNiet() { if (!waaromNiet.value) waaromNiet.value = await $fetch<any[]>('/api/agents/tegengehouden').catch(() => []) }
const { rondAf, versie } = useAfronden()
const motorVersie = useState('motorVersie', () => 0)
const tab = computed(() => (route.query.tab === 'inzichten' ? 'inzichten' : 'taken'))
function zet(p: Record<string, string | undefined>) { const q: Record<string, any> = { ...route.query, ...p }; for (const k of Object.keys(q)) if (!q[k]) delete q[k]; router.replace({ query: q }) }
const query = computed(() => ({ ...route.query }))
const { data, refresh } = await useFetch<any>('/api/tasks', { query, default: () => ({ groepen: [], tellers: {}, kan: {}, teamleden: [], titel: '' }) })
const { data: inz, refresh: refreshInz } = await useFetch<any>('/api/signals', { query: computed(() => ({ gelezen: route.query.gelezen, soort: route.query.soort, bron: route.query.bron, agent: route.query.agent })), default: () => ({ inzichten: [], tellers: {} }) })
watch([versie, motorVersie], () => { refresh(); refreshInz() })
const weergave = computed(() => (route.query.weergave === 'horizon' && data.value.kan.horizon ? 'horizon' : 'lijst'))
const filtersOpen = ref(false)
const alle = computed(() => data.value.groepen.flatMap((g: any) => g.taken))

// Flyouts
const open = ref<string | null>(null)
const nieuw = ref(false)
const inzicht = ref<any>(null)
const metBron = ref(false)
const AGENT_NAAM: Record<string, string> = { waarnemer: 'Waarnemer', verrijker: 'Verrijker', profielbouwer: 'Profielbouwer', notulist: 'Notulist', handmatig: 'Handmatig' }
const tegengehouden = ref<any[] | null>(null)
async function toonTegengehouden(aan: boolean) { tegengehouden.value = aan ? await $fetch<any[]>('/api/signals/tegengehouden').catch(() => []) : null }
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
useHead({ title: 'Acties · Dealtrace' })
// Horizon (DealDrive-opzet): een taak opent het taakvenster, een afspraak de agenda met het afspraakvenster.
function openUitHorizon(id: string) { if (id.startsWith('afspraak:')) navigateTo(`/agenda?weergave=dag&afspraak=${id.slice(9)}`); else open.value = id }
const nieuweAfspraak = ref(false)
</script>

<template>
  <div>
    <section class="section">
      <div class="container">
        <div class="sec-head">
          <div>
            <span class="kicker kicker--streep">Acties</span>
            <h1 class="title title--groot" data-test="acties-titel">{{ tab === 'taken' ? data.titel : 'Wat speelt er bij je prospects?' }}</h1>
            <p v-if="tab === 'taken' && data.tellers.achterstallig" class="subtitle tekst-rood">{{ data.tellers.achterstallig }} {{ data.tellers.achterstallig === 1 ? 'taak staat' : 'taken staan' }} over tijd.</p>
          </div>
          <div class="toolbar-buttons">
            <button type="button" class="dd-actie dd-actie--primair" data-test="taak-nieuw" @click="nieuw = true"><Icoon naam="Plus" class="dd-actie-icoon" />Taak</button>
            <button type="button" class="dd-actie dd-actie--secundair" data-test="afspraak-nieuw" @click="nieuweAfspraak = true"><Icoon naam="Calendar" class="dd-actie-icoon" />Afspraak</button>
            <button v-if="tab === 'taken' && data.kan.horizon" type="button" class="dd-actie dd-actie--secundair" data-test="weergave" @click="zet({ weergave: weergave === 'horizon' ? undefined : 'horizon' })"><Icoon :naam="weergave === 'horizon' ? 'List' : 'LayoutGrid'" class="dd-actie-icoon" />{{ weergave === 'horizon' ? 'Lijst' : 'Horizon' }}</button>
            <HulpKnop :artikel="tab === 'inzichten' ? 'inzichten' : 'een-taak-afronden-met-een-uitkomst'" />
            <button v-if="tab === 'taken'" type="button" class="dd-actie dd-actie--secundair" data-test="filters-knop" @click="filtersOpen = !filtersOpen"><Icoon naam="Filter" class="dd-actie-icoon" />Filters</button>
          </div>
        </div>
        <nav class="tabbalk mt-16" aria-label="Tabbladen">
          <button type="button" class="tab" :class="{ 'tab--actief': tab === 'taken' }" @click="zet({ tab: undefined })">Taken</button>
          <button type="button" class="tab" :class="{ 'tab--actief': tab === 'inzichten' }" data-test="tab-inzichten" @click="zet({ tab: 'inzichten' })">Inzichten <span class="pil pil--leeg">{{ inz.tellers.open ?? 0 }}</span></button>
        </nav>
      </div>
    </section>

    <section v-if="tab === 'taken'" class="section section--laatste">
      <div class="container">
        <div class="stat-grid stat-grid--4">
          <button v-for="s in STATKAARTEN" :key="s[2]" type="button" class="stat-card" :class="{ 'stat-card--actief': (route.query.periode ?? '') === s[0] }" :data-test="`stat-${s[2]}`" @click="zet({ periode: s[0] || undefined })"><span class="stat-label">{{ s[1] }}</span><span class="stat-num tnum">{{ data.tellers[s[2]] ?? 0 }}</span></button>
        </div>
        <div v-if="filtersOpen" class="filterbalk kaart mt-16" data-test="taak-filters">
          <input class="invoer invoer--klein" :value="route.query.q ?? ''" placeholder="Zoeken" aria-label="Zoeken" @input="zet({ q: ($event.target as HTMLInputElement).value || undefined })">
          <select class="invoer invoer--klein" :value="route.query.eigenaar ?? 'mij'" aria-label="Eigenaar" @change="zet({ eigenaar: ($event.target as HTMLSelectElement).value === 'mij' ? undefined : ($event.target as HTMLSelectElement).value })">
            <option value="mij">Van mij</option><option v-if="data.kan.team" value="team">Mijn team</option><option v-for="u in data.teamleden" :key="u.id" :value="u.id">{{ u.naam.replace(/^Testgebruiker /, '') }}</option>
          </select>
          <select class="invoer invoer--klein" :value="route.query.prioriteit ?? ''" aria-label="Prioriteit" @change="zet({ prioriteit: ($event.target as HTMLSelectElement).value || undefined })"><option value="">Alle prioriteiten</option><option value="hoog">Hoog</option><option value="middel">Middel</option><option value="laag">Laag</option></select>
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
        <LegeStaat v-if="!alle.length" class="mt-16" :titel="Object.keys(route.query).some((k) => !['tab', 'weergave'].includes(k)) ? 'Geen taken die aan deze filters voldoen.' : 'Niets te doen.'" tekst="De motor zet nieuwe pogingen klaar zodra ze aan de beurt zijn." />
        <button v-if="!alle.length && Object.keys(route.query).length" type="button" class="dd-act mt-8" @click="router.replace({ query: {} })">Toon alles</button>
        <HorizonPaneel v-if="weergave === 'horizon' && data.horizon" class="mt-16" :horizon="data.horizon" @open="openUitHorizon" />
        <template v-else>
          <div v-for="g in data.groepen" :key="g.naam" class="taak-groep mt-16" :data-test="`groep-${g.naam}`">
            <h2 class="kicker kicker--streep">{{ g.naam }} <span class="pil pil--leeg">{{ g.taken.length }}</span></h2>
            <TaakKaart v-for="t in g.taken" :key="t.id" :taak="t" :bulk="data.kan.bulk" :gekozen="gekozen.has(t.id)" @open="open = t.id" @vink="vink(t)" @uitstel="stelUit(t)" @menu="openMenu($event, t)" @kies="kies(t.id)" />
          </div>
        </template>
      </div>
    </section>

    <section v-else class="section section--laatste">
      <div class="container">
        <div class="filterbalk">
          <button v-for="s in [['', 'Alle'], ['prospect', 'Prospects'], ['klant', 'Klanten']]" :key="s[0]" type="button" class="pil pil--knop" :class="{ 'pil--zwart': (route.query.soort ?? '') === s[0] }" @click="zet({ soort: s[0] || undefined })">{{ s[1] }}</button>
          <select class="invoer invoer--klein" :value="route.query.gelezen ?? ''" aria-label="Gelezen" @change="zet({ gelezen: ($event.target as HTMLSelectElement).value || undefined })"><option value="">Ongelezen</option><option value="gelezen">Gelezen</option><option value="alle">Alle open</option></select>
          <select class="invoer invoer--klein" :value="route.query.bron ?? ''" aria-label="Bron" @change="zet({ bron: ($event.target as HTMLSelectElement).value || undefined })"><option value="">Alle bronnen</option><option value="intern">Intern</option><option value="extern">Extern</option></select>
          <select v-if="functie('inzichten.afwijzen')?.beschikbaar" class="invoer invoer--klein" :value="route.query.agent ?? ''" aria-label="Agent" data-test="filter-agent" @change="zet({ agent: ($event.target as HTMLSelectElement).value || undefined })"><option value="">Alle agents</option><option value="motor">Motor</option><option v-for="(n, k) in AGENT_NAAM" :key="k" :value="k">{{ n }}</option></select>
          <label v-if="functie('agents.waaromNiet')?.beschikbaar" class="schakel-inline"><input type="checkbox" data-test="toon-tegengehouden" @change="toonTegengehouden(($event.target as HTMLInputElement).checked)"> Toon tegengehouden</label>
          <span class="dd-acties-vul" />
          <button v-if="functie('inzichten.handmatig')?.beschikbaar" type="button" class="dd-actie dd-actie--secundair" data-test="inzicht-met-bron-knop" @click="metBron = true"><Icoon naam="Plus" class="dd-actie-icoon" />Inzicht met bron</button>
        </div>
        <div class="stat-grid stat-grid--4 mt-16">
          <div class="stat-card"><span class="stat-label">Nieuw</span><span class="stat-num tnum">{{ inz.tellers.nieuw ?? 0 }}</span></div>
          <div class="stat-card"><span class="stat-label">Hot</span><span class="stat-num tnum">{{ inz.tellers.hot ?? 0 }}</span></div>
          <div class="stat-card"><span class="stat-label">Deze week</span><span class="stat-num tnum">{{ inz.tellers.week ?? 0 }}</span></div>
          <div class="stat-card"><span class="stat-label">Totaal open</span><span class="stat-num tnum">{{ inz.tellers.open ?? 0 }}</span></div>
        </div>
        <details v-if="functie('agents.waaromNiet')?.beschikbaar" class="kaart mt-16" data-test="waarom-niet" @toggle="laadWaaromNiet">
          <summary class="kaart-titel">Waarom niet?</summary>
          <p class="kaart-meta mt-8">Wat de Bewaker vandaag bij je accounts tegenhield, met de reden.</p>
          <p v-if="waaromNiet && !waaromNiet.length" class="kaart-meta mt-8">De Bewaker heeft vandaag niets tegengehouden.</p>
          <ul v-else-if="waaromNiet" class="schakel-lijst mt-8">
            <li v-for="r in waaromNiet" :key="r.id" class="schakel-rij"><span><strong>{{ r.reden }}</strong><br><span class="meta">{{ r.handeling }}<template v-if="r.account"> · {{ r.account }}</template></span></span></li>
          </ul>
        </details>
        <LegeStaat v-if="!inz.inzichten.length" class="mt-16" titel="Geen nieuwe inzichten." :tekst="route.query.agent || route.query.bron || route.query.soort ? 'Er zijn geen inzichten die aan deze filters voldoen.' : 'De agents hebben sinds gisteren niets gevonden bij je accounts.'">
          <button v-if="route.query.agent || route.query.bron || route.query.soort" type="button" class="dd-act mt-8" @click="zet({ agent: undefined, bron: undefined, soort: undefined })">Toon alles</button>
        </LegeStaat>
        <div class="ak-blokken mt-16" data-test="inzichten">
          <article v-for="i in inz.inzichten" :key="i.id" class="kaart inzicht-kaart" :data-test="`inzicht-${i.id}`">
            <div class="taak-labels"><span class="pil" :class="i.bron === 'extern' ? 'badge-extern' : 'badge-intern'">{{ i.bron === 'extern' ? 'EXTERN' : 'INTERN' }}</span><span v-if="i.specifiekeBron" class="taak-meta">{{ i.specifiekeBron }}</span><span class="taak-meta">relevantie {{ i.relevantie }} · {{ new Date(i.createdAt).toLocaleDateString('nl-NL') }}</span><span v-if="i.agent && i.agent !== 'handmatig'" class="pil pil--leeg" title="Mandaat A">{{ AGENT_NAAM[i.agent] ?? i.agent }} · A</span></div>
            <button type="button" class="taak-titel" @click="inzicht = i">{{ i.title }}</button>
            <p v-if="i.account" class="taak-meta">{{ i.account.naam }}</p>
            <p v-if="i.waarom" class="taak-meta">{{ i.waarom }}</p>
            <div class="reis-knoppen"><button type="button" class="dd-act dd-act--primair" @click="$fetch(`/api/signals/${i.id}/omzetten`, { method: 'POST', body: {} }).then(() => { toast.toon('Taak gemaakt uit het inzicht.'); refreshInz(); refresh() }).catch((e) => toast.toon(foutTekst(e), 'fout'))">+ Maak taak</button><button type="button" class="dd-act" @click="$fetch(`/api/signals/${i.id}/gelezen`, { method: 'POST' }).then(() => refreshInz())">Markeer als gelezen</button></div>
          </article>
        </div>
        <div v-if="tegengehouden" class="ak-blokken mt-16" data-test="tegengehouden">
          <p v-if="!tegengehouden.length" class="kaart-meta">Er is de laatste 30 dagen niets tegengehouden.</p>
          <article v-for="t in tegengehouden" :key="t.id" class="kaart inzicht-kaart inzicht-kaart--grijs">
            <div class="taak-labels"><span class="pil pil--leeg">TEGENGEHOUDEN</span><span class="taak-meta">{{ t.specifiekeBron }} · {{ new Date(t.createdAt).toLocaleDateString('nl-NL') }}</span></div>
            <p class="taak-titel">{{ t.title }}</p>
            <p class="taak-meta">{{ t.reden }}<template v-if="t.account"> · {{ t.account.naam }}</template></p>
          </article>
        </div>
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
    <TaakFlyout :open="!!open" :taak-id="open" :basis="alle.find((t: any) => t.id === open)" :volgende="true" @sluit="open = null" @klaar="klaar" @gewijzigd="refresh" />
    <NieuweTaakFlyout :open="nieuw" :teamleden="data.teamleden" @sluit="nieuw = false" @gemaakt="nieuw = false; refresh()" />
    <PlanAfspraakFlyout :open="nieuweAfspraak" @sluit="nieuweAfspraak = false" @gepland="(id: string) => { nieuweAfspraak = false; navigateTo(`/agenda?weergave=dag&afspraak=${id}`) }" />
    <InzichtMetBron :open="metBron" @sluit="metBron = false" @opgeslagen="refreshInz()" />
    <InzichtFlyout :open="!!inzicht" :inzicht="inzicht" @sluit="inzicht = null" @gewijzigd="refreshInz(); refresh()" />
  </div>
</template>
