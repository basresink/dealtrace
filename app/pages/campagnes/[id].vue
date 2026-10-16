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
const pilKlas = (p: string) => (p === 'Voor op schema' ? 'voor' : p === 'Op schema' ? 'op' : 'achter')
const doelNodig = computed(() => (c.value?.doel?.type === 'procent' ? Math.ceil((c.value.accounts * c.value.doel.waarde) / 100) : c.value?.doel?.waarde ?? c.value?.accounts ?? 0))
const voortgangPct = computed(() => c.value?.tempo?.voortgang ?? (c.value?.accounts ? Math.round((c.value.klaar / c.value.accounts) * 100) : 0))
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
      <section class="section">
        <div class="container">
          <nav class="cb-kruimel"><NuxtLink to="/campagnes" class="cb-kruimel-link" data-test="terug-campagnes"><Icoon naam="ArrowLeft" :grootte="14" />Alle campagnes</NuxtLink></nav>
          <div class="cb-kop" data-test="bord-kop">
            <div class="cb-kop-tekst">
              <span class="kicker kicker--streep">{{ c.soortNaam }} · {{ STATUS[c.status] }}</span>
              <h1 class="title title--groot">{{ c.naam }}</h1>
              <p v-if="c.ritme || c.eindOp" class="subtitle">
                <template v-if="c.ritme">Ritme {{ c.ritme }}</template><template v-if="c.ritme && c.eindOp"> · </template><template v-if="c.eindOp">{{ c.startOp ? datum(c.startOp) : 'nog niet gestart' }} tot {{ datum(c.eindOp) }}</template>
              </p>
              <div class="cb-doelen">
                <p class="cb-doel"><span class="cb-doel-kop">Winpunt</span>{{ c.winpunt ?? 'Geen' }}</p>
                <p class="cb-doel"><span class="cb-doel-kop">Doel en stand</span><strong data-test="stand">{{ c.gehaald }} van {{ doelNodig }} afspraken</strong></p>
              </div>
            </div>
            <div class="toolbar-buttons cb-knoppen" data-test="kop-knoppen">
              <KopIconen artikel="campagnes" />
              <template v-if="data.kan.wijzigen">
                <button v-if="c.status === 'concept'" type="button" class="dd-actie dd-actie--primair" :disabled="bezig" data-test="bord-activeer" @click="activeer()">Activeer</button>
                <button v-if="c.status === 'actief' && data.zonderTaak" type="button" class="dd-actie dd-actie--primair" :disabled="bezig" data-test="zet-om" @click="zetOm">Zet om naar taken ({{ data.zonderTaak }})</button>
                <button v-if="c.status === 'actief' && data.zonderTaak" type="button" class="dd-actie dd-actie--secundair" :disabled="bezig" data-test="verdeel-blokken" @click="zetOm">Verdeel over {{ c.uitvoerder === 'buitendienst' ? 'regiodagen' : 'belblokken' }}</button>
                <button v-if="data.kan.verdelen && c.status !== 'afgerond'" type="button" class="dd-actie dd-actie--secundair" data-test="verdeel" @click="verdelen = true">Verdeel over verkopers</button>
                <button v-if="c.status === 'actief'" type="button" class="dd-actie dd-actie--secundair" @click="pauzeer('gepauzeerd')"><Icoon naam="Pause" class="dd-actie-icoon" />Pauzeer</button>
                <button v-if="c.status === 'gepauzeerd'" type="button" class="dd-actie dd-actie--secundair" @click="pauzeer('actief')">Hervat</button>
              </template>
              <button v-if="c.status !== 'afgerond'" type="button" class="dd-actie dd-actie--secundair" :aria-expanded="voortgangOpen" data-test="voortgang" @click="voortgangOpen = !voortgangOpen">Voortgang</button>
              <button v-if="data.kan.wijzigen && c.status !== 'afgerond'" type="button" class="dd-actie dd-actie--zwart" data-test="plus-accounts" @click="toevoegen = !toevoegen"><Icoon naam="Plus" class="dd-actie-icoon" />Accounts</button>
            </div>
          </div>

          <div class="cb-tempo-rij">
            <span v-if="c.tempo" class="cb-tempo" :class="`cb-tempo--${pilKlas(c.tempo.pil)}`" data-test="bord-tempo">{{ c.tempo.pil }}</span>
            <span v-if="c.dagenOver !== null" class="cb-dagen tnum">nog {{ c.dagenOver }} {{ c.dagenOver === 1 ? 'dag' : 'dagen' }}</span>
            <span v-if="c.status === 'actief' && c.accounts && !data.zonderTaak" class="cb-hint">Alle accounts hebben een taak.</span>
            <span class="cb-vul" />
            <div class="cb-stats">
              <div class="cb-stat"><span class="cb-stat-num tnum">{{ c.accounts }}</span><span class="cb-stat-label">accounts</span></div>
              <div class="cb-stat"><span class="cb-stat-num tnum">{{ voortgangPct }}%</span><span class="cb-stat-label">voortgang</span></div>
              <div v-if="c.tempo" class="cb-stat"><span class="cb-stat-num tnum">{{ c.tempo.verwacht }}%</span><span class="cb-stat-label">verwacht</span></div>
            </div>
          </div>
          <div v-if="c.tempo" class="cb-balk" :aria-label="`Voortgang ${c.tempo.voortgang} procent, verwacht ${c.tempo.verwacht} procent`"><div class="cb-vulling" :style="{ width: `${c.tempo.voortgang}%` }" /><div class="cb-verwacht" :style="{ left: `${c.tempo.verwacht}%` }" title="Verwachte stand" /></div>
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

          <aside v-if="data.beginHier.length" class="cb-advies" aria-label="Begin hier" data-test="begin-hier">
            <span class="cb-advies-kicker">Begin hier · uitgerekend, geen AI</span>
            <h2 class="cb-advies-titel">Begin bij de accounts waar het het langst stil is.</h2>
            <ol class="cb-advies-lijst"><li v-for="b in data.beginHier" :key="b.accountId" class="cb-advies-item"><NuxtLink :to="`/accounts/${b.accountId}`" class="cb-advies-naam">{{ b.naam }}</NuxtLink><span class="cb-advies-reden">{{ b.waarom }}</span></li></ol>
          </aside>
        </div>
      </section>
      <section class="section section--laatste">
        <div class="container">
          <div class="cp-werkbalk">
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
                  <NuxtLink :to="`/accounts/${i.accountId}`" class="cb-item-link"><span class="cb-item-merk" :class="`cb-item-merk--${faseKleur(i.faseId)}`">{{ initialen(i.naam) }}</span><span class="cb-item-naam">{{ i.naam }}</span></NuxtLink>
                  <div class="cb-item-poging">poging {{ i.poging }} van {{ i.pogingen }}</div>
                  <p v-if="i.volgendeStap" class="cb-item-noot">{{ i.volgendeStap }}<template v-if="i.volgendeOp"> · {{ datum(i.volgendeOp) }}</template></p>
                  <NuxtLink v-if="i.taakId" :to="`/taken?taak=${i.taakId}`" class="cb-item-taak" :data-test="`taak-${i.accountId}`">Bekijk taak <Icoon naam="ArrowRight" :grootte="12" /></NuxtLink>
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

