<script setup lang="ts" generic="T extends { id: string; naam: string }">
// Eén zoekveld met type-ahead voor prospects, klanten en contacten (Nieuwe taak, Plan een afspraak,
// Inzicht, Nieuw contact, Accountplan, campagnes). Tijdens het typen verschijnt direct onder het veld een
// lijst met hooguit zes treffers; pijltjes en Enter kiezen, Escape sluit. Met `min` 0 toont het veld al
// treffers bij focus (de contacten van een gekozen klant). `sleutel` wist de treffers als de bron wijzigt.
const props = withDefaults(defineProps<{
  zoek: (q: string) => Promise<T[]> | T[]
  placeholder?: string
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
}>(), { placeholder: 'Zoek op naam…', label: undefined, labelledby: undefined, dataTest: undefined, optieTest: undefined, sub: undefined, min: 2, max: 6, leeg: 'Niets gevonden.', laadTekst: 'Zoeken…', sleutel: null })
const emit = defineEmits<{ kies: [t: T] }>()

const id = useId()
const invoer = ref<HTMLInputElement | null>(null)
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
}
watch(tekst, () => { clearTimeout(timer); if (import.meta.client && document.activeElement === invoer.value) actief.value = true; if (!genoeg.value) { nr++; treffers.value = []; gezocht.value = false; laadt.value = false; return } timer = setTimeout(zoekNu, 200) })
watch(() => props.sleutel, () => { nr++; treffers.value = []; gezocht.value = false; if (actief.value) zoekNu() })
function opFocus() { actief.value = true; if (props.min === 0 || (genoeg.value && !gezocht.value)) zoekNu() }
function opBlur() { actief.value = false }
function kies(t: T) {
  emit('kies', t)
  clearTimeout(timer); nr++
  tekst.value = ''
  treffers.value = []; gezocht.value = false; index.value = -1
  actief.value = false
}
function toets(e: KeyboardEvent) {
  if (e.key === 'ArrowDown' && zichtbaar.value.length) { e.preventDefault(); actief.value = true; index.value = (index.value + 1) % zichtbaar.value.length }
  else if (e.key === 'ArrowUp' && zichtbaar.value.length) { e.preventDefault(); index.value = (index.value - 1 + zichtbaar.value.length) % zichtbaar.value.length }
  else if (e.key === 'Enter' && open.value && index.value >= 0) { e.preventDefault(); kies(zichtbaar.value[index.value]!) }
  else if (e.key === 'Escape' && actief.value && (open.value || toonLeeg.value)) { e.preventDefault(); e.stopPropagation(); actief.value = false }
}
defineExpose({ focus: () => invoer.value?.focus() })
</script>

<template>
  <div class="zoekveld zk">
    <input
      ref="invoer" v-model="tekst" class="invoer" type="text" role="combobox" autocomplete="off"
      :placeholder="placeholder" :aria-label="labelledby ? undefined : label" :aria-labelledby="labelledby"
      aria-autocomplete="list" :aria-expanded="open" :aria-controls="`${id}-lijst`"
      :aria-activedescendant="open && index >= 0 ? `${id}-o${index}` : undefined"
      :data-test="dataTest" @focus="opFocus" @blur="opBlur" @keydown="toets"
    >
    <ul v-if="open" :id="`${id}-lijst`" class="zoeklijst" role="listbox" data-test="zoekkiezer-lijst">
      <li v-for="(t, i) in zichtbaar" :id="`${id}-o${i}`" :key="t.id" role="option" :aria-selected="i === index">
        <button type="button" tabindex="-1" class="zoeklijst-item zk-item" :class="{ 'zoeklijst-item--actief': i === index }" :data-test="optieTest ? optieTest(t) : undefined" @mousedown.prevent @mouseenter="index = i" @click="kies(t)">
          <slot name="optie" :item="t">{{ t.naam }}<span v-if="sub && sub(t)" class="zoeklijst-sub"> · {{ sub(t) }}</span></slot>
        </button>
      </li>
    </ul>
    <p v-else-if="toonLeeg" class="zoeklijst-leeg zk-leeg" role="status">{{ laadt ? laadTekst : leeg }}</p>
  </div>
</template>

<style scoped>
.zk .invoer { width: 100%; }
.zk .zoeklijst { max-height: none; }
.zk-item { min-height: var(--touch-target-min); }
.zk-leeg { position: absolute; top: 100%; left: 0; right: 0; z-index: 5; }
</style>
