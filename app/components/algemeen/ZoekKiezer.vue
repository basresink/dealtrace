<script setup lang="ts" generic="T extends { id: string; naam: string }">
// Eén zoekveld met type-ahead voor prospects, klanten en contacten, overal waar je er een kiest (Nieuwe taak,
// taakvenster, Plan een afspraak, Inzicht, kennisbank, Nieuw contact, Accountplan, campagnes, briefings,
// belscripts, opvolgreeksen, contact verhuizen). Opzet van DealDrive: label boven het veld (`kop`), gele
// focusrand en zodra het veld focus krijgt meteen een lijst; zes rijen in beeld ("naam · branche" of
// "naam · functie", de toevoeging gedempt), scrollen voor meer. Typen filtert, pijltjes en Enter kiezen,
// Escape sluit. De bron (`zoek`) bepaalt de volgorde: eigen recente of actieve prospects eerst. `min` is het
// aantal tekens voor er gezocht wordt (standaard 0: de lijst staat er al bij focus). `sleutel` wist de
// treffers als de bron wijzigt. Met `gekozen` toont het veld de keuze met een wisknop in plaats van het
// zoekveld (event `wis`).
const props = withDefaults(defineProps<{
  zoek: (q: string) => Promise<T[]> | T[]
  placeholder?: string
  kop?: string
  label?: string
  labelledby?: string
  dataTest?: string
  optieTest?: (t: T) => string
  sub?: (t: T) => string | null | undefined
  min?: number
  max?: number
  leeg?: string
  laadTekst?: string
  sleutel?: string | number | null
  gekozen?: T | null
  gekozenTest?: string
  wisLabel?: string
}>(), { placeholder: 'Zoek op naam…', kop: undefined, label: undefined, labelledby: undefined, dataTest: undefined, optieTest: undefined, sub: undefined, min: 0, max: 30, leeg: 'Niets gevonden.', laadTekst: 'Zoeken…', sleutel: null, gekozen: undefined, gekozenTest: undefined, wisLabel: 'Wis de keuze' })
const emit = defineEmits<{ kies: [t: T]; wis: [] }>()

const id = useId()
const invoer = ref<HTMLInputElement | null>(null)
const lijst = ref<HTMLElement | null>(null)
const tekst = ref('')
const actief = ref(false)
const treffers = ref<T[]>([]) as Ref<T[]>
const gezocht = ref(false)
const laadt = ref(false)
const index = ref(-1)
let timer: ReturnType<typeof setTimeout> | undefined
let nr = 0

const genoeg = computed(() => tekst.value.trim().length >= props.min)
const zichtbaar = computed(() => treffers.value.slice(0, props.max))
const open = computed(() => actief.value && zichtbaar.value.length > 0)
const toonLeeg = computed(() => actief.value && genoeg.value && !zichtbaar.value.length && (gezocht.value || laadt.value))

async function zoekNu() {
  const q = tekst.value.trim()
  const mijn = ++nr
  if (q.length < props.min) { treffers.value = []; gezocht.value = false; laadt.value = false; return }
  laadt.value = true
  let r: T[] = []
  try { r = await props.zoek(q) } catch { r = [] }
  if (mijn !== nr) return
  treffers.value = r ?? []
  index.value = treffers.value.length ? 0 : -1
  gezocht.value = true
  laadt.value = false
  if (lijst.value) lijst.value.scrollTop = 0
}
// Typen filtert de lijst die er al staat meteen op naam (geen verouderde rijen om op te klikken); de bron
// vult hem daarna aan, ook met treffers op functie.
watch(tekst, (nieuw) => {
  clearTimeout(timer)
  if (import.meta.client && document.activeElement === invoer.value) actief.value = true
  if (!genoeg.value) { nr++; treffers.value = []; gezocht.value = false; laadt.value = false; return }
  const z = nieuw.trim().toLowerCase()
  treffers.value = treffers.value.filter((t) => t.naam.toLowerCase().includes(z))
  index.value = treffers.value.length ? 0 : -1
  laadt.value = true
  timer = setTimeout(zoekNu, 200)
})
watch(() => props.sleutel, () => { nr++; treffers.value = []; gezocht.value = false; if (actief.value) zoekNu() })
function opFocus() { actief.value = true; if (genoeg.value && !gezocht.value && !laadt.value) zoekNu() }
function opBlur() { actief.value = false }
function opKlik() { if (!actief.value) opFocus() }
function kies(t: T) {
  emit('kies', t)
  clearTimeout(timer); nr++
  tekst.value = ''
  treffers.value = []; gezocht.value = false; index.value = -1
  actief.value = false
}
// De actieve rij blijft in beeld als je met de pijltjes door een lange lijst loopt.
function inBeeld() { nextTick(() => lijst.value?.querySelector<HTMLElement>(`#${CSS.escape(`${id}-o${index.value}`)}`)?.scrollIntoView({ block: 'nearest' })) }
function toets(e: KeyboardEvent) {
  if (e.key === 'ArrowDown' && zichtbaar.value.length) { e.preventDefault(); if (!actief.value) { actief.value = true; return } index.value = (index.value + 1) % zichtbaar.value.length; inBeeld() }
  else if (e.key === 'ArrowDown' && !actief.value) { e.preventDefault(); opFocus() }
  else if (e.key === 'ArrowUp' && zichtbaar.value.length) { e.preventDefault(); actief.value = true; index.value = (index.value - 1 + zichtbaar.value.length) % zichtbaar.value.length; inBeeld() }
  else if (e.key === 'Enter' && open.value && index.value >= 0) { e.preventDefault(); kies(zichtbaar.value[index.value]!) }
  else if (e.key === 'Escape' && actief.value && (open.value || toonLeeg.value)) { e.preventDefault(); e.stopPropagation(); actief.value = false }
}
defineExpose({ focus: () => invoer.value?.focus() })
</script>

