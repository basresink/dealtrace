<script setup lang="ts">
// Het bewerkpaneel van één regel op /instellingen/regels, in de opzet van DealDrive (Activity Selling):
// kop met code, naam, aan of uit en Verwijderen; dan Wat en wanneer, Prospectreis (Dealtrace: fases waarin
// de regel geldt), Sturing (trigger met leesbare parameters, ook een overgang in de reis), Gevolg (met de
// winpunten die de taak als gespreksonderwerp meekrijgt), het live voorbeeld en de droogloop met de
// geraakte prospects. Elk veld heeft een uitleg (ⓘ). Het paneel muteert de regel; de pagina bewaart.
import { HOOFDFASE_LABEL, type Hoofdfase } from '~~/shared/reis'
import { NB_STATUSSEN } from '~~/shared/nbStatus'
import { ACTIESOORTEN, ACTIESOORT_LABEL, CATEGORIEEN, DATUM_VELDEN, PARAM_INFO, PRIORITEITEN, TERMIJNEN, UITVOERDERROLLEN, sjabloonFouten, vulSjabloon } from '~~/shared/regelPatronen'
import { REGEL_UITLEG, type RegelUitlegSleutel } from '~~/shared/regelUitleg'

const props = defineProps<{
  keuzes: any
  kan: any
  /** Alleen lezen (telefoon, of geen recht om te schrijven). */
  leesStand: boolean
  /** Salesmanager bij een organisatieregel: alleen aan of uit, cadans, drempels en klassen. */
  beperkt: boolean
  klein: boolean
  droog: any
  magVerwijderen: boolean
}>()
const regel = defineModel<any>({ required: true })
const emit = defineEmits<{ wijzig: []; verwijder: []; wisselActief: []; stelVoor: [tekst: string] }>()

const ro = computed(() => props.leesStand)
const vast = computed(() => props.leesStand || props.beperkt)
const ROL_LABEL: Record<string, string> = { binnendienst: 'Binnendienst', buitendienst: 'Buitendienst', eigenaar: 'Eigenaar van het account', salesmanager: 'Salesmanager van het team' }
const PRIO_LABEL: Record<string, string> = { hoog: 'Hoog', middel: 'Middel', laag: 'Laag' }
const SIGNAALSOORTEN = ['jubileum', 'vacature', 'directiewissel', 'verhuizing', 'subsidie', 'nieuws', 'kvk-mutatie']
const SUB_WEKELIJKS = new Set([0, 1, 2, 3])

// Uitleg per veld: meerdere tegelijk open mag.
const uitlegOpen = reactive(new Set<string>())
function wisselUitleg(k: RegelUitlegSleutel) { if (uitlegOpen.has(k)) uitlegOpen.delete(k); else uitlegOpen.add(k) }

const reis = computed(() => props.keuzes.reizen.find((r: any) => r.id === regel.value.reisId) ?? props.keuzes.reizen[0] ?? null)
const fases = computed<any[]>(() => reis.value?.fases ?? [])
const faseLabel = computed(() => new Map<string, string>(props.keuzes.reizen.flatMap((r: any) => r.fases.map((f: any) => [f.id, f.label]))))
const gebeurtenisLabel = computed(() => new Map<string, string>(props.keuzes.gebeurtenissen.map((g: any) => [g.id, g.label])))
const gekozenFases = computed<string[]>(() => regel.value.data.afbakening.faseIds ?? [])
const hoofdfasenVanRegel = computed(() => new Set(fases.value.filter((f) => gekozenFases.value.includes(f.id)).map((f) => f.hoofdfase)))
const patroonInfo = computed(() => props.keuzes.patronen.find((p: any) => p.id === regel.value.data.trigger.patroon))
const params = computed(() => Object.keys(patroonInfo.value?.parameters ?? {}))
const cadansen = computed(() => props.keuzes.cadansen.filter((c: any) => regel.value.motor !== 'ai' || !SUB_WEKELIJKS.has(c.dagen) || c.dagen === regel.value.cadansDagen))
const winpuntIds = computed<string[]>(() => regel.value.data.gevolg.winpuntIds ?? [])
const gekozenWinpunten = computed(() => winpuntIds.value.map((id) => props.keuzes.winpunten.find((w: any) => w.id === id)).filter(Boolean))
const verwachtVast = ref(!!regel.value.data.gevolg.verwachtResultaat)
watch(() => regel.value.id, () => { verwachtVast.value = !!regel.value.data.gevolg.verwachtResultaat })

