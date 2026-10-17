<script setup lang="ts">
// Eén label uit het register (shared/labels.ts): <Label soort="rol" waarde="beslisser" />.
// Soorten met een eigen vorm: klasse (waarde is de klassenaam, "A · Groot"; zonder waarde "Geen klasse"),
// fase (waarde is de hoofdfase, tekst de fasenaam) en score (waarde is het getal). Een standaardwaarde
// (prioriteit middel, herkomst handmatig) toont niets. Met `knop` is het label een knop (fase opent de
// reisgeschiedenis). `vermoedelijk` toont een rol gestippeld met een vraagteken.
import { faseDef, klasseDef, labelDef, scoreDef, type LabelDef } from '~~/shared/labels'

const props = withDefaults(defineProps<{
  soort: string
  waarde?: string | number | null
  tekst?: string | null
  knop?: boolean
  uit?: boolean
  vermoedelijk?: boolean
  titel?: string
}>(), { waarde: null, tekst: null, knop: false, uit: false, vermoedelijk: false, titel: undefined })

const emit = defineEmits<{ click: [e: MouseEvent] }>()

const klasse = computed(() => (props.soort === 'klasse' ? klasseDef(props.waarde === null ? null : String(props.waarde)) : null))
const fase = computed(() => (props.soort === 'fase' ? faseDef(props.waarde === null ? null : String(props.waarde)) : null))

/** Gewone labels: de definitie uit het register, eventueel met eigen tekst. */
const def = computed<LabelDef | null>(() => {
  if (props.soort === 'klasse' || props.soort === 'fase') return null
  const d = props.soort === 'score' ? scoreDef(props.waarde === null ? null : Number(props.waarde)) : labelDef(props.soort, props.waarde)
  if (!d) return null
  const tekst = props.tekst ?? d.tekst
  if (props.vermoedelijk) return { ...d, stijl: 'leeg', tint: undefined, tekst: `${tekst} ?` }
  return { ...d, tekst }
})

const zichtbaar = computed(() => {
  if (props.soort === 'klasse') return true
  if (props.soort === 'fase') return !!props.tekst
  return !!def.value
})

const klassen = computed(() => {
  if (props.soort === 'klasse') return klasse.value ? ['lbl', 'lbl--rand', 'lbl-klasse'] : ['lbl', 'lbl--leeg']
  if (props.soort === 'fase') return ['lbl', 'lbl--rand', 'lbl-fase', { 'lbl-fase--uit': fase.value?.uit }]
  const d = def.value!
  return ['lbl', `lbl--${d.stijl}`, d.tint && d.stijl === 'zacht' ? `lbl--${d.tint}` : null, { 'lbl--voorstel': d.voorstel, 'lbl-score': props.soort === 'score' }]
})

/** Toegankelijke naam als knop, anders de tooltip (de trap en de stappen zijn alleen vorm). */
const aria = computed(() => {
  if (props.titel) return props.titel
  if (props.soort === 'klasse') return klasse.value ? `Klasse ${klasse.value.letter}${klasse.value.tekst ? ` ${klasse.value.tekst}` : ''}` : 'Geen klasse'
  if (props.soort === 'fase' && fase.value) return fase.value.uit ? `Fase ${props.tekst}, buiten de reis` : fase.value.stap ? `Fase ${props.tekst}, stap ${fase.value.stap} van 4` : `Fase ${props.tekst}`
  if (props.soort === 'score') return `Score ${props.waarde}`
  return undefined
})
</script>

<template>
  <component
    :is="knop ? 'button' : 'span'" v-if="zichtbaar" :type="knop ? 'button' : undefined" :disabled="knop ? uit : undefined"
    :class="klassen" :aria-label="knop ? aria : undefined" :title="titel ?? (knop ? undefined : aria)" :data-label="soort" :data-waarde="waarde ?? undefined" @click="knop && emit('click', $event)"
  >
    <template v-if="soort === 'klasse'">
      <template v-if="klasse"><span class="lbl-klasse-letter">{{ klasse.letter }}</span><span v-if="klasse.tekst">{{ klasse.tekst }}</span><span v-if="klasse.trap" class="lbl-trap" :data-n="klasse.trap" aria-hidden="true"><i /><i /><i /><i /></span></template>
      <template v-else>Geen klasse</template>
    </template>
    <template v-else-if="soort === 'fase'">
      <span class="lbl-stappen" :data-n="fase?.stap ?? 0" aria-hidden="true"><i /><i /><i /><i /></span><span>{{ tekst }}</span><Icoon v-if="knop && !uit" naam="ChevronDown" :grootte="10" />
    </template>
    <template v-else-if="def">
      <Icoon v-if="def.icoon" :naam="def.icoon" :grootte="12" />{{ def.tekst }}
    </template>
  </component>
</template>
