<script setup lang="ts">
// CRM-koppeling (P20, F02, hoofdstuk 12): verbinden met OAuth, richting per object, veldtoewijzing met
// voorbeeld, eigenaarsregel, synchronisatiemoment, conflictregel en het synchronisatielog. Opslaan per
// veld na 600 ms (F22). Een Expert leest mee en synchroniseert; de beheerder richt in.
import { BRONNEN } from '~~/shared/herkomst'
import { CRM_BESCHIKBAAR, CRM_LABEL, CRM_OBJECTEN, CRM_SOORTEN, DEALTRACE_VELDEN, OBJECT_LABEL, RICHTING_LABEL, type Richting, type Toewijzing } from '~~/shared/crm'
const { functie } = useMe()
const toast = useToast()
const route = useRoute()
const aan = computed(() => !!functie('koppeling.crm')?.beschikbaar || !!functie('koppeling.crmSync')?.beschikbaar)
const { data: crm, refresh } = await useFetch<any>('/api/koppelingen/hubspot', { immediate: aan.value, default: () => null })
onMounted(() => {
  if (route.query.verbonden) toast.toon('HubSpot is gekoppeld.')
  if (typeof route.query.fout === 'string') toast.toon(route.query.fout, 'fout')
})
const magInrichten = computed(() => !!crm.value?.kan?.inrichten)
let timer: any
const opgeslagen = ref<string | null>(null)
async function bewaar(body: Record<string, unknown>, sleutel: string, direct = false) {
  clearTimeout(timer)
  const doe = async () => {
    try { crm.value = { ...crm.value, ...(await $fetch<any>('/api/koppelingen/hubspot', { method: 'PUT', body })) }; opgeslagen.value = sleutel; setTimeout(() => { if (opgeslagen.value === sleutel) opgeslagen.value = null }, 2000) } catch (e) { toast.toon(foutTekst(e), 'fout'); await refresh() }
  }
  if (direct) await doe(); else timer = setTimeout(doe, 600)
}
function zetRichting(o: string, r: Richting) { bewaar({ richting: { ...crm.value.richting, [o]: r } }, `richting-${o}`, true) }
function zetToewijzing(object: 'bedrijven' | 'contacten', i: number, veld: keyof Toewijzing, w: string) {
  const lijst = crm.value.toewijzing[object].map((t: Toewijzing, n: number) => (n === i ? { ...t, [veld]: w } : t))
  crm.value.toewijzing[object] = lijst
  bewaar({ toewijzing: { [object]: lijst } }, `tw-${object}-${i}`)
}
function voegToe(object: 'bedrijven' | 'contacten') { crm.value.toewijzing[object] = [...crm.value.toewijzing[object], { crmVeld: '', veld: '' }] }
function haalWeg(object: 'bedrijven' | 'contacten', i: number) { const lijst = crm.value.toewijzing[object].filter((_: any, n: number) => n !== i); crm.value.toewijzing[object] = lijst; bewaar({ toewijzing: { [object]: lijst } }, `tw-${object}`, true) }
const voorbeeld = (object: 'bedrijven' | 'contacten', t: Toewijzing) => { const v = crm.value?.voorbeeld?.[object]; const w = object === 'bedrijven' ? v?.ruw?.[t.crmVeld] : v?.[t.veld]; return w == null || w === '' ? 'leeg' : String(w) }
const bezig = ref(false)
async function sync() {
  bezig.value = true
  try { const r = await $fetch<any>('/api/koppelingen/hubspot/sync', { method: 'POST' }); toast.toon(r.melding ?? `Gelezen ${r.gelezen}, geschreven ${r.geschreven}, fouten ${r.fouten}.`, r.melding ? 'fout' : undefined); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
async function test() { try { const r = await $fetch<any>('/api/koppelingen/hubspot/test', { method: 'POST' }); toast.toon(r.melding, r.ok ? undefined : 'fout') } catch (e) { toast.toon(foutTekst(e), 'fout') } }
const ontkoppelVraag = ref(false)
async function ontkoppel() { try { crm.value = { ...crm.value, ...(await $fetch<any>('/api/koppelingen/hubspot/ontkoppel', { method: 'POST' })) }; ontkoppelVraag.value = false; toast.toon('HubSpot is ontkoppeld.') } catch (e) { toast.toon(foutTekst(e), 'fout') } }
const alleenFouten = ref(false)
const runs = computed(() => (crm.value?.runs ?? []).filter((r: any) => !alleenFouten.value || r.fouten.length))
const openRun = ref<string | null>(null)
const datum = (d: string | null) => (d ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(d)) : '')
const BRON_NAAM: Record<string, string> = { hand: 'handmatig', kvk: 'KvK', datacollectief: 'Datacollectief', crm: 'CRM', salesdna: 'SalesDNA', web: 'web', ai: 'AI', import: 'import' }
const titel = computed(() => (crm.value?.verbonden ? `HubSpot gekoppeld${crm.value.account ? ` met ${crm.value.account}` : ''}` : crm.value?.status === 'fout' ? 'De CRM-koppeling geeft een fout' : 'Nog geen CRM gekoppeld'))
useHead({ title: 'CRM-koppeling · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="koppeling.crm" />
    <template v-else>
      <InstellingenKop groep="Koppelingen" :titel="titel" uitleg="CRM-koppeling: Dealtrace leest je CRM om dubbel werk te voorkomen en schrijft terug wat je hier doet. Deals en offertes maakt het CRM zelf." helpartikel="koppelingen" :filters="crm?.runs?.length ? (alleenFouten ? 1 : 0) : null" @reset="alleenFouten = false">
        <template #acties>
          <a v-if="crm && magInrichten && !crm.verbonden" class="dd-actie dd-actie--primair" href="/api/koppelingen/hubspot/start" data-test="crm-verbind"><Icoon naam="Link" class="dd-actie-icoon" />{{ crm.status === 'fout' ? 'Verbind opnieuw' : 'Verbind met HubSpot' }}</a>
          <button v-else-if="crm?.verbonden" type="button" class="dd-actie dd-actie--primair" :disabled="bezig || !crm.kan.synchroniseren" data-test="crm-sync" @click="sync"><Icoon naam="RefreshCw" class="dd-actie-icoon" />Synchroniseer nu</button>
        </template>
        <template #filters>
          <div class="ifp-groep" role="group" aria-label="Synchronisatielog"><span class="filter-label">Log</span>
            <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': !alleenFouten }" :aria-pressed="!alleenFouten" @click="alleenFouten = false">Alle runs</button>
            <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': alleenFouten }" :aria-pressed="alleenFouten" @click="alleenFouten = true">Alleen met fouten</button>
          </div>
        </template>
      </InstellingenKop>
      <section class="section section--laatste">
        <div class="container">
          <p class="alleen-groot-melding kaart kaart--geel">Beter op een groot scherm.</p>
          <article class="kaart" data-test="crm-keuze">
            <header class="kaart-kop"><h2 class="kaart-titel">Welk CRM</h2></header>
            <div class="chips mt-8">
              <InstellingLabel v-for="s in CRM_SOORTEN" :key="s" :stand="CRM_BESCHIKBAAR.includes(s) ? 'aan' : 'concept'" :tekst="CRM_BESCHIKBAAR.includes(s) ? CRM_LABEL[s] : `${CRM_LABEL[s]} · Volgt`" />
            </div>
          </article>

          <article v-if="crm" class="kaart mt-16" data-test="crm-verbinding">
            <header class="kaart-kop"><h2 class="kaart-titel">HubSpot</h2>
              <span data-test="crm-status"><InstellingLabel v-if="crm.status === 'fout' && !crm.verbonden" stand="fout" /><InstellingLabel v-else :stand="crm.verbonden ? 'gekoppeld' : 'niet-gekoppeld'" :tekst="crm.verbonden ? 'Verbonden' : 'Niet verbonden'" /></span></header>
            <p v-if="crm.verbonden" class="tekst">Verbonden met {{ crm.account }} sinds {{ datum(crm.verbondenOp) }}.<template v-if="crm.laatsteSync"> Laatst gesynchroniseerd {{ datum(crm.laatsteSync) }}.</template></p>
            <p v-else-if="crm.laatsteFout" class="tekst tekst-rood">{{ crm.laatsteFout }}</p>
            <LegeStaat v-else titel="Er is nog geen CRM gekoppeld." tekst="Verbind je CRM om te voorkomen dat je klanten of prospects van collega's opnieuw benadert." />
            <div class="dd-acties mt-16">
              <button v-if="magInrichten && crm.verbonden" type="button" class="dd-act" data-test="crm-test" @click="test">Test verbinding</button>
              <button v-if="magInrichten && crm.verbonden" type="button" class="dd-act dd-act--gevaar" data-test="crm-ontkoppel" @click="ontkoppelVraag = true">Ontkoppel</button>
            </div>
            <p class="meta mt-8">Dealtrace synchroniseert elk uur en op verzoek.</p>
          </article>

          <template v-if="crm?.verbonden || crm?.status === 'fout'">
            <article class="kaart mt-16" data-test="crm-richting">
              <header class="kaart-kop"><h2 class="kaart-titel">Richting per object</h2></header>
              <p class="meta">Begin met lezen. Zet schrijven pas aan als de veldtoewijzing klopt.</p>
              <div v-for="o in CRM_OBJECTEN" :key="o" class="crm-rij">
                <span class="crm-rij-naam">{{ OBJECT_LABEL[o] }}<template v-if="o === 'activiteiten'"><br><span class="meta">pogingen, uitkomsten en eerste afspraken</span></template></span>
                <div class="cp-tonen" role="radiogroup" :aria-label="OBJECT_LABEL[o]">
                  <button v-for="(l, r) in RICHTING_LABEL" :key="r" type="button" role="radio" class="filter-pil" :class="{ 'filter-pil--aan': crm.richting[o] === r }" :aria-checked="crm.richting[o] === r" :disabled="!magInrichten" :data-test="`richting-${o}-${r}`" @click="zetRichting(o, r as Richting)">{{ l }}</button>
                </div>
                <span v-if="opgeslagen === `richting-${o}`" class="meta">Opgeslagen</span>
              </div>
              <label class="schakel-inline mt-8"><input type="checkbox" :checked="crm.overdracht" :disabled="!magInrichten" data-test="crm-overdracht" @change="bewaar({ overdracht: ($event.target as HTMLInputElement).checked }, 'overdracht', true)"> Overdracht naar dit CRM</label>
              <p class="meta">Staat dit aan, dan kies je het CRM bij "Overdragen?" na een gehouden eerste afspraak. Het CRM maakt zelf de deal.</p>
            </article>

            <article v-for="object in (['bedrijven', 'contacten'] as const)" :key="object" class="kaart mt-16" :data-test="`toewijzing-${object}`">
              <header class="kaart-kop"><h2 class="kaart-titel">Veldtoewijzing {{ OBJECT_LABEL[object].toLowerCase() }}</h2></header>
              <div class="tabel-scroll">
                <table class="tabel tabel--kaarten">
                  <thead><tr><th>CRM-veld</th><th>Dealtrace-veld</th><th>Voorbeeld</th><th /></tr></thead>
                  <tbody>
                    <tr v-for="(t, i) in (crm.toewijzing[object] as Toewijzing[])" :key="i">
                      <td><input :value="t.crmVeld" class="invoer invoer--klein" :disabled="!magInrichten" :aria-label="`CRM-veld ${i + 1}`" @input="zetToewijzing(object, i, 'crmVeld', ($event.target as HTMLInputElement).value)"></td>
                      <td><select :value="t.veld" class="invoer invoer--klein" :disabled="!magInrichten" :aria-label="`Dealtrace-veld ${i + 1}`" @change="zetToewijzing(object, i, 'veld', ($event.target as HTMLSelectElement).value)"><option value="" disabled>Kies</option><option v-for="(l, v) in DEALTRACE_VELDEN[object]" :key="v" :value="v">{{ l }}</option><option v-if="t.veld.startsWith('cf:')" :value="t.veld">Eigen veld {{ t.veld.slice(3) }}</option></select></td>
                      <td class="meta">{{ voorbeeld(object, t) }}<span v-if="opgeslagen === `tw-${object}-${i}`"> · Opgeslagen</span></td>
                      <td><button v-if="magInrichten" type="button" class="dd-act dd-act--icoon" :aria-label="`Toewijzing ${i + 1} weghalen`" @click="haalWeg(object, i)"><Icoon naam="X" :grootte="14" /></button></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <button v-if="magInrichten" type="button" class="dd-act mt-8" @click="voegToe(object)">+ Veld</button>
              <p class="meta mt-8">Een eigen veld koppel je als <code>cf:sleutel</code>. Een lege waarde in het CRM wist niets in Dealtrace.</p>
            </article>

            <article class="kaart mt-16" data-test="crm-eigenaars">
              <header class="kaart-kop"><h2 class="kaart-titel">Eigenaarsregel</h2></header>
              <p class="tekst">De eigenaar in het CRM wordt de gebruiker met hetzelfde e-mailadres. Hoofdletters tellen niet.</p>
              <label class="veld mt-8"><span class="veld-label">Wijs toe aan als de eigenaar onbekend is</span>
                <select :value="crm.eigenaarsregel.terugval ?? ''" class="invoer" :disabled="!magInrichten" data-test="crm-terugval" @change="bewaar({ eigenaarsregel: { terugval: ($event.target as HTMLSelectElement).value || null } }, 'terugval', true)">
                  <option value="">De salesmanager van het team</option><option v-for="g in crm.gebruikers" :key="g.id" :value="g.id">{{ g.naam.replace(/^Testgebruiker /, '') }}</option>
                </select></label>
              <p v-if="crm.eigenaarsregel.onbekend?.length" class="meta mt-8" data-test="crm-onbekend">Niet gevonden: {{ crm.eigenaarsregel.onbekend.join(', ') }}</p>
              <label class="veld mt-16"><span class="veld-label">Slapende klant na</span>
                <select :value="crm.slapendMaanden" class="invoer" :disabled="!magInrichten" @change="bewaar({ slapendMaanden: Number(($event.target as HTMLSelectElement).value) }, 'slapend', true)"><option :value="3">3 maanden zonder order</option><option :value="6">6 maanden zonder order</option><option :value="12">12 maanden zonder order</option></select></label>
              <p class="meta">Wijs het veld "Laatste order" toe in de veldtoewijzing van bedrijven; zonder dat veld herkent Dealtrace geen slapende klanten.</p>
            </article>

            <article class="kaart mt-16">
              <header class="kaart-kop"><h2 class="kaart-titel">Conflictregel</h2></header>
              <p class="tekst">Een bron met een lagere plek overschrijft nooit stil een hogere. Wat Dealtrace houdt, staat in het log.</p>
              <ol class="crm-volgorde mt-8"><li v-for="b in BRONNEN" :key="b">{{ BRON_NAAM[b] }}</li></ol>
              <p class="meta mt-8">Voorbeeld: een telefoonnummer dat je zelf invulde, blijft staan, ook als het CRM een ander nummer heeft.</p>
            </article>

            <article class="kaart mt-16" data-test="crm-log">
              <header class="kaart-kop"><h2 class="kaart-titel">Synchronisatielog</h2><label class="schakel-inline"><input v-model="alleenFouten" type="checkbox"> Alleen met fouten</label></header>
              <p v-if="!runs.length" class="meta">Nog geen runs.</p>
              <ul class="schakel-lijst">
                <li v-for="r in runs" :key="r.id" class="schakel-rij crm-run">
                  <button type="button" class="crm-run-kop" :aria-expanded="openRun === r.id" @click="openRun = openRun === r.id ? null : r.id">
                    <span>{{ datum(r.start) }} · {{ r.handeling === 'uur' ? 'elk uur' : r.handeling === 'overdragen' ? 'overdracht' : 'op verzoek' }}</span>
                    <span class="meta">Gelezen {{ r.gelezen }}, geschreven {{ r.geschreven }}, fouten {{ r.fouten.filter((f: any) => f.soort !== 'verschil').length }}<template v-if="r.fouten.some((f: any) => f.soort === 'verschil')">, verschillen {{ r.fouten.filter((f: any) => f.soort === 'verschil').length }}</template></span>
                  </button>
                  <ul v-if="openRun === r.id && r.fouten.length" class="meta crm-run-fouten"><li v-for="(f, i) in r.fouten" :key="i">{{ f.record ? `${f.record}: ` : '' }}{{ f.melding }}</li></ul>
                </li>
              </ul>
            </article>
          </template>
        </div>
      </section>
      <BevestigVenster :open="ontkoppelVraag" titel="HubSpot ontkoppelen?" tekst="Dealtrace leest en schrijft dan niets meer. Wat al gelezen is, blijft voor ontdubbelen." bevestig="Ontkoppel" gevaar @bevestigd="ontkoppel" @geannuleerd="ontkoppelVraag = false" />
    </template>
  </div>
</template>

<style scoped>
.crm-rij { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--border); }
.crm-rij-naam { min-width: 160px; }
.crm-volgorde { margin: 0; padding-left: 20px; display: flex; flex-wrap: wrap; gap: 4px 24px; }
.crm-run { display: block; }
.crm-run-kop { all: unset; cursor: pointer; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; width: 100%; min-height: 44px; align-items: center; }
.crm-run-fouten { margin: 4px 0 8px; padding-left: 16px; }
.tabel-scroll { overflow-x: auto; }
</style>
