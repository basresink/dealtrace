<script setup lang="ts">
// Instellingen, Verkoopverhaal (F25, P28): de acht onderdelen als concept, automatisch bewaren per
// veld na 600 ms, Bevestig (nieuwe versie), Klopt nog, Kopieer uit startset (beheerder), mappings
// (beheerder) en voorstellen van experts. Alleen bevestigde inhoud gaat naar buiten.
import { PLEK_IN_SALESDNA } from '~~/shared/salesdna'
import { CONCURRENT_SOORTEN, MAX_HOOG_IMPACT, ONDERDEEL_LABEL, ONDERDELEN, TERMIJNEN, kernzin, ontbrekendeVelden, teveelHoog, type Onderdeel } from '~~/shared/verkoopverhaal'
const { functie } = useMe()
if (!functie('verkoopverhaal.inrichten')?.beschikbaar) throw createError({ statusCode: 403, statusMessage: 'Alleen salesmanager en beheerder richten het verkoopverhaal in' })
const toast = useToast()
const { data, refresh } = await useFetch<any>('/api/instellingen/verkoopverhaal', { default: () => ({ onderdelen: {}, aanvullingen: { brancheMapping: [], redenmapping: [], ambitiedoelen: [] }, voorstellen: [], kan: {} }) })
const { data: richting } = await useFetch<any>('/api/richting', { default: () => ({ ritmes: [] }) })
const open = ref<Onderdeel>('golden_circle')
const status = ref<Record<string, string>>({})
const timers: Record<string, any> = {}
const c = (o: Onderdeel) => data.value.onderdelen[o]?.concept ?? {}
const leeg = computed(() => ONDERDELEN.every((o) => !data.value.onderdelen[o]?.versie && !Object.values(data.value.onderdelen[o]?.concept ?? {}).some((v: any) => (Array.isArray(v) ? v.length : v && (typeof v !== 'object' || Object.keys(v).length)))))

