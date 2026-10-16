<script setup lang="ts">
// Eén gegeven met inline bewerken (opzet uit DealDrive, EditableField): label links, de waarde rechts; het
// potlood (of een klik op de waarde) opent een invoer met opslaan en annuleren, Escape annuleert. Leeg toont
// "+ Voeg ... toe". Een link (website, LinkedIn, telefoon, e-mail) is klikbaar, een webadres met ↗.
import { toonTelefoon } from '~/utils/accountWeergave'
type Soort = 'text' | 'tel' | 'email' | 'url' | 'select' | 'number' | 'date' | 'textarea'
const props = withDefaults(defineProps<{
  label: string
  waarde?: string | number | null
  type?: Soort
  leeg?: string
  opties?: { waarde: string; label: string }[]
  /** Alleen lezen: geen potlood. */
  uit?: boolean
  test?: string
}>(), { waarde: '', type: 'text', leeg: '', opties: () => [], uit: false, test: undefined })
const emit = defineEmits<{ bewaar: [waarde: string] }>()

const huidig = ref(String(props.waarde ?? ''))
watch(() => props.waarde, (w) => { if (!bewerkt.value) huidig.value = String(w ?? '') })
const bewerkt = ref(false)
const concept = ref('')
const invoer = ref<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>(null)
const heeftWaarde = computed(() => huidig.value.trim().length > 0)
const leegTekst = computed(() => props.leeg || `+ Voeg ${props.label.toLowerCase()} toe`)
const href = computed(() => {
  const v = huidig.value.trim()
  if (!v) return null
  if (props.type === 'tel') return `tel:${v.replace(/[^\d+]/g, '')}`
  if (props.type === 'email') return `mailto:${v}`
  if (props.type === 'url') return /^https?:\/\//i.test(v) ? v : `https://${v}`
  return null
})
const tekst = computed(() => {
  const v = huidig.value
  if (props.type === 'tel') return toonTelefoon(v)
  if (props.type === 'url') return v.replace(/^https?:\/\//i, '').replace(/\/$/, '')
  if (props.type === 'select') return props.opties.find((o) => o.waarde === v)?.label ?? v
  if (props.type === 'date') {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/)
    return m ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00`)) : v
  }
  return v
})
const invoerType = computed(() => ({ tel: 'tel', email: 'email', url: 'url', number: 'number', date: 'date' } as Record<string, string>)[props.type] ?? 'text')

async function start() {
  if (props.uit) return
  concept.value = props.type === 'date' ? huidig.value.slice(0, 10) : huidig.value
  bewerkt.value = true
  await nextTick()
  invoer.value?.focus()
  if (invoer.value instanceof HTMLInputElement && props.type !== 'date' && props.type !== 'number') invoer.value.select()
}
function annuleer() { bewerkt.value = false; concept.value = '' }
function bewaar() {
  const nieuw = concept.value.trim()
  bewerkt.value = false
  if (nieuw === (props.type === 'date' ? huidig.value.slice(0, 10) : huidig.value)) return
  huidig.value = nieuw
  emit('bewaar', nieuw)
}
</script>

<template>
  <div class="bv" :class="{ 'bv--leeg': !heeftWaarde, 'bv--bewerk': bewerkt }" :data-test="test">
    <span class="bv-label">{{ label }}</span>
    <div v-if="!bewerkt" class="bv-weergave">
      <button v-if="!heeftWaarde && !uit" type="button" class="bv-leeg" :data-test="test ? `${test}-leeg` : undefined" @click="start">{{ leegTekst }}</button>
      <span v-else-if="!heeftWaarde" class="bv-leeg bv-leeg--lees">–</span>
      <a v-else-if="href" :href="href" class="bv-waarde bv-waarde--link" :target="type === 'url' ? '_blank' : undefined" :rel="type === 'url' ? 'noopener noreferrer' : undefined"><span>{{ tekst }}</span><span v-if="type === 'url'" class="bv-ext" aria-hidden="true">↗</span></a>
      <span v-else class="bv-waarde" :data-test="test ? `${test}-waarde` : undefined">{{ tekst }}</span>
      <slot name="na" />
      <button v-if="!uit" type="button" class="bv-potlood" :aria-label="`Bewerk ${label.toLowerCase()}`" :data-test="test ? `${test}-bewerk` : undefined" @click="start"><Icoon naam="Pencil" :grootte="14" /></button>
    </div>
    <form v-else class="bv-bewerk" @submit.prevent="bewaar">
      <select v-if="type === 'select'" ref="invoer" v-model="concept" class="invoer bv-invoer" :aria-label="label" @keydown.escape.stop.prevent="annuleer"><option v-for="o in opties" :key="o.waarde" :value="o.waarde">{{ o.label }}</option></select>
      <textarea v-else-if="type === 'textarea'" ref="invoer" v-model="concept" class="invoer bv-invoer" rows="3" :aria-label="label" @keydown.escape.stop.prevent="annuleer" />
      <input v-else ref="invoer" v-model="concept" class="invoer bv-invoer" :type="invoerType" :aria-label="label" :data-test="test ? `${test}-invoer` : undefined" @keydown.escape.stop.prevent="annuleer">
      <button type="button" class="bv-knop" aria-label="Annuleren" @click="annuleer"><Icoon naam="X" :grootte="14" /></button>
      <button type="submit" class="bv-knop bv-knop--bewaar" aria-label="Opslaan" :data-test="test ? `${test}-bewaar` : undefined"><Icoon naam="Check" :grootte="14" /></button>
    </form>
  </div>
</template>

<style scoped>
.bv { display: grid; grid-template-columns: 116px minmax(0, 1fr); gap: 12px; align-items: center; padding: 6px 0; border-bottom: 1px dashed transparent; }
.bv:hover { border-bottom-color: var(--border); }
.bv-label { font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.bv-weergave { display: flex; align-items: center; gap: 8px; min-height: 32px; min-width: 0; }
.bv-waarde { font-size: 14px; color: var(--ink); overflow-wrap: anywhere; }
.bv-waarde--link { display: inline-flex; align-items: center; gap: 4px; text-decoration: none; border-bottom: 1px solid var(--border-strong); }
.bv-waarde--link:hover { border-bottom-color: var(--ink); color: var(--ink-soft); }
.bv-ext { font-size: 11px; font-weight: 700; color: var(--muted); }
.bv-leeg { padding: 0; border: 0; background: none; font: inherit; font-size: 13px; font-style: italic; color: var(--muted); text-align: left; cursor: pointer; }
.bv-leeg:hover { color: var(--ink); }
.bv-leeg--lees { cursor: default; font-style: normal; }
.bv-potlood { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 32px; height: 32px; margin-left: auto; padding: 0; border: 1px solid transparent; border-radius: 2px; background: none; color: var(--muted); cursor: pointer; opacity: 0; }
.bv:hover .bv-potlood, .bv-potlood:focus-visible, .bv--leeg .bv-potlood { opacity: 1; }
.bv--leeg .bv-potlood { opacity: 0.6; }
.bv-potlood:hover { border-color: var(--border-strong); background: var(--bg); color: var(--ink); }
.bv-bewerk { display: flex; gap: 6px; align-items: stretch; min-width: 0; }
.bv-invoer { flex: 1; min-width: 0; min-height: 34px; }
.bv-knop { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 34px; min-height: 34px; padding: 0; border: 1px solid var(--border-strong); border-radius: 2px; background: var(--wit); color: var(--muted); cursor: pointer; }
.bv-knop:hover { border-color: var(--ink); color: var(--ink); }
.bv-knop--bewaar { background: var(--ink); border-color: var(--ink); color: var(--yellow); }
@media (hover: none) { .bv-potlood { opacity: 1; } }
@media (max-width: 767px) {
  .bv { grid-template-columns: 1fr; gap: 2px; }
  .bv-weergave { min-height: 44px; }
  .bv-potlood, .bv-knop { width: 44px; height: 44px; min-height: 44px; }
  .bv-leeg { min-height: 44px; }
}
</style>
