<script setup lang="ts">
// Instellingen, Terugkomen, tabblad Regels: links de regels, rechts het formulier met de verliesredenen als
// vinkjes (een reden verhuist naar deze regel), terug na, kanaal, wie het oppakt, het ritme daarna en de
// aanpak. Daaronder de voorbeeldberekening ("verloren op X wordt terug op Y"), een waarschuwing als de
// wachttijd korter is dan de afkoeling en live wat er verschuift. Bewaren wordt meteen een nieuwe
// bevestigde versie. Uit SalesDNA: alleen ritme en wie het oppakt.
import { KANAAL_LABEL, type Kanaal } from '~~/shared/nbStatus'
import {
  OPPAKKERS, OPPAKKER_LABEL, REGEL_KANALEN, korterDanAfkoeling, regelKanaalWaarde, terugDagKort, terugDagLang, valideerRegel, voorbeeld,
  type Oppakker, type Verschuiving,
} from '~~/shared/terugkomBeheer'

const props = defineProps<{ data: any }>()
const emit = defineEmits<{ bewaard: []; startset: [] }>()
const toast = useToast()

interface Concept { reden: string; termijnDagen: number; kanaal: Kanaal; oppakker: Oppakker; hercontactritmeId: string | null; aanpak: string; lijst: 'verloren' | 'slapend' }
const regels = computed<any[]>(() => props.data.regels ?? [])
const groepen = computed(() => [
  { k: 'verloren', titel: 'Na een verlies of nee', lijst: regels.value.filter((r) => r.lijst !== 'slapend') },
  { k: 'slapend', titel: 'Slapende klanten', lijst: regels.value.filter((r) => r.lijst === 'slapend') },
].filter((g) => g.lijst.length))
const gekozen = ref<string | null>(null)
const concept = ref<Concept | null>(null)
const keuze = ref<string[]>([])
const lijst = ref<Verschuiving[] | null>(null)
const rekent = ref(false)
const sleutel = (x: { bronSoort: string; reden: string }) => `${x.bronSoort}|${x.reden}`
const spiegel = computed(() => props.data.bron === 'salesdna')
const magKern = computed(() => !!props.data.kan?.regels && !spiegel.value)
const magAanvullen = computed(() => !!props.data.kan?.regels)
const magRedenen = computed(() => !!props.data.kan?.redenen && !spiegel.value)
const BRON_KORT: Record<string, string> = { deal_verloren: 'deal verloren', offerte_verloren: 'offerte verloren', slapend: 'slapend' }
const ritmeNaam = (id: string | null) => props.data.ritmes?.find((r: any) => r.id === id)?.naam ?? 'Standaard winback'

function kies(id: string) {
  const r = regels.value.find((x) => x.id === id)
  gekozen.value = id
  concept.value = r
    ? { reden: r.reden, termijnDagen: r.termijnDagen, kanaal: r.kanaalSleutel, oppakker: r.oppakker, hercontactritmeId: r.hercontactritmeId ?? null, aanpak: r.aanpak ?? '', lijst: r.lijst ?? 'verloren' }
    : { reden: '', termijnDagen: 91, kanaal: 'bellen', oppakker: 'eigenaar', hercontactritmeId: null, aanpak: '', lijst: 'verloren' }
  keuze.value = (props.data.redenen ?? []).filter((x: any) => x.terugkomregelId && x.terugkomregelId === id).map(sleutel)
  lijst.value = null
}
const origineel = computed(() => {
  if (!gekozen.value) return ''
  const r = regels.value.find((x) => x.id === gekozen.value)
  const k = (props.data.redenen ?? []).filter((x: any) => x.terugkomregelId && x.terugkomregelId === gekozen.value).map(sleutel)
  return r ? JSON.stringify([r.reden, r.termijnDagen, r.kanaalSleutel, r.oppakker, r.hercontactritmeId ?? null, r.aanpak ?? '', [...k].sort()]) : 'nieuw'
})
const huidig = computed(() => (concept.value ? JSON.stringify([concept.value.reden, concept.value.termijnDagen, concept.value.kanaal, concept.value.oppakker, concept.value.hercontactritmeId ?? null, concept.value.aanpak, [...keuze.value].sort()]) : ''))
const gewijzigd = computed(() => gekozen.value === 'nieuw' || huidig.value !== origineel.value)
const fouten = computed(() => (concept.value ? valideerRegel({ ...concept.value, termijnDagen: Number(concept.value.termijnDagen) }) : []))

watch(() => props.data, () => {
  if (gekozen.value && gekozen.value !== 'nieuw' && regels.value.some((r) => r.id === gekozen.value)) kies(gekozen.value)
  else if (gekozen.value !== 'nieuw') { if (regels.value[0]) kies(regels.value[0].id); else { gekozen.value = null; concept.value = null } }
}, { immediate: true })

