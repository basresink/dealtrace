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
const ITEM_LABEL = { branches: 'Branche', concurrenten: 'Concurrent', winpunten: 'Winpunt', terugkomregels: 'Regel' } as const
const itemTitel = (o: keyof typeof ITEM_LABEL, x: any, i: number) => (o === 'branches' || o === 'concurrenten' ? x.naam : o === 'winpunten' ? x.titel : x.reden)?.trim() || `${ITEM_LABEL[o]} ${i + 1}`
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
useHead({ title: 'SalesDNA · Instellingen · Dealtrace' })
</script>

<template>
  <div>
    <InstellingenKop groep="Verkoop" titel="SalesDNA" uitleg="Waar elk script, elke boodschap en elke briefing uit leest. Alleen bevestigde inhoud gaat naar buiten." helpartikel="ons-verhaal">
      <template #acties><FunctieLink to="/richting" class="dd-actie dd-actie--secundair"><Icoon naam="Compass" class="dd-actie-icoon" />Bekijk Richting</FunctieLink></template>
    </InstellingenKop>
    <section class="section section--laatste">
      <div class="container vv-pagina">
        <p class="alleen-groot-melding kaart kaart--geel">Beter op een groot scherm.</p>
        <article v-if="leeg" class="kaart vv-leeg" data-test="vv-leeg">
          <LegeStaat kicker="SalesDNA" titel="Jullie verkoopverhaal is nog niet vastgelegd" tekst="Vul de onderdelen hieronder zelf in, of begin met de startset van Voltvast en pas die aan.">
            <button v-if="data.kan.startset && !startsetVraag" type="button" class="dd-actie dd-actie--primair mt-16" data-test="kopieer-startset" @click="startsetVraag = true"><Icoon naam="Copy" class="dd-actie-icoon" />Kopieer uit startset</button>
          </LegeStaat>
        </article>
        <div v-if="startsetVraag" class="kaart vv-vraag" role="alertdialog" aria-labelledby="vv-startset-titel" data-test="startset-vraag">
          <h2 id="vv-startset-titel" class="kaart-titel">Startset Voltvast kopiëren?</h2>
          <p class="kaart-meta">Dit vult alle acht onderdelen als concept. Je past ze daarna aan op jullie eigen verhaal.</p>
          <div class="vv-knoppen">
            <button type="button" class="dd-actie dd-actie--primair" data-test="startset-ja" @click="kopieerStartset"><Icoon naam="Copy" class="dd-actie-icoon" />Kopiëren</button>
            <button type="button" class="dd-actie dd-actie--secundair" @click="startsetVraag = false">Annuleren</button>
          </div>
        </div>

        <nav class="tabbalk tabbalk--schuif" aria-label="Onderdelen">
          <button v-for="o in ONDERDELEN" :key="o" type="button" class="tab" :class="{ 'tab--actief': open === o }" :aria-current="open === o ? 'page' : undefined" :data-test="`vv-tab-${o}`" @click="open = o">
            {{ ONDERDEEL_LABEL[o] }}<span v-if="data.onderdelen[o]?.controleren" class="tab-teller">!</span>
          </button>
        </nav>

        <template v-for="o in ONDERDELEN" :key="o">
          <article v-if="open === o && data.onderdelen[o]" class="kaart vv-onderdeel" :data-test="`vv-${o}`">
            <header class="vv-kop">
              <div class="vv-kop-tekst">
                <h2 class="vv-titel">{{ ONDERDEEL_LABEL[o] }}</h2>
                <p class="vv-meta">
                  <span class="pil" :class="data.onderdelen[o].status === 'bevestigd' ? 'pil--groen' : 'pil--leeg'" data-test="vv-status">{{ statusTekst(data.onderdelen[o]) }}</span>
                  <span v-if="gespiegeld(o)" class="pil pil--blauw">Uit SalesDNA</span>
                  <span v-if="data.onderdelen[o].verouderd && gespiegeld(o)" class="pil pil--oranje">Mogelijk verouderd in SalesDNA</span>
                  <span v-if="data.onderdelen[o].controleren" class="pil pil--geel" data-test="vv-controleren">Controleren</span>
                  <span v-if="status[o]" class="meta" role="status">{{ status[o] }}</span>
                </p>
              </div>
              <div v-if="!gespiegeld(o)" class="vv-knoppen">
                <button v-if="data.onderdelen[o].controleren" type="button" class="dd-actie dd-actie--secundair" data-test="vv-klopt-nog" @click="kloptNog(o)">Klopt nog</button>
                <button type="button" class="dd-actie dd-actie--primair" :disabled="mist(o).length > 0" :title="mist(o).length ? `Nog nodig: ${mist(o).join(', ')}` : undefined" data-test="vv-bevestig" @click="bevestig(o)"><Icoon naam="Check" class="dd-actie-icoon" />Bevestig</button>
              </div>
            </header>
            <p v-if="gespiegeld(o)" class="vv-melding vv-melding--geel" data-test="vv-gespiegeld">Wijzigen doe je in SalesDNA, {{ PLEK_IN_SALESDNA[o] }}. De eigen aanvullingen hieronder blijven bewerkbaar.</p>
            <p v-else-if="mist(o).length" class="vv-melding" data-test="vv-mist">Nog nodig om te bevestigen: {{ mist(o).join(', ') }}</p>
            <fieldset :disabled="gespiegeld(o)" class="vv-fieldset">

            <div v-if="o === 'golden_circle'" class="vv-form">
              <label v-for="[k, l] in [['waarom', 'Waarom'], ['hoe', 'Hoe'], ['wat', 'Wat']]" :key="k" class="veld"><span class="veld-label">{{ l }}<span v-if="k !== 'wat'" class="veld-verplicht"> *</span></span>
                <textarea v-model="c(o)[k]" class="invoer" rows="3" :data-test="`vv-gc-${k}`" @input="bewaar(o)" /></label>
            </div>

            <div v-else-if="o === 'bedrijfsverhaal'" class="vv-form">
              <label class="veld"><span class="veld-label">Wie zijn wij <span class="veld-verplicht">*</span></span>
                <textarea v-model="c(o).wieZijnWij" class="invoer" rows="5" data-test="vv-wie" @input="bewaar(o)" /></label>
              <label class="veld"><span class="veld-label">Kernzin</span><span class="veld-uitleg">Afgeleid uit de eerste zin; je mag hem overschrijven.</span>
                <input v-model="c(o).kernzin" class="invoer" :placeholder="kernzin(c(o).wieZijnWij)" data-test="vv-kernzin" @input="bewaar(o)"></label>
              <section class="vv-sectie" aria-labelledby="vv-bv-branche">
                <h3 id="vv-bv-branche" class="vv-subtitel">Per branche</h3>
                <p v-if="!branches.length" class="vv-leeg-mini">Leg eerst branches vast. Daarna schrijf je hier per branche een eigen verhaal.</p>
                <div v-else class="vv-form">
                  <label v-for="b in branches" :key="b.id" class="veld"><span class="veld-label">{{ b.naam }}</span>
                    <textarea :value="c(o).perBranche?.[b.id] ?? ''" class="invoer" rows="3" placeholder="Leeg: het algemene verhaal" @input="zetBrancheVerhaal(b.id, ($event.target as HTMLTextAreaElement).value)" /></label>
                </div>
              </section>
            </div>

            <div v-else-if="o === 'ambitie'" class="vv-form">
              <label v-for="[k, l] in [['ambitie', 'Ambitie'], ['visie', 'Visie'], ['missie', 'Missie']]" :key="k" class="veld"><span class="veld-label">{{ l }}<span v-if="k === 'visie'" class="veld-verplicht"> *</span></span>
                <textarea v-model="c(o)[k]" class="invoer" rows="3" :data-test="`vv-amb-${k}`" @input="bewaar(o)" /></label>
            </div>

            <div v-else-if="o === 'waarde'" class="vv-form">
              <label class="veld"><span class="veld-label">Kernbelofte <span class="veld-verplicht">*</span></span><textarea v-model="c(o).kernbelofte" class="invoer" rows="2" data-test="vv-kernbelofte" @input="bewaar(o)" /></label>
              <label class="veld"><span class="veld-label">Waardestatement <span class="veld-verplicht">*</span></span><textarea v-model="c(o).waardestatement" class="invoer" rows="4" data-test="vv-waardestatement" @input="bewaar(o)" /></label>
              <section class="vv-sectie" aria-labelledby="vv-w-branche">
                <h3 id="vv-w-branche" class="vv-subtitel">Per branche</h3>
                <p v-if="!branches.length" class="vv-leeg-mini">Leg eerst branches vast. Daarna geef je hier per branche een eigen belofte.</p>
                <div v-for="b in branches" :key="b.id" class="vv-item">
                  <h4 class="vv-item-titel">{{ b.naam }}</h4>
                  <div class="vv-raster">
                    <label class="veld"><span class="veld-label">Kernbelofte</span><textarea v-model="perBranche('waarde', b.id).kernbelofte" class="invoer" rows="2" placeholder="Leeg: de algemene belofte" @input="bewaar(o)" /></label>
                    <label class="veld"><span class="veld-label">Waardestatement</span><textarea v-model="perBranche('waarde', b.id).waardestatement" class="invoer" rows="2" @input="bewaar(o)" /></label>
                  </div>
                </div>
              </section>
            </div>

            <div v-else-if="o === 'branches'" class="vv-lijst">
              <LegeStaat v-if="!c(o).items?.length" titel="Nog geen branches." tekst="Voeg de branches toe waarin jullie verkopen. De leadgenerator en de accountkaart gebruiken ze." />
              <div v-for="(b, i) in c(o).items" :key="b.id" class="vv-item" data-test="vv-branche">
                <div class="vv-item-kop"><h3 class="vv-item-titel">{{ itemTitel(o, b, Number(i)) }}</h3>
                  <button type="button" class="dd-actie dd-actie--gevaar dd-actie--klein" @click="verwijder(o, Number(i))"><Icoon naam="Trash2" :grootte="14" />Verwijder</button></div>
                <div class="vv-raster vv-raster--5">
                  <label class="veld"><span class="veld-label">Naam <span class="veld-verplicht">*</span></span><input v-model="b.naam" class="invoer" @input="bewaar(o)"></label>
                  <label class="veld"><span class="veld-label">Focus <span class="veld-verplicht">*</span></span><select v-model="b.focus" class="invoer" @change="bewaar(o)"><option value="primair">Primair</option><option value="secundair">Secundair</option></select></label>
                  <label class="veld"><span class="veld-label">Horizon</span><select v-model="b.horizon" class="invoer" @change="bewaar(o)"><option value="huidig">Huidig</option><option value="toekomstig">Toekomstig</option></select></label>
                  <label class="veld"><span class="veld-label">Termijn</span><input v-model="b.termijn" class="invoer" @input="bewaar(o)"></label>
                  <label class="veld"><span class="veld-label">Prioriteit</span><input v-model="b.prioriteit" class="invoer" @input="bewaar(o)"></label>
                </div>
              </div>
              <button type="button" class="dd-actie dd-actie--secundair vv-nieuw" data-test="vv-nieuw" @click="voegToe('branches')"><Icoon naam="Plus" class="dd-actie-icoon" />Branche toevoegen</button>
            </div>

            <div v-else-if="o === 'concurrenten'" class="vv-lijst">
              <LegeStaat v-if="!c(o).items?.length" titel="Nog geen concurrenten." tekst="Voeg elk alternatief toe waarmee de prospect je vergelijkt, ook niets doen." />
              <div v-for="(x, i) in c(o).items" :key="x.id" class="vv-item" data-test="vv-concurrent">
                <div class="vv-item-kop"><h3 class="vv-item-titel">{{ itemTitel(o, x, Number(i)) }}</h3>
                  <button type="button" class="dd-actie dd-actie--gevaar dd-actie--klein" @click="verwijder(o, Number(i))"><Icoon naam="Trash2" :grootte="14" />Verwijder</button></div>
                <div class="vv-raster">
                  <label class="veld"><span class="veld-label">Naam <span class="veld-verplicht">*</span></span><input v-model="x.naam" class="invoer" @input="bewaar(o)"></label>
                  <label class="veld"><span class="veld-label">Soort <span class="veld-verplicht">*</span></span><select v-model="x.soort" class="invoer" @change="bewaar(o)"><option v-for="(l, k) in CONCURRENT_SOORTEN" :key="k" :value="k">{{ l }}</option></select></label>
                  <label v-for="[k, l, v] in [['sterk', 'Sterk', false], ['zwak', 'Zwak', false], ['onderscheid', 'Onderscheid', true], ['zoZegJeHet', 'Zo zeg je het', true], ['alsDeKlantZegt', 'Als de prospect zegt', true], ['antwoord', 'Antwoord', false], ['bewijs', 'Bewijs', false], ['wanneerVerliezen', 'Wanneer we verliezen', false]]" :key="String(k)" class="veld"><span class="veld-label">{{ l }}<span v-if="v" class="veld-verplicht"> *</span></span>
                    <textarea v-model="x[String(k)]" class="invoer" rows="2" @input="bewaar(o)" /></label>
                </div>
              </div>
              <button type="button" class="dd-actie dd-actie--secundair vv-nieuw" data-test="vv-nieuw" @click="voegToe('concurrenten')"><Icoon naam="Plus" class="dd-actie-icoon" />Concurrent toevoegen</button>
            </div>

            <div v-else-if="o === 'winpunten'" class="vv-lijst">
              <p class="vv-melding">Dealtrace schrijft nooit zelf een winpunt. Hooguit {{ MAX_HOOG_IMPACT }} op impact hoog.</p>
              <p v-if="teveelHoog(c(o))" class="vv-melding vv-melding--geel" data-test="vv-teveel-hoog">Meer dan {{ MAX_HOOG_IMPACT }} winpunten op impact hoog. Kies welke echt het verschil maken.</p>
              <LegeStaat v-if="!c(o).items?.length" titel="Nog geen winpunten." :tekst="c(o).fasen?.length ? 'Voeg per fase de reden toe waarom klanten voor jullie kiezen.' : 'Er zijn nog geen fasen. Kopieer de startset of vraag de beheerder.'" />
              <p v-else-if="!c(o).fasen?.length" class="vv-melding">Er zijn nog geen fasen. Kopieer de startset of vraag de beheerder.</p>
              <div v-for="(w, i) in c(o).items" :key="w.id" class="vv-item" data-test="vv-winpunt">
                <div class="vv-item-kop"><h3 class="vv-item-titel">{{ itemTitel(o, w, Number(i)) }}</h3>
                  <button type="button" class="dd-actie dd-actie--gevaar dd-actie--klein" @click="verwijder(o, Number(i))"><Icoon naam="Trash2" :grootte="14" />Verwijder</button></div>
                <div class="vv-raster vv-raster--3">
                  <label class="veld"><span class="veld-label">Titel <span class="veld-verplicht">*</span></span><input v-model="w.titel" class="invoer" @input="bewaar(o)"></label>
                  <label class="veld"><span class="veld-label">Fase <span class="veld-verplicht">*</span></span><select v-model="w.faseId" class="invoer" @change="bewaar(o)"><option v-for="f in c(o).fasen" :key="f.id" :value="f.id">{{ f.naam }}</option></select></label>
                  <label class="veld"><span class="veld-label">Impact</span><select v-model="w.impact" class="invoer" @change="bewaar(o)"><option value="hoog">Hoog</option><option value="midden">Midden</option><option value="laag">Laag</option></select></label>
                </div>
                <div class="vv-raster">
                  <label class="veld"><span class="veld-label">Omschrijving <span class="veld-verplicht">*</span></span><textarea v-model="w.omschrijving" class="invoer" rows="3" @input="bewaar(o)" /></label>
                  <label class="veld"><span class="veld-label">Waarom wij hier winnen <span class="veld-verplicht">*</span></span><textarea v-model="w.waarom" class="invoer" rows="3" @input="bewaar(o)" /></label>
                </div>
              </div>
              <button type="button" class="dd-actie dd-actie--secundair vv-nieuw" data-test="vv-nieuw" @click="voegToe('winpunten')"><Icoon naam="Plus" class="dd-actie-icoon" />Winpunt toevoegen</button>
            </div>

            <div v-else-if="o === 'terugkomregels'" class="vv-lijst">
              <LegeStaat v-if="!c(o).items?.length" titel="Nog geen terugkomregels." tekst="Leg vast wanneer je na een nee of een slapende periode opnieuw contact opneemt." />
              <div v-for="(r, i) in c(o).items" :key="r.id" class="vv-item" data-test="vv-regel">
                <div class="vv-item-kop"><h3 class="vv-item-titel">{{ itemTitel(o, r, Number(i)) }}</h3>
                  <button type="button" class="dd-actie dd-actie--gevaar dd-actie--klein" @click="verwijder(o, Number(i))"><Icoon naam="Trash2" :grootte="14" />Verwijder</button></div>
                <div class="vv-raster vv-raster--5">
                  <label class="veld"><span class="veld-label">Lijst</span><select v-model="r.lijst" class="invoer" @change="bewaar(o)"><option value="verloren">Verloren</option><option value="slapend">Slapend</option></select></label>
                  <label class="veld"><span class="veld-label">Reden <span class="veld-verplicht">*</span></span><input v-model="r.reden" class="invoer" @input="bewaar(o)"></label>
                  <label class="veld"><span class="veld-label">Termijn <span class="veld-verplicht">*</span></span><select :value="r.termijnDagen" class="invoer" @change="zetTermijn(r, Number(($event.target as HTMLSelectElement).value))">
                    <option v-for="t in [...new Set([...TERMIJNEN, r.termijnDagen])]" :key="t" :value="t">{{ t === 0 ? 'Direct' : `${t} dagen` }}</option></select></label>
                  <label class="veld"><span class="veld-label">Kanaal <span class="veld-verplicht">*</span></span><input v-model="r.kanaal" class="invoer" @input="bewaar(o)"></label>
                  <label class="veld"><span class="veld-label">Hercontactritme</span><select v-model="r.hercontactritmeId" class="invoer" @change="bewaar(o)"><option :value="null">Nog geen ritme gekoppeld</option><option v-for="h in richting.ritmes" :key="h.id" :value="h.id">{{ h.naam }}</option></select></label>
                </div>
                <label class="veld"><span class="veld-label">Aanpak <span class="veld-verplicht">*</span></span><textarea v-model="r.aanpak" class="invoer" rows="2" @input="bewaar(o)" /></label>
              </div>
              <button type="button" class="dd-actie dd-actie--secundair vv-nieuw" data-test="vv-nieuw" @click="voegToe('terugkomregels')"><Icoon naam="Plus" class="dd-actie-icoon" />Regel toevoegen</button>
            </div>
            </fieldset>
          </article>
        </template>

        <article class="kaart vv-blok" aria-labelledby="vv-aanv-titel" data-test="vv-aanvullingen">
          <header class="vv-kop">
            <div class="vv-kop-tekst">
              <span class="kicker kicker--streep">Eigen aanvullingen</span>
              <h2 id="vv-aanv-titel" class="vv-titel">Doelen en koppelingen</h2>
              <p class="vv-meta"><span class="meta">Altijd bewerkbaar, ook als het verhaal uit SalesDNA komt.</span><span v-if="mapStatus" class="meta" role="status">{{ mapStatus }}</span></p>
            </div>
          </header>
          <section class="vv-sectie" aria-labelledby="vv-doelen">
            <h3 id="vv-doelen" class="vv-subtitel">Ambitiedoelen</h3>
            <p v-if="!data.aanvullingen.ambitiedoelen.length" class="vv-leeg-mini">Nog geen ambitiedoelen.</p>
            <div v-for="d in data.aanvullingen.ambitiedoelen" :key="d.id" class="vv-raster vv-raster--4 vv-rij">
              <label class="veld"><span class="veld-label">Doel</span><input v-model="d.naam" class="invoer" :disabled="!data.kan.mappings" @input="bewaarMappings"></label>
              <label class="veld"><span class="veld-label">Stand</span><input v-model.number="d.stand" type="number" class="invoer" :disabled="!data.kan.mappings" @input="bewaarMappings"></label>
              <label class="veld"><span class="veld-label">Van</span><input v-model.number="d.doel" type="number" class="invoer" :disabled="!data.kan.mappings" @input="bewaarMappings"></label>
              <label class="veld"><span class="veld-label">Jaar</span><input v-model.number="d.jaar" type="number" class="invoer" :disabled="!data.kan.mappings" @input="bewaarMappings"></label>
            </div>
          </section>
          <template v-if="data.kan.mappings">
            <section class="vv-sectie" aria-labelledby="vv-sbi">
              <h3 id="vv-sbi" class="vv-subtitel">Branche naar SBI en trefwoorden</h3>
              <p v-if="!branches.length" class="vv-leeg-mini">Leg eerst branches vast.</p>
              <div v-for="b in branches" :key="b.id" class="vv-raster vv-raster--map vv-rij" data-test="vv-mapping">
                <strong class="vv-rij-naam">{{ b.naam }}</strong>
                <label class="veld"><span class="veld-label">SBI-codes</span><input :value="lijstTekst(mappingVan(b.id).sbiCodes)" class="invoer" placeholder="4322, 4321" @change="mappingVan(b.id).sbiCodes = naarLijst(($event.target as HTMLInputElement).value); bewaarMappings()"></label>
                <label class="veld"><span class="veld-label">Trefwoorden</span><input :value="lijstTekst(mappingVan(b.id).trefwoorden)" class="invoer" @change="mappingVan(b.id).trefwoorden = naarLijst(($event.target as HTMLInputElement).value); bewaarMappings()"></label>
              </div>
            </section>
            <section class="vv-sectie" aria-labelledby="vv-reden">
              <h3 id="vv-reden" class="vv-subtitel">Reden naar terugkomregel</h3>
              <p v-if="!data.aanvullingen.redenmapping.length" class="vv-leeg-mini">Nog geen redenen om te koppelen.</p>
              <ul v-else class="vv-redenen">
                <li v-for="m in data.aanvullingen.redenmapping" :key="`${m.bronSoort}-${m.reden}`" class="vv-reden">
                  <span class="vv-reden-naam"><strong>{{ m.reden }}</strong> <span class="meta">{{ m.bronSoort }}</span></span>
                  <select v-model="m.terugkomregelId" class="invoer" :aria-label="`Terugkomregel bij ${m.reden}`" @change="bewaarMappings"><option :value="null">Geen</option><option v-for="r in c('terugkomregels').items" :key="r.id" :value="r.id">{{ r.reden }}</option></select>
                </li>
              </ul>
            </section>
          </template>
        </article>

        <article class="kaart vv-blok" aria-labelledby="vv-vs-titel" data-test="vv-voorstellen">
          <header class="vv-kop">
            <div class="vv-kop-tekst">
              <span class="kicker kicker--streep">Voorstellen</span>
              <h2 id="vv-vs-titel" class="vv-titel">Van experts in het team</h2>
            </div>
            <span v-if="data.voorstellen.length" class="meta tnum">{{ data.voorstellen.length }} open</span>
          </header>
          <LegeStaat v-if="!data.voorstellen.length" titel="Geen open voorstellen." tekst="Experts stellen vanaf Richting een betere tekst voor. Die verschijnt hier om te beoordelen." />
          <ul v-else class="vv-voorstellen">
            <li v-for="v in data.voorstellen" :key="v.id">
              <div class="item-rij vv-voorstel" data-test="vv-voorstel">
                <span class="item-icoon" aria-hidden="true"><Icoon naam="MessageSquare" :grootte="16" /></span>
                <div class="item-body">
                  <p class="item-naam">{{ ONDERDEEL_LABEL[v.onderdeel as Onderdeel] ?? v.onderdeel }}</p>
                  <span class="item-meta">{{ v.soort }}</span>
                  <p class="vv-voorstel-tekst">{{ v.tekst }}</p>
                </div>
                <div class="item-acties">
                  <button type="button" class="dd-actie dd-actie--secundair dd-actie--klein" @click="beoordeel(v, 'overgenomen')"><Icoon naam="Check" :grootte="14" />Overgenomen</button>
                  <button type="button" class="dd-actie dd-actie--secundair dd-actie--klein" @click="beoordeel(v, 'afgewezen')"><Icoon naam="X" :grootte="14" />Afwijzen</button>
                </div>
              </div>
            </li>
          </ul>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.vv-pagina { display: flex; flex-direction: column; gap: 24px; }