<template>
  <div class="zk">
    <label v-if="kop" :for="`${id}-veld`" class="veld-label zk-kop">{{ kop }}</label>
    <div v-if="gekozen" class="zoek-keuze" :data-test="gekozenTest">
      <span class="zoek-keuze-tekst">{{ gekozen.naam }}<span v-if="sub && sub(gekozen)" class="zoek-keuze-sub"> · {{ sub(gekozen) }}</span></span>
      <button type="button" class="zoek-keuze-wis zk-wis" :aria-label="wisLabel" @click="emit('wis')">×</button>
    </div>
    <div v-else class="zoekveld">
      <input
        :id="`${id}-veld`" ref="invoer" v-model="tekst" class="invoer zk-invoer" type="text" role="combobox" autocomplete="off"
        :placeholder="placeholder" :aria-label="labelledby || kop ? undefined : label" :aria-labelledby="labelledby"
        aria-autocomplete="list" :aria-expanded="open" :aria-controls="`${id}-lijst`"
        :aria-activedescendant="open && index >= 0 ? `${id}-o${index}` : undefined"
        :data-test="dataTest" @focus="opFocus" @blur="opBlur" @click="opKlik" @keydown="toets"
      >
      <ul v-if="open" :id="`${id}-lijst`" ref="lijst" class="zoeklijst zk-lijst" role="listbox" data-test="zoekkiezer-lijst" @mousedown.prevent>
        <li v-for="(t, i) in zichtbaar" :id="`${id}-o${i}`" :key="t.id" role="option" :aria-selected="i === index">
          <button type="button" tabindex="-1" class="zoeklijst-item zk-item" :class="{ 'zoeklijst-item--actief': i === index }" :data-test="optieTest ? optieTest(t) : undefined" @mousedown.prevent @mouseenter="index = i" @click="kies(t)">
            <slot name="optie" :item="t"><span class="zk-naam">{{ t.naam }}</span><span v-if="sub && sub(t)" class="zoeklijst-sub zk-sub"> · {{ sub(t) }}</span></slot>
          </button>
        </li>
      </ul>
      <p v-else-if="toonLeeg" class="zoeklijst-leeg zk-leeg" role="status">{{ laadt ? laadTekst : leeg }}</p>
    </div>
  </div>
</template>

<style scoped>
/* Zes rijen in beeld, de rest scrolt. Op de telefoon is elke rij een tikdoel van 44 px. */
.zk { --zk-rij: 41px; }
@media (max-width: 767px) { .zk { --zk-rij: var(--touch-target-min); } }
.zk-kop { display: block; }
.zk .zk-invoer { width: 100%; }
.zk .zk-invoer:focus { border-color: var(--yellow); outline: 1px solid var(--yellow); outline-offset: -2px; }
.zk .zk-lijst { max-height: calc(6 * var(--zk-rij) + 1px); box-sizing: border-box; overflow-y: auto; overscroll-behavior: contain; background: var(--surface); }
.zk-item { display: block; box-sizing: border-box; height: var(--zk-rij); min-height: var(--zk-rij); padding: 0 12px; overflow: hidden; color: var(--ink); font-size: var(--fs-klein); font-weight: 400; line-height: calc(var(--zk-rij) - 1px); text-overflow: ellipsis; white-space: nowrap; }
.zk-lijst li:last-child .zk-item { border-bottom: 0; }
.zk .zk-item.zoeklijst-item--actief,
.zk .zk-item:hover { background: var(--wit); }
.zk-naam { font-weight: 400; }
.zk-sub { color: var(--muted); font-size: var(--fs-meta); }
.zk-leeg { position: absolute; top: 100%; left: 0; right: 0; z-index: 5; }
.zk-wis { width: var(--touch-target-min); height: var(--touch-target-min); }
</style>