function wijzig() { emit('wijzig') }
function kiesPatroon(p: string) {
  const info = props.keuzes.patronen.find((x: any) => x.id === p)
  regel.value.data.trigger = { patroon: p, parameters: { ...(info?.parameters ?? {}) } }
  wijzig()
}
function kiesReis(id: string) {
  regel.value.reisId = id || null
  // Fases die niet in de gekozen reis staan, vallen weg.
  const ids = new Set((props.keuzes.reizen.find((r: any) => r.id === id) ?? props.keuzes.reizen[0])?.fases.map((f: any) => f.id) ?? [])
  regel.value.data.afbakening.faseIds = gekozenFases.value.filter((f) => ids.has(f))
  wijzig()
}
function lijstVeld(pad: 'statussen' | 'faseIds' | 'klassen' | 'doelgroepIds', w: string) {
  const l: string[] = regel.value.data.afbakening[pad] ?? []
  regel.value.data.afbakening[pad] = l.includes(w) ? l.filter((x) => x !== w) : [...l, w]
  wijzig()
}
function wisselSignaal(s: string) {
  const l: string[] = regel.value.data.trigger.parameters.signaalsoorten ?? []
  regel.value.data.trigger.parameters.signaalsoorten = l.includes(s) ? l.filter((x) => x !== s) : [...l, s]
  wijzig()
}
function wisselWinpunt(id: string) {
  const l = winpuntIds.value
  regel.value.data.gevolg.winpuntIds = l.includes(id) ? l.filter((x) => x !== id) : [...l, id].slice(0, 5)
  wijzig()
}
function kiesOvergang(id: string) {
  const o = reis.value?.overgangen.find((x: any) => x.id === id)
  if (!o) return
  Object.assign(regel.value.data.trigger.parameters, { vanFase: o.vanFaseId, gebeurtenis: o.gebeurtenis, naarFase: o.naarFaseId })
  wijzig()
}
function zetMotor(m: string) {
  regel.value.motor = m
  // AI draait hooguit wekelijks: een snellere cadans gaat naar wekelijks.
  if (m === 'ai' && SUB_WEKELIJKS.has(regel.value.cadansDagen)) regel.value.cadansDagen = 7
  wijzig()
}
const overgangTekst = (o: any) => `${o.vanFaseId ? faseLabel.value.get(o.vanFaseId) ?? o.vanFaseId : 'Instap'} naar ${faseLabel.value.get(o.naarFaseId) ?? o.naarFaseId} bij ${(gebeurtenisLabel.value.get(o.gebeurtenis) ?? o.gebeurtenis).toLowerCase()}`
const gekozenOvergang = computed(() => {
  const p = regel.value.data.trigger.parameters
  return reis.value?.overgangen.find((o: any) => o.vanFaseId === (p.vanFase ?? null) && o.naarFaseId === p.naarFase && o.gebeurtenis === p.gebeurtenis)?.id ?? ''
})

const voorbeeld = computed(() => vulSjabloon(regel.value.data.gevolg.taaksjabloon || `${ACTIESOORT_LABEL[regel.value.data.gevolg.actiesoort]}: {account}`, { account: 'Testinstallatie Koperwiek', contact: 'Gerrit Testveen', winpunt: gekozenWinpunten.value[0]?.titel }))
const voorstelTekst = ref('')
const geldtIn = computed(() => {
  const r = regel.value.reisId ? reis.value?.naam : 'Elke reis'
  const f = gekozenFases.value.map((id) => faseLabel.value.get(id) ?? id)
  return `${r} · ${f.length ? f.join(', ') : 'elke fase'}`
})
</script>