.vv-pagina > .tabbalk { margin: 0; }
.vv-pagina > .vv-onderdeel { margin-top: -8px; }
.kaart { border-radius: var(--radius-card); }
.vv-leeg { max-width: 720px; }
.vv-vraag { display: flex; flex-direction: column; gap: 8px; max-width: 720px; border-color: var(--border-strong); }
.vv-knoppen { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.vv-vraag .vv-knoppen { margin-top: 8px; }

/* Kop van een blok: titel en status links, de ene primaire actie rechts. */
.vv-kop { display: flex; flex-wrap: wrap; gap: 12px 24px; justify-content: space-between; align-items: flex-start; }
.vv-kop-tekst { display: flex; flex-direction: column; gap: 6px; min-width: 0; flex: 1 1 320px; }
.vv-titel { margin: 0; font-family: var(--font-serif); font-size: 22px; font-weight: 700; line-height: 1.2; color: var(--ink); }
.vv-meta { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; margin: 0; }
.vv-melding { margin: 16px 0 0; padding: 10px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); font-size: var(--fs-klein); line-height: 1.5; color: var(--ink); }
.vv-melding--geel { background: var(--yellow-licht); border-color: var(--yellow-dark); }
.vv-lijst > .vv-melding:first-child { margin-top: 0; }