// Redenen als vinkjes: bij een regel voor slapende klanten de slapende redenen, anders de rest.
const redenOpties = computed(() => (props.data.redenen ?? []).filter((x: any) => !x.vast && (concept.value?.lijst === 'slapend' ? x.bronSoort === 'slapend' : x.bronSoort !== 'slapend')))
const elders = (x: any) => (x.terugkomregelId && x.terugkomregelId !== gekozen.value ? regels.value.find((r) => r.id === x.terugkomregelId) : null)

const vb = computed(() => (concept.value ? voorbeeld({ termijnDagen: Number(concept.value.termijnDagen) || 0, kanaal: regelKanaalWaarde(concept.value.kanaal) }, props.data.afkoeling, props.data.vandaag) : null))
const letOp = computed(() => (concept.value ? korterDanAfkoeling({ termijnDagen: Number(concept.value.termijnDagen) || 0, kanaal: regelKanaalWaarde(concept.value.kanaal) }, props.data.afkoeling, { magAfkoeling: !!props.data.kan?.afkoeling }) : null))

// Droogloop: wat verschuift, kort na elke wijziging.
let timer: ReturnType<typeof setTimeout> | undefined
let volgnr = 0
watch([huidig, gekozen], () => {
  clearTimeout(timer)
  if (!concept.value || !gewijzigd.value || fouten.value.length) { lijst.value = null; return }
  rekent.value = true
  timer = setTimeout(async () => {
    const nr = ++volgnr
    try {
      const r: any = await $fetch('/api/instellingen/terugkomen/proef', { method: 'POST', body: { regel: { id: gekozen.value, ...concept.value }, redenen: magRedenen.value ? redenBody() : undefined } })
      if (nr === volgnr) lijst.value = r.verschuivingen
    } catch { if (nr === volgnr) lijst.value = null } finally { if (nr === volgnr) rekent.value = false }
  }, 300)
})
function redenBody() { return keuze.value.map((k) => { const [bronSoort, ...r] = k.split('|'); return { bronSoort, reden: r.join('|') } }) }