<style scoped>
.cb-kruimel { margin-bottom: 8px; }
.cb-kruimel-link { display: inline-flex; align-items: center; gap: 4px; min-height: 32px; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); text-decoration: none; border: 0; }
.cb-kruimel-link:hover { color: var(--ink); }
.cb-kop { display: grid; grid-template-columns: 1fr; gap: 16px; align-items: start; }
@media (min-width: 720px) { .cb-kop { grid-template-columns: minmax(0, 1fr) auto; } }
.cb-kop-tekst { min-width: 0; }
.cb-kop .title { overflow-wrap: anywhere; }
.cb-doelen { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.cb-doel { margin: 0; padding: 8px 12px; background: var(--surface); border-left: 3px solid var(--yellow); font-size: 13px; display: flex; flex-direction: column; gap: 2px; }
.cb-doel-kop { font-size: var(--fs-label); font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
.cb-stats { display: flex; gap: 20px; }
.cb-stat { display: flex; flex-direction: column; align-items: flex-end; }
.cb-stat-num { font-family: var(--font-serif); font-size: 24px; font-weight: 700; line-height: 1; }
.cb-stat-label { font-size: var(--fs-label); font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); margin-top: 4px; }
.cb-tempo-rij { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 16px; }
.cb-tempo { font-size: var(--fs-label); font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; padding: 3px 9px; border-radius: 2px; }
.cb-tempo--voor { background: var(--green); color: var(--wit); }
.cb-tempo--op { background: var(--surface); color: var(--ink); border: 1px solid var(--border-strong); }
.cb-tempo--achter { background: var(--red); color: var(--wit); }
.cb-dagen, .cb-hint { font-size: 12px; color: var(--muted); }
.cb-vul { flex: 1; }
.cb-knoppen { display: flex; flex-wrap: wrap; gap: 8px; }
/* De knoppen staan rechts op de hoogte van de titel (kicker plus de marge boven de titel). */
@media (min-width: 720px) { .cb-knoppen { justify-content: flex-end; max-width: min(620px, 52vw); margin-top: max(0px, calc(26px + 12px + (1.1 * clamp(28px, 4vw, 44px) - 44px) / 2)); } }
.cb-balk { position: relative; height: 6px; margin-top: 12px; background: var(--surface); }
.cb-vulling { height: 100%; background: var(--green); }
.cb-verwacht { position: absolute; top: -4px; bottom: -4px; width: 2px; background: var(--red); }
.cb-advies { margin-top: 16px; padding: 14px 16px; background: var(--surface); border: 1px solid var(--border); border-left: 3px solid var(--yellow); }
.cb-advies-kicker { font-size: var(--fs-label); font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
.cb-advies-titel { font-family: var(--font-serif); font-size: 15px; font-weight: 700; margin: 4px 0 0; }
.cb-advies-lijst { list-style: none; margin: 12px 0 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
@media (max-width: 960px) { .cb-advies-lijst { grid-template-columns: 1fr; } }
.cb-advies-item { background: var(--wit); border: 1px solid var(--border); padding: 10px 12px; display: flex; flex-direction: column; gap: 2px; }
.cb-advies-naam { font-size: 13px; font-weight: 700; color: var(--ink); text-decoration: none; border: 0; }
.cb-advies-naam:hover { text-decoration: underline; text-underline-offset: 3px; }
.cb-advies-reden { font-size: 11px; color: var(--muted); }
.cb-item-link { display: block; color: var(--ink); text-decoration: none; border: 0; min-width: 0; }
.cb-item-merk { display: inline-flex; width: 24px; height: 24px; margin-right: 8px; vertical-align: middle; align-items: center; justify-content: center; background: var(--muted); color: var(--wit); font-family: var(--font-serif); font-weight: 700; font-size: 11px; }
.cb-item-merk--blauw { background: var(--blue); }
.cb-item-merk--groen { background: var(--green); }
.cb-item-merk--geel { background: var(--yellow-dark); }
.cb-item-merk--oranje { background: var(--orange); }
.cb-item-merk--paars { background: var(--purple); }
.cb-item-naam { font-size: 13px; font-weight: 600; line-height: 1.5; vertical-align: middle; }
.cb-item-link:hover .cb-item-naam { text-decoration: underline; }
.cb-item-poging { margin-top: 6px; font-size: 11px; color: var(--muted); }
.cb-item-noot { margin: 8px 0 0; padding: 6px 8px; font-size: 11px; color: var(--ink-soft); background: var(--surface); border-left: 2px solid var(--border-strong); line-height: 1.45; }
.cb-item-taak { display: inline-flex; align-items: center; gap: 4px; margin-top: 6px; font-size: 11px; font-weight: 700; color: var(--muted); text-decoration: none; border: 0; }
.cb-item-taak:hover { color: var(--ink); text-decoration: underline; }
@media (max-width: 719px) {
  .cb-stats { justify-content: flex-start; }
  .cb-stat { align-items: flex-start; }
  .cb-knoppen { width: 100%; }
  .cb-kruimel-link, .cb-item-taak { min-height: var(--touch-target-min); }
}
</style>