.vv-fieldset { margin: 20px 0 0; padding: 20px 0 0; min-width: 0; border: 0; border-top: 1px solid var(--border); }
.vv-form { display: flex; flex-direction: column; gap: 16px; }
.vv-lijst { display: flex; flex-direction: column; gap: 16px; }
.vv-lijst > .vv-melding { margin: 0; }
.vv-sectie { display: flex; flex-direction: column; gap: 12px; margin-top: 8px; padding-top: 20px; border-top: 1px solid var(--border); }
.vv-blok .vv-sectie { margin-top: 20px; }
.vv-subtitel { margin: 0; font-family: var(--font-serif); font-size: 17px; font-weight: 700; color: var(--ink); }
.vv-leeg-mini { margin: 0; padding: 12px 14px; border: 1px dashed var(--border-strong); border-radius: var(--radius); font-size: var(--fs-klein); color: var(--muted); }

/* Eén regel in een lijst (branche, concurrent, winpunt, terugkomregel): een vlak met kop en velden. */
.vv-item { display: flex; flex-direction: column; gap: 14px; padding: 16px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-card); }
.vv-item-kop { display: flex; flex-wrap: wrap; gap: 8px 16px; justify-content: space-between; align-items: center; }
.vv-item-titel { margin: 0; min-width: 0; font-family: var(--font-serif); font-size: 16px; font-weight: 700; color: var(--ink); overflow-wrap: anywhere; }
.vv-nieuw { align-self: flex-start; }