<template>
  <div class="regels-paneel rp" data-test="regel-paneel">
    <header class="rp-kop">
      <span v-if="regel.code" class="rp-code tnum">{{ regel.code }}</span>
      <h2 class="rp-titel">{{ regel.naam || 'Regel' }}</h2>
      <span class="rp-status">
        <Schakelaar v-if="!ro" :aan="regel.actief" :label="`${regel.naam} aan of uit`" data-test="paneel-aan" @wissel="emit('wisselActief')" />
        <span>{{ regel.actief ? 'Actief' : 'Uit' }}</span>
        <button type="button" class="rp-info" :aria-expanded="uitlegOpen.has('aanUit')" aria-label="Uitleg over aan of uit" @click="wisselUitleg('aanUit')"><Icoon naam="Info" :grootte="15" /></button>
      </span>
      <button v-if="magVerwijderen && !ro" type="button" class="dd-act dd-act--gevaar" data-test="regel-verwijderen" @click="emit('verwijder')"><Icoon naam="Trash2" :grootte="15" />Verwijderen</button>
    </header>
    <p v-if="uitlegOpen.has('aanUit')" class="rp-uitleg">{{ REGEL_UITLEG.aanUit }}</p>
    <p v-if="leesStand && !klein" class="kaart kaart--geel rp-melding">{{ regel.scope === 'persoonlijk' ? 'Dit is de persoonlijke regel van iemand anders.' : 'Je kunt deze regel lezen.' }}<template v-if="kan.persoonlijk && regel.scope !== 'persoonlijk'"> Een wijziging kun je onderaan voorstellen.</template></p>
    <p v-else-if="beperkt" class="kaart kaart--geel rp-melding">Bij organisatieregels wijzig je aan of uit, cadans, drempels en klassen.</p>

    <section class="rp-sectie" aria-labelledby="rp-wat">
      <h3 id="rp-wat" class="rp-sectie-titel">Wat en wanneer</h3>
      <div class="rp-raster">
        <div class="veld rp-breed">
          <span class="veld-label"><label for="rp-naam">Naam</label><button type="button" class="rp-info" :aria-expanded="uitlegOpen.has('naam')" aria-label="Uitleg over naam" @click="wisselUitleg('naam')"><Icoon naam="Info" :grootte="15" /></button></span>
          <input id="rp-naam" v-model="regel.naam" class="invoer" :disabled="vast" data-test="veld-naam" @input="wijzig">
          <p v-if="uitlegOpen.has('naam')" class="rp-uitleg">{{ REGEL_UITLEG.naam }}</p>
        </div>
        <div class="veld">
          <span class="veld-label"><label for="rp-cat">Categorie</label><button type="button" class="rp-info" :aria-expanded="uitlegOpen.has('categorie')" aria-label="Uitleg over categorie" @click="wisselUitleg('categorie')"><Icoon naam="Info" :grootte="15" /></button></span>
          <select id="rp-cat" v-model="regel.categorie" class="invoer" :disabled="vast" @change="wijzig">
            <option v-if="regel.categorie && !(CATEGORIEEN as readonly string[]).includes(regel.categorie)" :value="regel.categorie">{{ regel.categorie }} (eigen)</option>
            <option v-for="c in CATEGORIEEN" :key="c" :value="c">{{ c }}</option>
          </select>
          <p v-if="uitlegOpen.has('categorie')" class="rp-uitleg">{{ REGEL_UITLEG.categorie }}</p>
        </div>
        <div class="veld">
          <span class="veld-label"><label for="rp-sub">Subcategorie</label><button type="button" class="rp-info" :aria-expanded="uitlegOpen.has('subcategorie')" aria-label="Uitleg over subcategorie" @click="wisselUitleg('subcategorie')"><Icoon naam="Info" :grootte="15" /></button></span>
          <input id="rp-sub" v-model="regel.data.subcategorie" class="invoer" :disabled="vast" @input="wijzig">
          <p v-if="uitlegOpen.has('subcategorie')" class="rp-uitleg">{{ REGEL_UITLEG.subcategorie }}</p>
        </div>
        <div class="veld rp-breed">
          <span class="veld-label"><label for="rp-oms">Omschrijving</label><button type="button" class="rp-info" :aria-expanded="uitlegOpen.has('omschrijving')" aria-label="Uitleg over omschrijving" @click="wisselUitleg('omschrijving')"><Icoon naam="Info" :grootte="15" /></button></span>
          <textarea id="rp-oms" v-model="regel.data.omschrijving" class="invoer" rows="2" :disabled="vast" placeholder="Bijvoorbeeld: bel binnen een werkdag na de kwalificatie" @input="wijzig" />
          <p v-if="uitlegOpen.has('omschrijving')" class="rp-uitleg">{{ REGEL_UITLEG.omschrijving }}</p>
        </div>
        <div class="veld">
          <span class="veld-label"><label for="rp-act">Activiteit</label><button type="button" class="rp-info" :aria-expanded="uitlegOpen.has('activiteit')" aria-label="Uitleg over activiteit" @click="wisselUitleg('activiteit')"><Icoon naam="Info" :grootte="15" /></button></span>
          <select id="rp-act" v-model="regel.data.activiteit" class="invoer" :disabled="vast" data-test="veld-activiteit" @change="wijzig"><option value="inzicht">Inzicht</option><option value="taak">Taak</option></select>
          <p v-if="uitlegOpen.has('activiteit')" class="rp-uitleg">{{ REGEL_UITLEG.activiteit }}</p>
        </div>
        <div class="veld">
          <span class="veld-label"><label for="rp-cad">Cadans</label><button type="button" class="rp-info" :aria-expanded="uitlegOpen.has('cadans')" aria-label="Uitleg over cadans" @click="wisselUitleg('cadans')"><Icoon naam="Info" :grootte="15" /></button></span>
          <select id="rp-cad" v-model.number="regel.cadansDagen" class="invoer" :disabled="ro" data-test="veld-cadans" @change="wijzig"><option v-for="c in cadansen" :key="c.dagen" :value="c.dagen">{{ c.label }}</option></select>
          <p v-if="uitlegOpen.has('cadans')" class="rp-uitleg">{{ REGEL_UITLEG.cadans }}</p>
        </div>
        <div class="veld">
          <span class="veld-label"><label for="rp-prio">Prioriteit</label><button type="button" class="rp-info" :aria-expanded="uitlegOpen.has('prioriteit')" aria-label="Uitleg over prioriteit" @click="wisselUitleg('prioriteit')"><Icoon naam="Info" :grootte="15" /></button></span>
          <select id="rp-prio" v-model="regel.prioriteit" class="invoer" :disabled="vast" @change="wijzig"><option v-for="p in PRIORITEITEN" :key="p" :value="p">{{ PRIO_LABEL[p] }}</option></select>
          <p v-if="uitlegOpen.has('prioriteit')" class="rp-uitleg">{{ REGEL_UITLEG.prioriteit }}</p>
        </div>
      </div>
    </section>

    <section class="rp-sectie" aria-labelledby="rp-reis" data-test="regel-reis">
      <h3 id="rp-reis" class="rp-sectie-titel">Prospectreis</h3>
      <p class="meta rp-geldt" data-test="regel-geldt-in">Geldt in: {{ geldtIn }}</p>
      <div class="rp-raster">
        <div class="veld">
          <span class="veld-label"><label for="rp-reiskeuze">Reis</label><button type="button" class="rp-info" :aria-expanded="uitlegOpen.has('reis')" aria-label="Uitleg over reis" @click="wisselUitleg('reis')"><Icoon naam="Info" :grootte="15" /></button></span>
          <select id="rp-reiskeuze" :value="regel.reisId ?? ''" class="invoer" :disabled="vast" data-test="veld-reis" @change="kiesReis(($event.target as HTMLSelectElement).value)">
            <option value="">Elke reis</option>
            <option v-for="r in keuzes.reizen" :key="r.id" :value="r.id">{{ r.naam }}</option>
          </select>
          <p v-if="uitlegOpen.has('reis')" class="rp-uitleg">{{ REGEL_UITLEG.reis }}</p>
        </div>
        <fieldset class="veld rp-breed rp-groep">
          <legend class="veld-label">Fases waarin de regel geldt<button type="button" class="rp-info" :aria-expanded="uitlegOpen.has('fases')" aria-label="Uitleg over fases" @click="wisselUitleg('fases')"><Icoon naam="Info" :grootte="15" /></button></legend>
          <div class="rp-vinkjes" data-test="veld-fases">
            <label v-for="x in fases" :key="x.id" class="rp-vinkje"><input type="checkbox" :checked="gekozenFases.includes(x.id)" :disabled="vast" :data-test="`fase-${x.id}`" @change="lijstVeld('faseIds', x.id)"> {{ x.label }}</label>
            <span v-if="!gekozenFases.length" class="meta rp-alle">elke fase</span>
          </div>
          <p v-if="uitlegOpen.has('fases')" class="rp-uitleg">{{ REGEL_UITLEG.fases }}</p>
        </fieldset>
      </div>
    </section>

    <section class="rp-sectie" aria-labelledby="rp-sturing">
      <h3 id="rp-sturing" class="rp-sectie-titel">Sturing</h3>
      <div class="rp-raster">
        <div class="veld">
          <span class="veld-label"><label for="rp-bron">Bron</label><button type="button" class="rp-info" :aria-expanded="uitlegOpen.has('bron')" aria-label="Uitleg over bron" @click="wisselUitleg('bron')"><Icoon naam="Info" :grootte="15" /></button></span>
          <select id="rp-bron" v-model="regel.data.bron" class="invoer" :disabled="vast" @change="wijzig"><option value="intern">Intern</option><option value="extern">Extern</option></select>
          <p v-if="uitlegOpen.has('bron')" class="rp-uitleg">{{ REGEL_UITLEG.bron }}</p>
        </div>
        <div class="veld">
          <span class="veld-label"><label for="rp-sbron">Specifieke bron</label><button type="button" class="rp-info" :aria-expanded="uitlegOpen.has('specifiekeBron')" aria-label="Uitleg over specifieke bron" @click="wisselUitleg('specifiekeBron')"><Icoon naam="Info" :grootte="15" /></button></span>
          <input id="rp-sbron" v-model="regel.data.specifiekeBron" class="invoer" :disabled="vast" placeholder="Bijvoorbeeld: Web: vacatures" @input="wijzig">
          <p v-if="uitlegOpen.has('specifiekeBron')" class="rp-uitleg">{{ REGEL_UITLEG.specifiekeBron }}</p>
        </div>
        <div class="veld">
          <span class="veld-label"><label for="rp-patroon">Triggerpatroon</label><button type="button" class="rp-info" :aria-expanded="uitlegOpen.has('triggerPatroon')" aria-label="Uitleg over triggerpatroon" @click="wisselUitleg('triggerPatroon')"><Icoon naam="Info" :grootte="15" /></button></span>
          <select id="rp-patroon" :value="regel.data.trigger.patroon" class="invoer" :disabled="vast" data-test="veld-patroon" @change="kiesPatroon(($event.target as HTMLSelectElement).value)"><option v-for="p in keuzes.patronen" :key="p.id" :value="p.id">{{ p.label }}</option></select>
          <p v-if="uitlegOpen.has('triggerPatroon')" class="rp-uitleg">{{ REGEL_UITLEG.triggerPatroon }}</p>
        </div>
        <div class="veld">
          <span class="veld-label"><label for="rp-motor">Motor</label><button type="button" class="rp-info" :aria-expanded="uitlegOpen.has('motor')" aria-label="Uitleg over motor" @click="wisselUitleg('motor')"><Icoon naam="Info" :grootte="15" /></button></span>
          <select id="rp-motor" :value="regel.motor" class="invoer" :disabled="vast || !kan.ai" @change="zetMotor(($event.target as HTMLSelectElement).value)"><option value="regel">Regel</option><option value="ai">AI</option></select>
          <p v-if="uitlegOpen.has('motor')" class="rp-uitleg">{{ REGEL_UITLEG.motor }}</p>
        </div>
        <div class="veld rp-breed" data-test="trigger-parameters">
          <span class="veld-label">Trigger-parameters<button type="button" class="rp-info" :aria-expanded="uitlegOpen.has('triggerParameters')" aria-label="Uitleg over trigger-parameters" @click="wisselUitleg('triggerParameters')"><Icoon naam="Info" :grootte="15" /></button></span>
          <p class="meta">{{ regel.trigger }}</p>
          <div v-if="regel.data.trigger.patroon === 'reis-overgang' && reis?.overgangen?.length" class="rp-param rp-overgang">
            <label class="veld"><span class="veld-label">Overgang uit de reis</span>
              <select class="invoer" :value="gekozenOvergang" :disabled="ro" data-test="veld-overgang" @change="kiesOvergang(($event.target as HTMLSelectElement).value)">
                <option value="">Eigen combinatie</option>
                <option v-for="o in reis.overgangen" :key="o.id" :value="o.id">{{ overgangTekst(o) }}</option>
              </select>
            </label>
            <button type="button" class="rp-info" :aria-expanded="uitlegOpen.has('overgang')" aria-label="Uitleg over overgang in de reis" @click="wisselUitleg('overgang')"><Icoon naam="Info" :grootte="15" /></button>
          </div>
          <p v-if="uitlegOpen.has('overgang')" class="rp-uitleg">{{ REGEL_UITLEG.overgang }}</p>
          <div v-if="params.length" class="rp-params">
            <template v-for="k in params" :key="k">
              <label v-if="k === 'veld'" class="veld"><span class="veld-label">{{ PARAM_INFO[k]?.label }}</span>
                <select v-model="regel.data.trigger.parameters[k]" class="invoer" :disabled="ro" :data-test="`param-${k}`" @change="wijzig"><option v-for="v in DATUM_VELDEN.filter((x) => x.patronen.includes(regel.data.trigger.patroon) || x.code === regel.data.trigger.parameters[k])" :key="v.code" :value="v.code">{{ v.label }}</option></select>
              </label>
              <label v-else-if="k === 'gebeurtenis'" class="veld"><span class="veld-label">{{ PARAM_INFO[k]?.label }}</span>
                <select :value="regel.data.trigger.parameters[k] ?? ''" class="invoer" :disabled="ro" :data-test="`param-${k}`" @change="regel.data.trigger.parameters[k] = ($event.target as HTMLSelectElement).value || null; wijzig()"><option value="">Elke gebeurtenis</option><option v-for="g in keuzes.gebeurtenissen" :key="g.id" :value="g.id">{{ g.label }}</option></select>
              </label>
              <label v-else-if="k === 'fase' || k === 'vanFase' || k === 'naarFase'" class="veld"><span class="veld-label">{{ PARAM_INFO[k]?.label }}</span>
                <select :value="regel.data.trigger.parameters[k] ?? ''" class="invoer" :disabled="ro" :data-test="`param-${k}`" @change="regel.data.trigger.parameters[k] = ($event.target as HTMLSelectElement).value || null; wijzig()"><option value="">{{ k === 'fase' ? 'Geen fase' : 'Elke fase' }}</option><option v-for="x in fases" :key="x.id" :value="x.id">{{ x.label }}</option></select>
              </label>
              <label v-else-if="k === 'actiesoort'" class="veld"><span class="veld-label">{{ PARAM_INFO[k]?.label }}</span>
                <select v-model="regel.data.trigger.parameters[k]" class="invoer" :disabled="vast" :data-test="`param-${k}`" @change="wijzig"><option value="bellen">Bellen</option><option value="bezoek">Bezoek</option><option value="geen">Geen</option></select>
              </label>
              <fieldset v-else-if="k === 'signaalsoorten'" class="veld rp-groep rp-breed"><legend class="veld-label">{{ PARAM_INFO[k]?.label }}</legend>
                <div class="rp-vinkjes"><label v-for="s in SIGNAALSOORTEN" :key="s" class="rp-vinkje"><input type="checkbox" :checked="(regel.data.trigger.parameters[k] ?? []).includes(s)" :disabled="ro" @change="wisselSignaal(s)"> {{ s }}</label></div>
              </fieldset>
              <label v-else-if="typeof patroonInfo.parameters[k] === 'boolean'" class="rp-vinkje rp-vinkje--los" :title="PARAM_INFO[k]?.uitleg"><input v-model="regel.data.trigger.parameters[k]" type="checkbox" :disabled="ro" :data-test="`param-${k}`" @change="wijzig"> {{ PARAM_INFO[k]?.label ?? k }}</label>
              <label v-else class="veld"><span class="veld-label">{{ PARAM_INFO[k]?.label ?? k }}<template v-if="PARAM_INFO[k]?.eenheid"> ({{ PARAM_INFO[k]?.eenheid }})</template></span>
                <input v-model.number="regel.data.trigger.parameters[k]" type="number" min="0" class="invoer tnum" :disabled="ro" :data-test="`param-${k}`" :title="PARAM_INFO[k]?.uitleg" @input="wijzig">
              </label>
            </template>
          </div>
          <p v-else class="meta">Dit patroon heeft geen instellingen; het volgt de gegevens van de prospect.</p>
          <p v-if="uitlegOpen.has('triggerParameters')" class="rp-uitleg">{{ REGEL_UITLEG.triggerParameters }}</p>
        </div>
        <div class="veld rp-breed rp-groep">
          <span class="veld-label">Afbakening<button type="button" class="rp-info" :aria-expanded="uitlegOpen.has('afbakening')" aria-label="Uitleg over afbakening" @click="wisselUitleg('afbakening')"><Icoon naam="Info" :grootte="15" /></button></span>
          <p class="meta" data-test="alleen-prospects">Regels gelden alleen voor prospects. Klanten volgen het ritme in DealDrive.</p>
          <div class="rp-vinkjes" aria-label="Status"><span class="rp-vinkjes-label">Status</span><label v-for="s in NB_STATUSSEN" :key="s" class="rp-vinkje"><input type="checkbox" :checked="(regel.data.afbakening.statussen ?? []).includes(s)" :disabled="vast" @change="lijstVeld('statussen', s)"> {{ s }}</label></div>
          <div class="rp-vinkjes" aria-label="Klasse"><span class="rp-vinkjes-label">Klasse</span><label v-for="k in ['A', 'B', 'C', 'D']" :key="k" class="rp-vinkje"><input type="checkbox" :checked="(regel.data.afbakening.klassen ?? []).includes(k)" :disabled="ro" :data-test="`klasse-${k}`" @change="lijstVeld('klassen', k)"> {{ k }}</label><span v-if="!(regel.data.afbakening.klassen ?? []).length" class="meta rp-alle">alle</span></div>
          <div v-if="keuzes.doelgroepen.length" class="rp-vinkjes" aria-label="Doelgroep"><span class="rp-vinkjes-label">Doelgroep</span><label v-for="d in keuzes.doelgroepen" :key="d.id" class="rp-vinkje"><input type="checkbox" :checked="(regel.data.afbakening.doelgroepIds ?? []).includes(d.id)" :disabled="vast" @change="lijstVeld('doelgroepIds', d.id)"> {{ d.naam }}</label></div>
          <p v-if="uitlegOpen.has('afbakening')" class="rp-uitleg">{{ REGEL_UITLEG.afbakening }}</p>
        </div>
      </div>
    </section>

    <section class="rp-sectie" aria-labelledby="rp-gevolg">
      <h3 id="rp-gevolg" class="rp-sectie-titel">Gevolg</h3>
      <div class="rp-raster">
        <div class="veld">
          <span class="veld-label"><label for="rp-actiesoort">Actiesoort</label><button type="button" class="rp-info" :aria-expanded="uitlegOpen.has('actiesoort')" aria-label="Uitleg over actiesoort" @click="wisselUitleg('actiesoort')"><Icoon naam="Info" :grootte="15" /></button></span>
          <select id="rp-actiesoort" v-model="regel.data.gevolg.actiesoort" class="invoer" :disabled="vast" data-test="veld-actiesoort" @change="wijzig"><option v-for="a in ACTIESOORTEN" :key="a" :value="a">{{ ACTIESOORT_LABEL[a] }}</option></select>
          <p v-if="uitlegOpen.has('actiesoort')" class="rp-uitleg">{{ REGEL_UITLEG.actiesoort }}</p>
        </div>
        <div class="veld">
          <span class="veld-label"><label for="rp-uitv">Uitvoerder</label><button type="button" class="rp-info" :aria-expanded="uitlegOpen.has('uitvoerder')" aria-label="Uitleg over uitvoerder" @click="wisselUitleg('uitvoerder')"><Icoon naam="Info" :grootte="15" /></button></span>
          <select id="rp-uitv" v-model="regel.data.gevolg.uitvoerderrol" class="invoer" :disabled="vast" @change="wijzig"><option v-for="u in UITVOERDERROLLEN" :key="u" :value="u">{{ ROL_LABEL[u] }}</option></select>
          <p v-if="uitlegOpen.has('uitvoerder')" class="rp-uitleg">{{ REGEL_UITLEG.uitvoerder }}</p>
        </div>
        <div class="veld">
          <span class="veld-label"><label for="rp-term">Termijn</label><button type="button" class="rp-info" :aria-expanded="uitlegOpen.has('termijn')" aria-label="Uitleg over termijn" @click="wisselUitleg('termijn')"><Icoon naam="Info" :grootte="15" /></button></span>
          <select id="rp-term" v-model.number="regel.data.gevolg.termijnWerkdagen" class="invoer" :disabled="vast" @change="wijzig"><option v-for="t in TERMIJNEN" :key="t.werkdagen" :value="t.werkdagen">{{ t.label }}</option></select>
          <p v-if="uitlegOpen.has('termijn')" class="rp-uitleg">{{ REGEL_UITLEG.termijn }}</p>
        </div>
        <div class="veld">
          <span class="veld-label">Pitstop<button type="button" class="rp-info" :aria-expanded="uitlegOpen.has('pitstop')" aria-label="Uitleg over Pitstop" @click="wisselUitleg('pitstop')"><Icoon naam="Info" :grootte="15" /></button></span>
          <label class="rp-vinkje rp-vinkje--los"><input v-model="regel.data.gevolg.automatischVoorbereiden" type="checkbox" :disabled="vast || regel.data.activiteit !== 'taak'" data-test="veld-pitstop" @change="wijzig"> Automatisch voorbereiden</label>
          <p v-if="uitlegOpen.has('pitstop')" class="rp-uitleg">{{ REGEL_UITLEG.pitstop }}</p>
        </div>
        <div class="veld rp-breed">
          <span class="veld-label"><label for="rp-sjab">Taaksjabloon</label><button type="button" class="rp-info" :aria-expanded="uitlegOpen.has('taaksjabloon')" aria-label="Uitleg over taaksjabloon" @click="wisselUitleg('taaksjabloon')"><Icoon naam="Info" :grootte="15" /></button></span>
          <input id="rp-sjab" v-model="regel.data.gevolg.taaksjabloon" class="invoer" :disabled="vast" data-test="veld-sjabloon" placeholder="Bel {contact} van {account} over {winpunt}" @input="wijzig">
          <span v-for="x in sjabloonFouten(regel.data.gevolg.taaksjabloon ?? '')" :key="x" class="veld-fout">{{ x }}</span>
          <p v-if="uitlegOpen.has('taaksjabloon')" class="rp-uitleg">{{ REGEL_UITLEG.taaksjabloon }}</p>
        </div>
        <fieldset class="veld rp-breed rp-groep" data-test="veld-winpunten">
          <legend class="veld-label">Winpunten als gespreksonderwerp<button type="button" class="rp-info" :aria-expanded="uitlegOpen.has('winpunten')" aria-label="Uitleg over winpunten" @click="wisselUitleg('winpunten')"><Icoon naam="Info" :grootte="15" /></button></legend>
          <p v-if="uitlegOpen.has('winpunten')" class="rp-uitleg">{{ REGEL_UITLEG.winpunten }}</p>
          <p v-if="!keuzes.winpunten.length" class="meta">Er zijn nog geen bevestigde winpunten. <FunctieLink to="/instellingen/verkoopverhaal" class="tekst-link">Leg ze vast in het verkoopverhaal</FunctieLink>.</p>
          <ul v-else class="rp-winpunten">
            <li v-for="w in keuzes.winpunten" :key="w.id" class="rp-winpunt" :class="{ 'rp-winpunt--aan': winpuntIds.includes(w.id) }">
              <label class="rp-winpunt-keuze">
                <input type="checkbox" :checked="winpuntIds.includes(w.id)" :disabled="vast || (!winpuntIds.includes(w.id) && winpuntIds.length >= 5)" :data-test="`winpunt-${w.id}`" @change="wisselWinpunt(w.id)">
                <span><strong>{{ w.titel }}</strong><span v-if="w.omschrijving" class="meta rp-winpunt-oms">{{ w.omschrijving }}</span></span>
              </label>
              <span class="rp-winpunt-labels">
                <Label v-if="w.hoofdfase" soort="fase" :waarde="w.hoofdfase" :tekst="HOOFDFASE_LABEL[w.hoofdfase as Hoofdfase] ?? w.hoofdfase" />
                <span v-if="w.hoofdfase && hoofdfasenVanRegel.has(w.hoofdfase)" class="meta rp-past">past bij de fases van deze regel</span>
              </span>
            </li>
          </ul>
        </fieldset>
        <div class="veld">
          <span class="veld-label"><label for="rp-sig">Signaaltype</label><button type="button" class="rp-info" :aria-expanded="uitlegOpen.has('signaaltype')" aria-label="Uitleg over signaaltype" @click="wisselUitleg('signaaltype')"><Icoon naam="Info" :grootte="15" /></button></span>
          <input id="rp-sig" v-model="regel.data.gevolg.signaaltype" class="invoer" :disabled="vast" @input="wijzig">
          <p v-if="uitlegOpen.has('signaaltype')" class="rp-uitleg">{{ REGEL_UITLEG.signaaltype }}</p>
        </div>
        <div class="veld">
          <span class="veld-label"><label for="rp-verw">Verwacht resultaat{{ verwachtVast ? ' (vast)' : '' }}</label><button type="button" class="rp-info" :aria-expanded="uitlegOpen.has('verwachtResultaat')" aria-label="Uitleg over verwacht resultaat" @click="wisselUitleg('verwachtResultaat')"><Icoon naam="Info" :grootte="15" /></button></span>
          <p v-if="verwachtVast" class="rp-vast" data-test="veld-verwacht">{{ regel.data.gevolg.verwachtResultaat }}</p>
          <input v-else id="rp-verw" v-model="regel.data.gevolg.verwachtResultaat" class="invoer" :disabled="vast" placeholder="Bijvoorbeeld: eerste afspraak" @input="wijzig">
          <p v-if="uitlegOpen.has('verwachtResultaat')" class="rp-uitleg">{{ REGEL_UITLEG.verwachtResultaat }}</p>
        </div>
      </div>
    </section>

    <section class="rp-sectie" aria-labelledby="rp-voorbeeld" data-test="voorbeeld">
      <h3 id="rp-voorbeeld" class="rp-sectie-titel">Zo verschijnt hij in de takenlijst</h3>
      <p class="meta">Live voorbeeld met de fictieve prospect Testinstallatie Koperwiek.</p>
      <article class="rp-taak">
        <div class="rp-taak-labels">
          <Label soort="actie" :waarde="regel.data.gevolg.actiesoort" />
          <span class="pil" :class="regel.data.activiteit === 'taak' ? 'pil--leeg' : 'pil--grijs'">{{ regel.data.activiteit === 'taak' ? 'Taak' : 'Inzicht' }}</span>
          <Label soort="herkomst" waarde="regel" />
          <Label soort="prioriteit" :waarde="regel.prioriteit" />
        </div>
        <strong class="rp-taak-titel">{{ voorbeeld }}</strong>
        <p v-if="gekozenWinpunten.length" class="rp-taak-meta" data-test="voorbeeld-winpunt">Gespreksonderwerp: {{ gekozenWinpunten[0].titel }}</p>
        <p class="rp-taak-meta">{{ ROL_LABEL[regel.data.gevolg.uitvoerderrol] }} · prioriteit {{ PRIO_LABEL[regel.prioriteit]?.toLowerCase() }} · {{ (keuzes.cadansen.find((c: any) => c.dagen === regel.cadansDagen)?.label ?? '').toLowerCase() }}</p>
        <p class="rp-taak-meta">Waarom krijg ik dit? {{ regel.data.omschrijving }} {{ regel.trigger }}</p>
        <p v-if="regel.motor === 'ai'" class="rp-taak-meta">AI-regel: de agent schrijft de tekst per prospect; dit is de terugvaltekst.</p>
      </article>
    </section>

    <section v-if="droog" class="rp-sectie" aria-labelledby="rp-droog" data-test="droogloop">
      <h3 id="rp-droog" class="rp-sectie-titel">Droogloop</h3>
      <p>Deze regel raakt nu <strong class="tnum">{{ droog.geraakt }}</strong> {{ droog.geraakt === 1 ? 'account' : 'accounts' }} en maakt bij de volgende run <strong class="tnum">{{ droog.taken }}</strong> {{ droog.taken === 1 ? 'taak' : 'taken' }}.</p>
      <ul v-if="droog.perPersoon.length" class="rp-personen"><li v-for="p in droog.perPersoon" :key="p.id"><span>{{ p.naam.replace(/^Testgebruiker /, '') }}</span><span class="tnum">{{ p.taken }}</span></li></ul>
      <ul v-if="droog.accounts?.length" class="rp-geraakt" data-test="droogloop-accounts">
        <li v-for="a in droog.accounts" :key="a.id" class="rp-geraakt-rij">
          <span class="rp-geraakt-naam"><FunctieLink :to="`/accounts/${a.id}`" class="tekst-link" als-tekst>{{ a.naam }}</FunctieLink><span class="meta">{{ a.reden }}<template v-if="a.eigenaar"> · {{ a.eigenaar.replace(/^Testgebruiker /, '') }}</template></span></span>
          <span class="rp-geraakt-labels">
            <span v-if="a.winpunt" class="pil pil--leeg" data-test="droogloop-winpunt"><Icoon naam="Trophy" :grootte="13" />{{ a.winpunt }}</span>
            <span class="meta">{{ a.maaktTaak ? (regel.data.activiteit === 'taak' ? 'maakt een taak' : 'maakt een inzicht') : 'staat al open of cadans' }}</span>
          </span>
        </li>
      </ul>
      <p v-if="droog.meerAccounts" class="meta">En nog {{ droog.meerAccounts }} {{ droog.meerAccounts === 1 ? 'account' : 'accounts' }}.</p>
    </section>

    <section v-if="leesStand && kan.persoonlijk && regel.scope !== 'persoonlijk' && !klein" class="rp-sectie">
      <label class="veld"><span class="veld-label">Stel wijziging voor</span><textarea v-model="voorstelTekst" class="invoer" rows="2" data-test="voorstel-tekst" /></label>
      <button type="button" class="dd-act mt-8" :disabled="!voorstelTekst.trim()" data-test="stel-voor" @click="emit('stelVoor', voorstelTekst); voorstelTekst = ''">Stel wijziging voor</button>
    </section>
    <p v-if="!leesStand" class="meta rp-hint">Wijzigingen worden per veld direct bewaard. Er is geen aparte opslaanknop.</p>
  </div>