const formulier = ref<HTMLElement | null>(null)
function open(id: string) {
  kies(id)
  if (import.meta.client && window.innerWidth < 1024) nextTick(() => formulier.value?.scrollIntoView({ block: 'start' }))
}
const bezig = ref(false)
async function bewaar() {
  if (!concept.value || fouten.value.length || !gewijzigd.value) return
  bezig.value = true
  try {
    const r: any = await $fetch(`/api/instellingen/terugkomen/regels/${encodeURIComponent(gekozen.value!)}`, { method: 'PUT', body: { ...concept.value, termijnDagen: Number(concept.value.termijnDagen), redenen: magRedenen.value ? redenBody() : undefined } })
    const n = r.verschoven
    toast.toon(`Regel bewaard${spiegel.value ? '' : ` als versie ${r.versie}`}. ${n ? `${n} ${n === 1 ? 'prospect' : 'prospects'} verschoven.` : 'Er verschoof niets.'}`)
    gekozen.value = r.id
    emit('bewaard')
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
const titel = computed(() => (gekozen.value === 'nieuw' ? 'Nieuwe regel' : regels.value.find((r) => r.id === gekozen.value)?.reden ?? ''))
const bijRegel = (id: string) => (props.data.redenen ?? []).filter((x: any) => x.terugkomregelId === id).map((x: any) => x.reden)
</script>

<template>
  <div class="tr">
    <LegeStaat v-if="!regels.length && gekozen !== 'nieuw'" titel="Nog geen terugkomregels." tekst="Zonder regel geldt na een nee alleen de afkoeling van bellen. Leg vast wanneer een verloren prospect terugkomt en hoe." data-test="tk-leeg">
      <div class="tr-leeg-knoppen">
        <button v-if="data.kan.startset" type="button" class="dd-actie dd-actie--secundair" data-test="tk-startset" @click="emit('startset')">Kopieer uit startset</button>
        <button v-if="magKern" type="button" class="dd-actie dd-actie--primair" data-test="tk-eerste" @click="kies('nieuw')"><Icoon naam="Plus" class="dd-actie-icoon" />Leg de eerste regel vast</button>
      </div>
    </LegeStaat>
    <div v-else class="tr-twee">
      <div>
        <div class="tr-lijstkop">
          <div>
            <h2 class="kaart-titel">Regels</h2>
            <p class="meta mt-8">Kies een regel om hem aan te passen. Je ziet meteen wat er verschuift.</p>
          </div>
          <button v-if="magKern" type="button" class="dd-act" data-test="tk-nieuw" @click="open('nieuw')"><Icoon naam="Plus" />Regel</button>
        </div>
        <section v-for="g in groepen" :key="g.k" class="mt-16" :aria-label="g.titel">
          <p class="tr-groep">{{ g.titel }}</p>
          <div class="tr-lijst">
            <button v-for="r in g.lijst" :key="r.id" type="button" class="tr-kaart" :aria-pressed="r.id === gekozen" :data-test="`tk-regel-${r.id}`" @click="open(r.id)">
              <span class="tr-kaart-kop"><strong>{{ r.reden }}</strong><span class="pil">na {{ r.termijnDagen }} dagen</span></span>
              <span class="meta">{{ KANAAL_LABEL[r.kanaalSleutel as Kanaal] }} · {{ OPPAKKER_LABEL[r.oppakker as Oppakker] }} · ritme {{ ritmeNaam(r.hercontactritmeId) }}</span>
              <span class="meta">Bij: {{ bijRegel(r.id).join(', ') || 'geen reden gekoppeld' }}</span>
              <span class="meta">{{ r.wachtend }} {{ r.wachtend === 1 ? 'prospect wacht' : 'prospects wachten' }} op deze regel<template v-if="!r.actief"> · nog niet bevestigd</template></span>
            </button>
          </div>
        </section>
      </div>

      <form v-if="concept" ref="formulier" class="kaart tr-form" aria-labelledby="tk-form-titel" data-test="tk-regelform" @submit.prevent="bewaar">
        <span class="kicker">{{ gekozen === 'nieuw' ? 'Nieuwe regel' : 'Regel aanpassen' }}</span>
        <h3 id="tk-form-titel" class="tr-titel">{{ titel || 'Nieuwe regel' }}</h3>
        <p v-if="spiegel" class="meta mt-8" data-test="tk-spiegel-uitleg">Deze regel komt uit SalesDNA. Reden, termijn, kanaal en aanpak wijzig je daar; hier vul je het ritme en wie het oppakt aan.</p>
        <p v-else-if="!data.kan.regels" class="meta mt-8">Je kunt deze regel bekijken; aanpassen doet je salesmanager of beheerder.</p>
        <div class="formulier-raster mt-16 tr-velden">
          <label class="veld tr-breed"><span class="veld-label">Naam van de regel</span><input v-model="concept.reden" class="invoer" required maxlength="120" :disabled="!magKern" data-test="tk-naam"></label>
          <fieldset class="veld tr-breed tr-redenen">
            <legend class="veld-label">Geldt bij deze verliesredenen</legend>
            <div class="tr-vinkjes">
              <label v-for="x in redenOpties" :key="sleutel(x)" class="tr-vinkje" :class="{ 'tr-vinkje--elders': elders(x) }">
                <input v-model="keuze" type="checkbox" :value="sleutel(x)" :disabled="!magRedenen" :data-test="`tk-reden-${x.reden}`">
                <span>{{ x.reden }}<span v-if="x.bronSoort !== 'nee'" class="meta"> ({{ BRON_KORT[x.bronSoort] }})</span><span v-if="elders(x)" class="meta"> (nu {{ elders(x).reden }})</span></span>
              </label>
            </div>
            <span class="veld-uitleg">{{ magRedenen ? 'Een reden hoort bij één regel. Kies je een reden die al bij een andere regel hoort, dan verhuist hij hierheen.' : spiegel ? 'Koppel redenen op het tabblad Verliesredenen.' : 'Redenen koppelen doet de beheerder.' }}</span>
          </fieldset>
          <label class="veld"><span class="veld-label">Terug na (dagen)</span><input v-model.number="concept.termijnDagen" class="invoer tnum" type="number" min="0" max="730" step="1" required :disabled="!magKern" data-test="tk-dagen"></label>
          <label class="veld"><span class="veld-label">Kanaal</span>
            <select v-model="concept.kanaal" class="invoer" :disabled="!magKern" data-test="tk-kanaal">
              <option v-for="k in REGEL_KANALEN" :key="k.kanaal" :value="k.kanaal">{{ KANAAL_LABEL[k.kanaal] }} (afkoeling {{ data.afkoeling[k.kanaal] }} dagen)</option>
            </select>
          </label>
          <label class="veld"><span class="veld-label">Wie pakt het op</span>
            <select v-model="concept.oppakker" class="invoer" :disabled="!magAanvullen" data-test="tk-oppakker"><option v-for="o in OPPAKKERS" :key="o" :value="o">{{ OPPAKKER_LABEL[o] }}</option></select>
          </label>
          <label class="veld"><span class="veld-label">Hercontactritme daarna</span>
            <select v-model="concept.hercontactritmeId" class="invoer" :disabled="!magAanvullen" data-test="tk-ritme">
              <option :value="null">Standaard winback</option>
              <option v-for="r in data.ritmes" :key="r.id" :value="r.id">{{ r.naam }}</option>
            </select>
          </label>
          <label class="veld tr-breed"><span class="veld-label">Aanpak (wat de accountmanager leest)</span><textarea v-model="concept.aanpak" class="invoer" rows="2" maxlength="1000" :disabled="!magKern" data-test="tk-aanpak" /></label>
        </div>

        <div v-if="vb" class="tr-som mt-16" aria-live="polite" data-test="tk-som">
          <span class="kicker">Voorbeeldberekening</span>
          <dl class="gegevens mt-8">
            <dt>Verloren op</dt><dd>{{ terugDagLang(vb.verlorenOp) }}</dd>
            <dt>Wachttijd van de regel</dt><dd class="tnum">{{ vb.wachttijd }} dagen</dd>
            <dt>Afkoeling {{ KANAAL_LABEL[vb.kanaal].toLowerCase() }} (ondergrens)</dt><dd class="tnum">{{ vb.ondergrens }} dagen</dd>
          </dl>
          <p class="tr-uitkomst" data-test="tk-uitkomst">Verloren op {{ terugDagLang(vb.verlorenOp) }} wordt terug op {{ terugDagKort(vb.terugOp) }} {{ vb.terugOp.slice(0, 4) }}.</p>
          <p class="meta">Dan ziet de accountmanager: {{ KANAAL_LABEL[vb.kanaal].toLowerCase() }}, {{ OPPAKKER_LABEL[concept.oppakker].toLowerCase() }}, ritme {{ ritmeNaam(concept.hercontactritmeId) }}.</p>
          <p v-if="letOp" class="waarschuwing mt-8" data-test="tk-let-op"><Icoon naam="TriangleAlert" class="icoon" :grootte="16" /><span>{{ letOp }}</span></p>
        </div>

        <TerugkomVerschuif v-if="data.kan.regels" :lijst="lijst" :bezig="rekent" :regels="regels" />

        <p v-if="fouten.length && gewijzigd && data.kan.regels" class="meta mt-8" data-test="tk-fouten">Nog nodig: {{ fouten.join(', ').toLowerCase() }}.</p>
        <div v-if="data.kan.regels" class="tr-voet">
          <button type="submit" class="dd-actie dd-actie--primair" :disabled="bezig || !gewijzigd || !!fouten.length" data-test="tk-bewaar">{{ bezig ? 'Bewaren...' : 'Bewaar regel' }}</button>
          <button type="button" class="dd-actie dd-actie--secundair" :disabled="!gewijzigd" data-test="tk-annuleer" @click="gekozen === 'nieuw' && regels[0] ? kies(regels[0].id) : kies(gekozen!)">Annuleer</button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.tr-twee { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 24px; align-items: start; }
@media (max-width: 1023px) { .tr-twee { grid-template-columns: minmax(0, 1fr); } }
.tr-lijstkop { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
.tr-groep { margin: 0 0 8px; font-family: var(--font-mono); font-size: var(--fs-label); text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
.tr-lijst { display: grid; gap: 8px; }
.tr-kaart { display: grid; gap: 4px; width: 100%; padding: 12px 14px; text-align: left; background: var(--wit); border: 1px solid var(--border); color: inherit; font: inherit; cursor: pointer; min-height: var(--touch-target-min); }
.tr-kaart:hover { border-color: var(--border-strong); }
.tr-kaart[aria-pressed='true'] { border-color: var(--ink); box-shadow: inset 3px 0 0 var(--yellow); }
.tr-kaart-kop { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
.tr-kaart-kop .pil { flex: 0 0 auto; }
.tr-form { padding: var(--kaart-padding); scroll-margin-top: 80px; }
.tr-titel { margin: 6px 0 0; font-family: var(--font-serif); font-size: 22px; line-height: 1.2; overflow-wrap: anywhere; }
.tr-velden { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
.tr-breed { grid-column: 1 / -1; }
@media (max-width: 599px) { .tr-velden { grid-template-columns: minmax(0, 1fr); } }
.tr-redenen { border: 0; margin: 0; padding: 0; min-width: 0; }
.tr-vinkjes { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 2px 16px; }
.tr-vinkje { display: flex; align-items: center; gap: 8px; min-height: 32px; font-size: var(--fs-klein); }
.tr-vinkje--elders { color: var(--ink-soft); }
.tr-som { padding: 14px 16px; background: var(--surface); border: 1px solid var(--border); }
.tr-som .gegevens { margin-bottom: 8px; }
.tr-uitkomst { margin: 0 0 4px; font-weight: 700; }
.tr-voet { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border); }
.tr-leeg-knoppen { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 12px; }
@media (max-width: 719px) { .tr-vinkje { min-height: var(--touch-target-min); } }
</style>