.vv-raster { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 16px; }
.vv-raster--3 { grid-template-columns: minmax(0, 2fr) repeat(2, minmax(0, 1fr)); }
.vv-raster--4 { grid-template-columns: minmax(0, 2fr) repeat(3, minmax(0, 1fr)); }
.vv-raster--5 { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.vv-raster--map { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.4fr); align-items: end; }
.vv-rij + .vv-rij { padding-top: 12px; border-top: 1px solid var(--border); }
.vv-rij-naam { align-self: center; color: var(--ink); }
.vv-redenen { list-style: none; margin: 0; padding: 0; }
.vv-reden { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 280px); gap: 8px 16px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border); }
.vv-reden:last-child { border-bottom: 0; }
.vv-reden-naam { min-width: 0; }

.vv-voorstellen { list-style: none; margin: 16px 0 0; padding: 0; }
.vv-voorstel { grid-template-columns: 36px minmax(0, 1fr) auto; }
.vv-voorstel-tekst { margin: 4px 0 0; font-size: var(--fs-klein); line-height: 1.5; color: var(--ink); }

@media (max-width: 1100px) { .vv-raster--5 { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 719px) {
  .vv-raster, .vv-raster--3, .vv-raster--4, .vv-raster--5, .vv-raster--map, .vv-reden { grid-template-columns: minmax(0, 1fr); }
  .vv-item { padding: 14px 12px; }
  .vv-kop .vv-knoppen { width: 100%; }
  .vv-voorstel { grid-template-columns: 36px minmax(0, 1fr); }
}
</style>
