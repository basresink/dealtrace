<script setup lang="ts">
// Campagnebord (F12): kop met soort, status, ritme, doel en tempo; "Begin hier" (uitgerekend, geen AI);
// zes kolommen of een lijst. Slepen naar Afspraak, Geparkeerd of Afgewezen vraagt de uitkomst en rondt
// de taak af via rondAf (gat 38); offline gaat de wissel via de wachtrij. Op de telefoon klapt elke
// kolom uit als groep.
import { KOLOM_LABEL, KOLOM_MET_UITKOMST, KOLOMMEN, type Kolom } from '~~/shared/campagnes'
const { functie, me } = useMe()
const aan = !!functie('campagnes.meedoen')?.beschikbaar
const toast = useToast()
const route = useRoute()
const router = useRouter()
const { voegToe } = useSyncQueue()
const id = computed(() => String(route.params.id))
const { data, refresh, error } = await useFetch<any>(() => `/api/campagnes/${id.value}`, { immediate: aan })
const c = computed(() => data.value?.campagne)
const klasse = useSchermklasse()
// Op de telefoon standaard de lijst met uitklapgroepen per kolom (8.12).
const weergave = computed(() => (route.query.weergave === 'lijst' || (route.query.weergave !== 'bord' && klasse.value === 'telefoon') ? 'lijst' : 'bord'))
const zoek = ref('')
const alleenMijn = ref(false)
const zichtbaar = (i: any) => (!zoek.value || i.naam.toLowerCase().includes(zoek.value.toLowerCase())) && (!alleenMijn.value || i.eigenaarId === (me.value as any)?.gebruiker?.id)
const STATUS: Record<string, string> = { concept: 'Concept', wacht: 'Wacht op bevestiging', actief: 'Actief', gepauzeerd: 'Gepauzeerd', afgerond: 'Afgerond' }
const pilKlas = (p: string) => (p === 'Voor op schema' ? 'tempo--voor' : p === 'Op schema' ? 'tempo--op' : 'tempo--achter')
const initialen = (n: string) => n.split(/\s+/).filter((w) => /^[A-Z]/.test(w)).slice(0, 2).map((w) => w[0]).join('') || n.slice(0, 2).toUpperCase()
const KLEUREN = ['blauw', 'groen', 'geel', 'oranje', 'paars', 'grijs']
const faseKleur = (f: string | null) => (f ? KLEUREN[[...f].reduce((s, ch) => s + ch.charCodeAt(0), 0) % KLEUREN.length] : 'grijs')
const datum = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' }) : '')