function bewaar(o: Onderdeel) {
  if (gespiegeld(o)) return
  status.value[o] = 'Opslaan…'
  clearTimeout(timers[o])
  timers[o] = setTimeout(async () => {
    try { await $fetch(`/api/instellingen/verkoopverhaal/${o}`, { method: 'PUT', body: c(o) }); status.value[o] = 'Opgeslagen' } catch (e) { status.value[o] = 'Opslaan mislukt'; toast.toon(foutTekst(e), 'fout') }
  }, 600)
}
async function bevestig(o: Onderdeel) {
  clearTimeout(timers[o])
  try {
    await $fetch(`/api/instellingen/verkoopverhaal/${o}`, { method: 'PUT', body: c(o) })
    const r: any = await $fetch(`/api/instellingen/verkoopverhaal/${o}/bevestig`, { method: 'POST' })
    toast.toon(`${ONDERDEEL_LABEL[o]} bevestigd · versie ${r?.versie ?? ''}`.trim())
    await refresh()
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function kloptNog(o: Onderdeel) {
  try { await $fetch(`/api/instellingen/verkoopverhaal/${o}/klopt-nog`, { method: 'POST' }); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const startsetVraag = ref(false)
async function kopieerStartset() {
  try { await $fetch('/api/instellingen/verkoopverhaal/startset', { method: 'POST' }); startsetVraag.value = false; toast.toon('Startset gekopieerd als concept.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const id = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
function voegToe(o: 'branches' | 'concurrenten' | 'winpunten' | 'terugkomregels') {
  const x = c(o)
  x.items ??= []
  if (o === 'branches') x.items.push({ id: id('br'), naam: '', focus: 'primair', horizon: 'huidig', actief: true })
  if (o === 'concurrenten') x.items.push({ id: id('cc'), naam: '', soort: 'direct', actief: true })
  if (o === 'winpunten') x.items.push({ id: id('wp'), faseId: x.fasen?.[0]?.id ?? null, titel: '', omschrijving: '', waarom: '', impact: 'midden', concurrentIds: [], actief: true })
  if (o === 'terugkomregels') x.items.push({ id: id('tr'), lijst: 'verloren', reden: '', termijn: '91 dagen', termijnDagen: 91, kanaal: 'bellen', aanpak: '', rollen: [] })
  bewaar(o)
}
function verwijder(o: Onderdeel, i: number) { c(o).items.splice(i, 1); bewaar(o) }
function zetTermijn(r: any, d: number) { r.termijnDagen = d; r.termijn = d === 0 ? 'direct' : `${d} dagen`; bewaar('terugkomregels') }
const branches = computed(() => (c('branches').items ?? []).filter((b: any) => b.naam))
function perBranche(o: 'waarde', b: string) {
  const x = c(o)
  x.perBranche ??= {}
  return (x.perBranche[b] ??= {})
}
function zetBrancheVerhaal(b: string, w: string) { const x = c('bedrijfsverhaal'); x.perBranche ??= {}; x.perBranche[b] = w; bewaar('bedrijfsverhaal') }
const mist = (o: Onderdeel) => ontbrekendeVelden(o, c(o))
const gespiegeld = (o: Onderdeel) => data.value.onderdelen[o]?.bron === 'salesdna'
const statusTekst = (s: any) => (s?.status === 'bevestigd' ? `Bevestigd · versie ${s.versie}` : s?.versie ? `Concept · laatst bevestigd versie ${s.versie}` : 'Concept')

// Mappings (beheerder)
const mapStatus = ref('')
let mapTimer: any
function bewaarMappings() {
  mapStatus.value = 'Opslaan…'
  clearTimeout(mapTimer)
  mapTimer = setTimeout(async () => {
    try { await $fetch('/api/instellingen/verkoopverhaal/mappings', { method: 'PUT', body: data.value.aanvullingen }); mapStatus.value = 'Opgeslagen' } catch (e) { mapStatus.value = 'Opslaan mislukt'; toast.toon(foutTekst(e), 'fout') }
  }, 600)
}
function mappingVan(brancheId: string) {
  const l = data.value.aanvullingen.brancheMapping
  let m = l.find((x: any) => x.brancheId === brancheId)
  if (!m) { m = { brancheId, sbiCodes: [], trefwoorden: [] }; l.push(m) }
  return m
}
const lijstTekst = (v: string[] | undefined) => (v ?? []).join(', ')
const naarLijst = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean)
async function beoordeel(v: any, s: 'overgenomen' | 'afgewezen') {
  try { await $fetch(`/api/instellingen/verkoopverhaal/voorstellen/${v.id}`, { method: 'POST', body: { status: s } }); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
useHead({ title: 'Verkoopverhaal · Instellingen · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Instellingen · Verkoop" titel="Verkoopverhaal" uitleg="Waar elk script, elke boodschap en elke briefing uit leest. Alleen bevestigde inhoud gaat naar buiten." helpartikel="ons-verhaal">
      <template #acties><NuxtLink to="/richting" class="dd-act">Bekijk Richting</NuxtLink></template>
    </PaginaKop>
    <section class="section section--laatste">
      <div class="container">
        <p class="alleen-groot-melding kaart kaart--geel">Beter op een groot scherm.</p>
        <article v-if="leeg" class="kaart kaart--geel" data-test="vv-leeg">
          <h2 class="kaart-titel">Jullie verkoopverhaal is nog niet vastgelegd</h2>
          <p class="kaart-meta">Vul de onderdelen hieronder zelf in, of begin met de startset van Voltvast en pas die aan.</p>
          <button v-if="data.kan.startset" type="button" class="dd-act dd-act--primair mt-8" data-test="kopieer-startset" @click="startsetVraag = true">Kopieer uit startset</button>
        </article>
        <div v-if="startsetVraag" class="kaart mt-8" role="alertdialog" data-test="startset-vraag">
          <p>Startset Voltvast kopiëren? Dit vult alle acht onderdelen als concept. Je past ze daarna aan op jullie eigen verhaal.</p>
          <div class="mt-8"><button type="button" class="dd-act dd-act--primair" data-test="startset-ja" @click="kopieerStartset">Kopiëren</button> <button type="button" class="dd-act" @click="startsetVraag = false">Annuleren</button></div>
        </div>

        <nav class="tabbalk tabbalk--schuif mt-16" aria-label="Onderdelen">
          <button v-for="o in ONDERDELEN" :key="o" type="button" class="tab" :class="{ 'tab--actief': open === o }" :aria-current="open === o ? 'page' : undefined" :data-test="`vv-tab-${o}`" @click="open = o">
            {{ ONDERDEEL_LABEL[o] }}<span v-if="data.onderdelen[o]?.controleren" class="tab-teller">!</span>
          </button>
        </nav>

        <template v-for="o in ONDERDELEN" :key="o">
          <article v-if="open === o && data.onderdelen[o]" class="kaart mt-16 vv-onderdeel" :data-test="`vv-${o}`">
            <header class="rij-tussen">
              <div>
                <h2 class="kaart-titel">{{ ONDERDEEL_LABEL[o] }}</h2>
                <p class="kaart-meta"><span class="pil" data-test="vv-status">{{ statusTekst(data.onderdelen[o]) }}</span> · {{ gespiegeld(o) ? 'Uit SalesDNA' : 'Eigen inrichting' }}
                  <span v-if="data.onderdelen[o].verouderd && gespiegeld(o)" class="pil pil--oranje">Mogelijk verouderd in SalesDNA</span>
                  <span v-if="data.onderdelen[o].controleren" class="pil pil--geel" data-test="vv-controleren">Controleren</span>
                  <span v-if="status[o]" class="meta" role="status"> · {{ status[o] }}</span></p>
              </div>
              <div>
                <template v-if="!gespiegeld(o)">
                  <button v-if="data.onderdelen[o].controleren" type="button" class="dd-act" data-test="vv-klopt-nog" @click="kloptNog(o)">Klopt nog</button>
                  <button type="button" class="dd-act dd-act--primair" :disabled="mist(o).length > 0" data-test="vv-bevestig" @click="bevestig(o)">Bevestig</button>
                </template>
              </div>
            </header>
            <p v-if="gespiegeld(o)" class="kaart kaart--geel mt-8" data-test="vv-gespiegeld">Wijzigen doe je in SalesDNA, {{ PLEK_IN_SALESDNA[o] }}. De eigen aanvullingen hieronder blijven bewerkbaar.</p>
            <p v-else-if="mist(o).length" class="meta mt-8" data-test="vv-mist">Nog nodig om te bevestigen: {{ mist(o).join(', ') }}</p>
            <fieldset :disabled="gespiegeld(o)" class="vv-fieldset">

            <div v-if="o === 'golden_circle'" class="mt-8">
              <label v-for="[k, l] in [['waarom', 'Waarom'], ['hoe', 'Hoe'], ['wat', 'Wat']]" :key="k" class="veld"><span class="veld-label">{{ l }}<span v-if="k !== 'wat'" class="veld-verplicht"> *</span></span>
                <textarea v-model="c(o)[k]" class="invoer" :data-test="`vv-gc-${k}`" @input="bewaar(o)" /></label>
            </div>

            <div v-else-if="o === 'bedrijfsverhaal'" class="mt-8">
              <label class="veld"><span class="veld-label">Wie zijn wij <span class="veld-verplicht">*</span></span>
                <textarea v-model="c(o).wieZijnWij" class="invoer" data-test="vv-wie" @input="bewaar(o)" /></label>
              <label class="veld"><span class="veld-label">Kernzin (afgeleid, te overschrijven)</span>
                <input v-model="c(o).kernzin" class="invoer" :placeholder="kernzin(c(o).wieZijnWij)" data-test="vv-kernzin" @input="bewaar(o)"></label>
              <h3 class="kaart-titel mt-16">Per branche</h3>
              <p v-if="!branches.length" class="meta">Leg eerst branches vast.</p>
              <label v-for="b in branches" :key="b.id" class="veld"><span class="veld-label">{{ b.naam }}</span>
                <textarea :value="c(o).perBranche?.[b.id] ?? ''" class="invoer" placeholder="Leeg: het algemene verhaal" @input="zetBrancheVerhaal(b.id, ($event.target as HTMLTextAreaElement).value)" /></label>
            </div>

            <div v-else-if="o === 'ambitie'" class="mt-8">
              <label v-for="[k, l] in [['ambitie', 'Ambitie'], ['visie', 'Visie'], ['missie', 'Missie']]" :key="k" class="veld"><span class="veld-label">{{ l }}<span v-if="k === 'visie'" class="veld-verplicht"> *</span></span>
                <textarea v-model="c(o)[k]" class="invoer" :data-test="`vv-amb-${k}`" @input="bewaar(o)" /></label>
            </div>

            <div v-else-if="o === 'waarde'" class="mt-8">
              <label class="veld"><span class="veld-label">Kernbelofte <span class="veld-verplicht">*</span></span><textarea v-model="c(o).kernbelofte" class="invoer" data-test="vv-kernbelofte" @input="bewaar(o)" /></label>
              <label class="veld"><span class="veld-label">Waardestatement <span class="veld-verplicht">*</span></span><textarea v-model="c(o).waardestatement" class="invoer" data-test="vv-waardestatement" @input="bewaar(o)" /></label>
              <h3 class="kaart-titel mt-16">Per branche</h3>
              <div v-for="b in branches" :key="b.id" class="vv-regel">
                <strong>{{ b.naam }}</strong>
                <label class="veld"><span class="veld-label">Kernbelofte</span><textarea v-model="perBranche('waarde', b.id).kernbelofte" class="invoer" placeholder="Leeg: de algemene belofte" @input="bewaar(o)" /></label>
                <label class="veld"><span class="veld-label">Waardestatement</span><textarea v-model="perBranche('waarde', b.id).waardestatement" class="invoer" @input="bewaar(o)" /></label>
              </div>
            </div>

            <div v-else-if="o === 'branches'" class="mt-8">
              <div v-for="(b, i) in c(o).items" :key="b.id" class="vv-regel" data-test="vv-branche">
                <div class="vv-velden">
                  <label class="veld"><span class="veld-label">Naam *</span><input v-model="b.naam" class="invoer" @input="bewaar(o)"></label>
                  <label class="veld"><span class="veld-label">Focus *</span><select v-model="b.focus" class="invoer" @change="bewaar(o)"><option value="primair">Primair</option><option value="secundair">Secundair</option></select></label>
                  <label class="veld"><span class="veld-label">Horizon</span><select v-model="b.horizon" class="invoer" @change="bewaar(o)"><option value="huidig">Huidig</option><option value="toekomstig">Toekomstig</option></select></label>
                  <label class="veld"><span class="veld-label">Termijn</span><input v-model="b.termijn" class="invoer" @input="bewaar(o)"></label>
                  <label class="veld"><span class="veld-label">Prioriteit</span><input v-model="b.prioriteit" class="invoer" @input="bewaar(o)"></label>
                </div>
                <button type="button" class="dd-act" @click="verwijder(o, Number(i))">Verwijder</button>
              </div>
              <button type="button" class="dd-act mt-8" data-test="vv-nieuw" @click="voegToe('branches')">Branche toevoegen</button>
            </div>

            <div v-else-if="o === 'concurrenten'" class="mt-8">
              <div v-for="(x, i) in c(o).items" :key="x.id" class="vv-regel" data-test="vv-concurrent">
                <div class="vv-velden">
                  <label class="veld"><span class="veld-label">Naam *</span><input v-model="x.naam" class="invoer" @input="bewaar(o)"></label>
                  <label class="veld"><span class="veld-label">Soort *</span><select v-model="x.soort" class="invoer" @change="bewaar(o)"><option v-for="(l, k) in CONCURRENT_SOORTEN" :key="k" :value="k">{{ l }}</option></select></label>
                </div>
                <label v-for="[k, l] in [['sterk', 'Sterk'], ['zwak', 'Zwak'], ['onderscheid', 'Onderscheid *'], ['zoZegJeHet', 'Zo zeg je het *'], ['alsDeKlantZegt', 'Als de klant zegt *'], ['antwoord', 'Antwoord'], ['bewijs', 'Bewijs'], ['wanneerVerliezen', 'Wanneer we verliezen']]" :key="k" class="veld"><span class="veld-label">{{ l }}</span>
                  <textarea v-model="x[k]" class="invoer" @input="bewaar(o)" /></label>
                <button type="button" class="dd-act" @click="verwijder(o, Number(i))">Verwijder</button>
              </div>
              <button type="button" class="dd-act mt-8" data-test="vv-nieuw" @click="voegToe('concurrenten')">Concurrent toevoegen</button>
            </div>

            <div v-else-if="o === 'winpunten'" class="mt-8">
              <p class="meta">Dealtrace schrijft nooit zelf een winpunt. Hooguit {{ MAX_HOOG_IMPACT }} op impact hoog.</p>
              <p v-if="teveelHoog(c(o))" class="kaart kaart--geel" data-test="vv-teveel-hoog">Meer dan {{ MAX_HOOG_IMPACT }} winpunten op impact hoog. Kies welke echt het verschil maken.</p>
              <div v-for="(w, i) in c(o).items" :key="w.id" class="vv-regel" data-test="vv-winpunt">
                <div class="vv-velden">
                  <label class="veld"><span class="veld-label">Titel *</span><input v-model="w.titel" class="invoer" @input="bewaar(o)"></label>
                  <label class="veld"><span class="veld-label">Fase *</span><select v-model="w.faseId" class="invoer" @change="bewaar(o)"><option v-for="f in c(o).fasen" :key="f.id" :value="f.id">{{ f.naam }}</option></select></label>
                  <label class="veld"><span class="veld-label">Impact</span><select v-model="w.impact" class="invoer" @change="bewaar(o)"><option value="hoog">Hoog</option><option value="midden">Midden</option><option value="laag">Laag</option></select></label>
                </div>
                <label class="veld"><span class="veld-label">Omschrijving *</span><textarea v-model="w.omschrijving" class="invoer" @input="bewaar(o)" /></label>
                <label class="veld"><span class="veld-label">Waarom wij hier winnen *</span><textarea v-model="w.waarom" class="invoer" @input="bewaar(o)" /></label>
                <button type="button" class="dd-act" @click="verwijder(o, Number(i))">Verwijder</button>
              </div>
              <p v-if="!c(o).fasen?.length" class="meta mt-8">Er zijn nog geen fasen. Kopieer de startset of vraag de beheerder.</p>
              <button type="button" class="dd-act mt-8" data-test="vv-nieuw" @click="voegToe('winpunten')">Winpunt toevoegen</button>
            </div>

            <div v-else-if="o === 'terugkomregels'" class="mt-8">
              <div v-for="(r, i) in c(o).items" :key="r.id" class="vv-regel" data-test="vv-regel">
                <div class="vv-velden">
                  <label class="veld"><span class="veld-label">Lijst</span><select v-model="r.lijst" class="invoer" @change="bewaar(o)"><option value="verloren">Verloren</option><option value="slapend">Slapend</option></select></label>
                  <label class="veld"><span class="veld-label">Reden *</span><input v-model="r.reden" class="invoer" @input="bewaar(o)"></label>
                  <label class="veld"><span class="veld-label">Termijn *</span><select :value="r.termijnDagen" class="invoer" @change="zetTermijn(r, Number(($event.target as HTMLSelectElement).value))">
                    <option v-for="t in [...new Set([...TERMIJNEN, r.termijnDagen])]" :key="t" :value="t">{{ t === 0 ? 'Direct' : `${t} dagen` }}</option></select></label>
                  <label class="veld"><span class="veld-label">Kanaal *</span><input v-model="r.kanaal" class="invoer" @input="bewaar(o)"></label>
                  <label class="veld"><span class="veld-label">Hercontactritme</span><select v-model="r.hercontactritmeId" class="invoer" @change="bewaar(o)"><option :value="null">Nog geen ritme gekoppeld</option><option v-for="h in richting.ritmes" :key="h.id" :value="h.id">{{ h.naam }}</option></select></label>
                </div>
                <label class="veld"><span class="veld-label">Aanpak *</span><textarea v-model="r.aanpak" class="invoer" @input="bewaar(o)" /></label>
                <button type="button" class="dd-act" @click="verwijder(o, Number(i))">Verwijder</button>
              </div>
              <button type="button" class="dd-act mt-8" data-test="vv-nieuw" @click="voegToe('terugkomregels')">Regel toevoegen</button>
            </div>
            </fieldset>
          </article>
        </template>

        <span class="kicker kicker--streep mt-24">Eigen aanvullingen</span>
        <article class="kaart mt-8" data-test="vv-aanvullingen">
          <p class="kaart-meta">Altijd bewerkbaar. <span v-if="mapStatus" role="status">{{ mapStatus }}</span></p>
          <h3 class="kaart-titel mt-8">Ambitiedoelen</h3>
          <div v-for="d in data.aanvullingen.ambitiedoelen" :key="d.id" class="vv-velden mt-8">
            <label class="veld"><span class="veld-label">Doel</span><input v-model="d.naam" class="invoer" :disabled="!data.kan.mappings" @input="bewaarMappings"></label>
            <label class="veld"><span class="veld-label">Stand</span><input v-model.number="d.stand" type="number" class="invoer" :disabled="!data.kan.mappings" @input="bewaarMappings"></label>
            <label class="veld"><span class="veld-label">Van</span><input v-model.number="d.doel" type="number" class="invoer" :disabled="!data.kan.mappings" @input="bewaarMappings"></label>
            <label class="veld"><span class="veld-label">Jaar</span><input v-model.number="d.jaar" type="number" class="invoer" :disabled="!data.kan.mappings" @input="bewaarMappings"></label>
          </div>
          <template v-if="data.kan.mappings">
            <h3 class="kaart-titel mt-16">Branche naar SBI en trefwoorden</h3>
            <div v-for="b in branches" :key="b.id" class="vv-velden mt-8" data-test="vv-mapping">
              <strong>{{ b.naam }}</strong>
              <label class="veld"><span class="veld-label">SBI-codes</span><input :value="lijstTekst(mappingVan(b.id).sbiCodes)" class="invoer" placeholder="4322, 4321" @change="mappingVan(b.id).sbiCodes = naarLijst(($event.target as HTMLInputElement).value); bewaarMappings()"></label>
              <label class="veld"><span class="veld-label">Trefwoorden</span><input :value="lijstTekst(mappingVan(b.id).trefwoorden)" class="invoer" @change="mappingVan(b.id).trefwoorden = naarLijst(($event.target as HTMLInputElement).value); bewaarMappings()"></label>
            </div>
            <h3 class="kaart-titel mt-16">Reden naar terugkomregel</h3>
            <div v-for="m in data.aanvullingen.redenmapping" :key="`${m.bronSoort}-${m.reden}`" class="vv-velden mt-8">
              <span>{{ m.reden }} <span class="meta">({{ m.bronSoort }})</span></span>
              <select v-model="m.terugkomregelId" class="invoer" @change="bewaarMappings"><option :value="null">Geen</option><option v-for="r in c('terugkomregels').items" :key="r.id" :value="r.id">{{ r.reden }}</option></select>
            </div>
          </template>
        </article>

        <span class="kicker kicker--streep mt-24">Voorstellen</span>
        <article class="kaart mt-8" data-test="vv-voorstellen">
          <p v-if="!data.voorstellen.length" class="meta">Geen open voorstellen.</p>
          <div v-for="v in data.voorstellen" :key="v.id" class="vv-regel" data-test="vv-voorstel">
            <p><strong>{{ ONDERDEEL_LABEL[v.onderdeel as Onderdeel] ?? v.onderdeel }}</strong> · {{ v.soort }}</p>
            <p>{{ v.tekst }}</p>
            <div><button type="button" class="dd-act" @click="beoordeel(v, 'overgenomen')">Overgenomen</button> <button type="button" class="dd-act" @click="beoordeel(v, 'afgewezen')">Afwijzen</button></div>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>