</template>

<style scoped>
.rp { background: var(--wit); border: 1px solid var(--border); border-left: 3px solid var(--yellow); }
.rp-kop { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; padding: 16px 20px; background: var(--surface); border-bottom: 1px solid var(--border); }
.rp-code { font-family: var(--font-mono); font-size: 11px; font-weight: 700; letter-spacing: 0.06em; padding: 4px 8px; border: 1px solid var(--border-strong); background: var(--wit); }
.rp-titel { flex: 1 1 200px; margin: 0; font-family: var(--font-serif); font-size: 22px; font-weight: 700; color: var(--ink); }
.rp-status { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; }
.rp-melding { margin: 16px 20px 0; }
.rp-sectie { padding: 18px 20px; border-bottom: 1px solid var(--border); }
.rp-sectie:last-of-type { border-bottom: 0; }
.rp-sectie-titel { margin: 0 0 12px; font-family: var(--font-mono); font-size: var(--fs-label); font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-soft); }
.rp-raster { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 16px; }
.rp-breed { grid-column: 1 / -1; }
.rp .veld-label { display: inline-flex; align-items: center; gap: 4px; }
.rp-info { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; padding: 0; background: none; border: 0; color: var(--muted); cursor: pointer; }
.rp-info:hover, .rp-info[aria-expanded='true'] { color: var(--ink); }
.rp-uitleg { margin: 6px 0 0; padding: 10px 12px; border-left: 3px solid var(--yellow); background: var(--surface); font-size: 13px; line-height: 1.5; color: var(--ink-soft); }
.rp-groep { border: 0; padding: 0; margin: 0; min-width: 0; }
.rp-groep legend { padding: 0; margin-bottom: 6px; }
.rp-vinkjes { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; margin-top: 6px; }
.rp-vinkjes-label { min-width: 64px; font-size: 12px; font-weight: 700; color: var(--ink-soft); }
.rp-vinkje { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; font-size: 14px; }
.rp-vinkje--los { margin-top: 4px; }
.rp-alle { font-style: italic; }
.rp-geldt { margin: -6px 0 12px; }
.rp-params { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 16px; margin-top: 8px; }
.rp-overgang { display: flex; align-items: flex-end; gap: 6px; margin-top: 8px; }
.rp-overgang .veld { flex: 1; }
.rp-winpunten { list-style: none; margin: 6px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.rp-winpunt { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 12px; padding: 8px 10px; border: 1px solid var(--border); }
.rp-winpunt--aan { border-color: var(--ink); background: var(--surface); }
.rp-winpunt-keuze { display: flex; align-items: flex-start; gap: 8px; flex: 1 1 260px; min-height: 32px; }
.rp-winpunt-keuze input { margin-top: 3px; }
.rp-winpunt-oms { display: block; }
.rp-winpunt-labels { display: inline-flex; align-items: center; gap: 8px; }
.rp-past { font-size: 12px; }
.rp-vast { margin: 0; padding: 10px 12px; background: var(--surface); font-family: var(--font-serif); font-weight: 700; }
.rp-taak { display: flex; flex-direction: column; gap: 6px; padding: 14px 16px; border: 1px solid var(--border); background: var(--surface); }
.rp-taak-labels { display: flex; flex-wrap: wrap; gap: 6px; }
.rp-taak-titel { font-size: 15px; }
.rp-taak-meta { margin: 0; font-size: 12px; color: var(--muted); }
.rp-personen, .rp-geraakt { list-style: none; margin: 8px 0 0; padding: 0; }
.rp-personen li { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid var(--border); font-size: 14px; }
.rp-geraakt-rij { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 12px; padding: 8px 0; border-bottom: 1px solid var(--border); }
.rp-geraakt-naam { display: flex; flex-direction: column; min-width: 0; }
.rp-geraakt-labels { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.rp-geraakt-labels .pil { display: inline-flex; align-items: center; gap: 4px; }
.rp-hint { padding: 0 20px 16px; font-style: italic; }
@media (max-width: 767px) {
  .rp-kop, .rp-sectie { padding-left: 16px; padding-right: 16px; }
  .rp-raster, .rp-params { grid-template-columns: 1fr; }
  .rp-info { width: var(--touch-target-min); height: var(--touch-target-min); }
  .rp-vinkje { min-height: var(--touch-target-min); }
}
</style>