// Slepen en kolomwissel.
const sleept = ref<any>(null)
const doel = ref<Kolom | null>(null)
const vraag = ref<{ item: any; kolom: Kolom } | null>(null)
function laat(k: Kolom) {
  const it = sleept.value
  sleept.value = null; doel.value = null
  if (!it || it.kolom === k) return
  verplaats(it, k)
}
function verplaats(it: any, k: Kolom) {
  if (KOLOM_MET_UITKOMST.includes(k)) vraag.value = { item: it, kolom: k }
  else wissel(it, k, {})
}
async function wissel(it: any, k: Kolom, extra: Record<string, unknown>) {
  const body = { kolom: k, ...extra }
  try {
    if (import.meta.client && !navigator.onLine) {
      await voegToe({ tabel: 'campagne_items', op: 'patch', recordId: `${id.value}:${it.accountId}`, patch: { soort: 'campagne.kolom', ...body, op: new Date().toISOString() } })
      it.kolom = k
      toast.toon('Bewaard. Wordt verstuurd zodra je weer verbinding hebt.')
    } else {
      await $fetch(`/api/campagnes/${id.value}/items/${it.accountId}/kolom`, { method: 'POST', body })
      toast.toon(`${it.naam} staat in ${KOLOM_LABEL[k]}.`)
      await refresh()
    }
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
  vraag.value = null
}

// Knoppen.
const bezig = ref(false)
async function actie(pad: string, body: object, tekst: (r: any) => string) {
  bezig.value = true
  try { const r = await $fetch<any>(`/api/campagnes/${id.value}/${pad}`, { method: 'POST', body }); toast.toon(tekst(r)); await refresh() } catch (e: any) {
    if (e?.data?.data?.reden === 'capaciteit') capaciteit.value = foutTekst(e)
    else toast.toon(foutTekst(e), 'fout')
  } finally { bezig.value = false }
}
const capaciteit = ref<string | null>(null)
const activeer = (bevestiging = false) => actie('activeer', { bevestiging }, (r) => r.tekst).then(() => { if (bevestiging) capaciteit.value = null })
const zetOm = () => actie('taken', {}, (r) => `${r.aantal} ${r.aantal === 1 ? 'taak' : 'taken'} gemaakt.`)
async function pauzeer(status: 'gepauzeerd' | 'actief') {
  try { await $fetch(`/api/campagnes/${id.value}`, { method: 'PUT', body: { status, versie: c.value.versie } }); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const toevoegen = ref(false)
const nieuw = ref<{ id: string; naam: string }[]>([])
async function voegAccountsToe() {
  try {
    const r = await $fetch<any>(`/api/campagnes/${id.value}`, { method: 'PUT', body: { accountIds: nieuw.value.map((a) => a.id), versie: c.value.versie } })
    toast.toon(`${r.toegevoegd} ${r.toegevoegd === 1 ? 'account' : 'accounts'} toegevoegd.`); nieuw.value = []; toevoegen.value = false; await refresh()
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const verdelen = ref(false)
const verdeling = reactive<{ wijze: string; eigenaars: string[] }>({ wijze: 'gelijk', eigenaars: [] })
const { data: ctx } = await useFetch<any>('/api/campagnes/context', { immediate: aan, default: () => ({ verkopers: [] }) })
async function verdeel() { await actie('verdeel', verdeling, (r) => `${r.verdeeld} accounts verdeeld.`); verdelen.value = false }
const voortgangOpen = ref(false)
const { data: tussenstand, execute: laadResultaat } = useFetch<any>(() => `/api/campagnes/${id.value}/resultaat`, { immediate: false })
watch(voortgangOpen, (o) => { if (o) laadResultaat() })
const resultaat = computed(() => c.value?.status === 'afgerond' ? data.value?.resultaat : tussenstand.value)
const RES: [string, string][] = [['accounts', 'Accounts'], ['bereikt', 'Bereikt'], ['gesprekken', 'Gesprekken'], ['afsprakenGepland', 'Afspraken gepland'], ['afsprakenGehouden', 'Afspraken gehouden'], ['overgedragen', 'Overgedragen']]
useHead(() => ({ title: `${c.value?.naam ?? 'Campagne'} · Dealtrace` }))
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="campagnes.meedoen" />
    <LegeStaat v-else-if="error || !c" titel="Campagne niet gevonden." />
    <template v-else>
      <PaginaKop :kicker="`${c.soortNaam} · ${STATUS[c.status]}`" :titel="c.naam" helpartikel="campagnes">
        <template #acties>
          <template v-if="data.kan.wijzigen">
            <button v-if="c.status === 'concept'" type="button" class="dd-actie dd-actie--primair" :disabled="bezig" data-test="bord-activeer" @click="activeer()">Activeer</button>
            <button v-if="c.status === 'actief' && data.zonderTaak" type="button" class="dd-actie dd-actie--primair" :disabled="bezig" data-test="zet-om" @click="zetOm">Zet om naar taken ({{ data.zonderTaak }})</button>
            <button v-if="c.status === 'actief' && data.zonderTaak" type="button" class="dd-actie dd-actie--secundair" :disabled="bezig" data-test="verdeel-blokken" @click="zetOm">Verdeel over {{ c.uitvoerder === 'buitendienst' ? 'regiodagen' : 'belblokken' }}</button>
            <button v-if="data.kan.verdelen && c.status !== 'afgerond'" type="button" class="dd-actie dd-actie--secundair" data-test="verdeel" @click="verdelen = true">Verdeel over verkopers</button>
            <button v-if="c.status !== 'afgerond'" type="button" class="dd-actie dd-actie--secundair" data-test="plus-accounts" @click="toevoegen = !toevoegen">+ Accounts</button>
            <button v-if="c.status === 'actief'" type="button" class="dd-actie dd-actie--secundair" @click="pauzeer('gepauzeerd')">Pauzeer</button>
            <button v-if="c.status === 'gepauzeerd'" type="button" class="dd-actie dd-actie--secundair" @click="pauzeer('actief')">Hervat</button>
          </template>
          <button v-if="c.status !== 'afgerond'" type="button" class="dd-actie dd-actie--secundair" data-test="voortgang" @click="voortgangOpen = !voortgangOpen">Voortgang</button>
        </template>
      </PaginaKop>
      <section class="section">
        <div class="container">
          <div class="cp-kop kaart" data-test="bord-kop">
            <div><span class="filter-label">Winpunt</span><strong>{{ c.winpunt ?? 'Geen' }}</strong></div>
            <div v-if="c.ritme"><span class="filter-label">Ritme</span><strong>{{ c.ritme }}</strong></div>
            <div><span class="filter-label">Doel en stand</span><strong data-test="stand">{{ c.gehaald }} van {{ c.doel?.type === 'procent' ? Math.ceil((c.accounts * c.doel.waarde) / 100) : c.doel?.waarde ?? c.accounts }} afspraken</strong></div>
            <div v-if="c.eindOp"><span class="filter-label">Looptijd</span><strong>{{ c.startOp ? datum(c.startOp) : 'nog niet gestart' }} tot {{ datum(c.eindOp) }}</strong></div>
            <div v-if="c.tempo"><span class="tempo" :class="pilKlas(c.tempo.pil)" data-test="bord-tempo">{{ c.tempo.pil }}</span><div class="cp-voortgang"><div class="cp-balk" :style="{ width: `${c.tempo.voortgang}%` }" /><div class="cp-verwacht" :style="{ left: `${c.tempo.verwacht}%` }" /></div></div>
          </div>
          <p v-if="c.status === 'wacht'" class="kaart kaart--geel mt-16">Deze campagne wacht op bevestiging van de salesmanager.</p>

          <div v-if="toevoegen" class="kaart mt-16" data-test="accounts-toevoegen">
            <AccountKiezer v-model="nieuw" />
            <button type="button" class="dd-act dd-act--primair mt-8" :disabled="!nieuw.length" @click="voegAccountsToe">Voeg toe</button>
          </div>

          <div v-if="resultaat && (c.status === 'afgerond' || voortgangOpen)" class="kaart mt-16" data-test="resultaat">
            <h2 class="fo-blok-titel">{{ c.status === 'afgerond' ? 'Resultaat' : 'Tussenstand' }}</h2>
            <div class="fo-cijfers">
              <div v-for="[k, l] in RES" :key="k" class="fo-cijfer"><span class="fo-cijfer-waarde">{{ resultaat[k] }}</span><span class="fo-cijfer-label">{{ l }}</span></div>
              <div class="fo-cijfer"><span class="fo-cijfer-waarde">{{ resultaat.conversie }}%</span><span class="fo-cijfer-label">Conversie</span></div>
              <div v-if="resultaat.winpuntUitgevoerd !== null" class="fo-cijfer"><span class="fo-cijfer-waarde">{{ resultaat.winpuntUitgevoerd }}%</span><span class="fo-cijfer-label">Winpunt uitgevoerd (norm 90)</span></div>
            </div>
          </div>

          <div v-if="data.beginHier.length" class="kaart kaart--geel mt-16" data-test="begin-hier">
            <span class="fo-blok-kicker">Begin hier · uitgerekend, geen AI</span>
            <ol class="cp-begin"><li v-for="b in data.beginHier" :key="b.accountId"><NuxtLink :to="`/accounts/${b.accountId}`">{{ b.naam }}</NuxtLink> <span class="rij-sub">{{ b.waarom }}</span></li></ol>
          </div>

          <div class="cp-werkbalk mt-16">
            <div class="cp-tonen" role="tablist" aria-label="Weergave">
              <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': weergave === 'bord' }" :aria-pressed="weergave === 'bord'" @click="router.replace({ query: { ...route.query, weergave: 'bord' } })">Bord</button>
              <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': weergave === 'lijst' }" :aria-pressed="weergave === 'lijst'" data-test="weergave-lijst" @click="router.replace({ query: { ...route.query, weergave: 'lijst' } })">Lijst</button>
            </div>
            <input v-model="zoek" class="invoer cp-zoek" placeholder="Zoek op naam" aria-label="Zoek op naam">
            <label class="keuze"><input v-model="alleenMijn" type="checkbox"> Alleen van mij</label>
          </div>

          <div v-if="weergave === 'bord'" class="kanban kanban--campagne mt-16" data-test="bord">
            <div v-for="k in data.kolommen" :key="k.kolom" class="kanban-col" :class="[`cp-kol--${k.kolom}`, { 'kanban-col--sleepdoel': doel === k.kolom }]" :data-test="`kolom-${k.kolom}`"
              @dragover.prevent="doel = k.kolom" @dragleave="doel = null" @drop.prevent="laat(k.kolom)">
              <div class="col-head"><h3 class="col-title">{{ KOLOM_LABEL[k.kolom as Kolom] }}</h3><span class="col-count">{{ k.items.filter(zichtbaar).length }}</span></div>
              <div class="col-items">
                <p v-if="!k.items.filter(zichtbaar).length" class="col-empty">Leeg</p>
                <article v-for="i in k.items.filter(zichtbaar)" :key="i.accountId" class="kanban-kaart" :draggable="data.kan.slepen && c.status === 'actief'" :class="{ 'kanban-kaart--sleept': sleept === i }" :data-test="`kaart-${i.accountId}`" @dragstart="sleept = i" @dragend="sleept = null">
                  <div class="cp-kaart-regel"><span class="cp-initialen" :class="`cp-initialen--${faseKleur(i.faseId)}`">{{ initialen(i.naam) }}</span><NuxtLink :to="`/accounts/${i.accountId}`" class="kanban-kaart-titel">{{ i.naam }}</NuxtLink></div>
                  <div class="kanban-kaart-noot">poging {{ i.poging }} van {{ i.pogingen }}</div>
                  <div v-if="i.volgendeStap" class="rij-sub">{{ i.volgendeStap }}<template v-if="i.volgendeOp"> · {{ datum(i.volgendeOp) }}</template></div>
                  <div class="kanban-kaart-voet"><span>{{ i.eigenaar ?? '' }}</span>
                    <select v-if="data.kan.slepen && c.status === 'actief'" class="cp-verplaats" :aria-label="`Verplaats ${i.naam}`" :value="i.kolom" :data-test="`verplaats-${i.accountId}`" @change="verplaats(i, ($event.target as HTMLSelectElement).value as Kolom)">
                      <option v-for="kk in KOLOMMEN" :key="kk" :value="kk">{{ KOLOM_LABEL[kk] }}</option>
                    </select>
                  </div>
                </article>
              </div>
            </div>
          </div>
          <div v-else class="lijst mt-16" data-test="lijst">
            <details v-for="k in data.kolommen" :key="k.kolom" class="cp-groep" :open="!['geparkeerd', 'afgewezen'].includes(k.kolom)">
              <summary>{{ KOLOM_LABEL[k.kolom as Kolom] }} <span class="pil-teller">{{ k.items.filter(zichtbaar).length }}</span></summary>
              <div v-for="i in k.items.filter(zichtbaar)" :key="i.accountId" class="rij rij--compact">
                <div class="rij-info"><NuxtLink :to="`/accounts/${i.accountId}`" class="rij-titel">{{ i.naam }}</NuxtLink><div class="rij-sub">poging {{ i.poging }} van {{ i.pogingen }}<template v-if="i.volgendeStap"> · {{ i.volgendeStap }}</template><template v-if="i.volgendeOp"> · {{ datum(i.volgendeOp) }}</template> · {{ i.eigenaar }}</div></div>
                <select v-if="data.kan.slepen && c.status === 'actief'" class="invoer cp-verplaats" :aria-label="`Verplaats ${i.naam}`" :value="i.kolom" @change="verplaats(i, ($event.target as HTMLSelectElement).value as Kolom)">
                  <option v-for="kk in KOLOMMEN" :key="kk" :value="kk">{{ KOLOM_LABEL[kk] }}</option>
                </select>
              </div>
            </details>
          </div>
        </div>
      </section>
    </template>
    <KolomVenster v-if="vraag" :naam="vraag.item.naam" :kolom="vraag.kolom" :met-winpunt="!!c?.winpuntId" @sluit="vraag = null; refresh()" @bewaar="(x) => wissel(vraag!.item, vraag!.kolom, x)" />
    <BevestigVenster :open="!!capaciteit" titel="Boven capaciteit" :tekst="capaciteit ?? ''" bevestig="Vraag bevestiging" @bevestigd="activeer(true)" @geannuleerd="capaciteit = null" />
    <Teleport to="body">
      <div v-if="verdelen" class="cd-overlay" @click.self="verdelen = false">
        <form class="cd-dialog" role="dialog" aria-modal="true" aria-labelledby="vd-titel" @submit.prevent="verdeel">
          <div class="cd-head"><h2 id="vd-titel" class="cd-title">Verdeel over verkopers</h2></div>
          <label class="veld"><span class="veld-label">Wijze</span><select v-model="verdeling.wijze" class="invoer"><option value="gelijk">Gelijk</option><option value="gebied">Op gebied</option><option value="capaciteit">Op capaciteit</option></select></label>
          <fieldset class="veld"><legend class="veld-label">Verkopers</legend>
            <label v-for="u in ctx.verkopers" :key="u.id" class="keuze"><input v-model="verdeling.eigenaars" type="checkbox" :value="u.id"> {{ u.naam }}</label>
          </fieldset>
          <div class="cd-foot"><button type="button" class="cd-btn cd-btn--ghost" @click="verdelen = false">Annuleren</button><button type="submit" class="cd-btn cd-btn--primary" :disabled="!verdeling.eigenaars.length">Verdeel</button></div>
        </form>
      </div>
    </Teleport>
  </div>
</template>
