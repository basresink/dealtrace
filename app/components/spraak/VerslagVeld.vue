<script setup lang="ts">
// Tekstveld met microfoon (P31, 8.13): verslag in Bezoek afronden, "Rond af", notitie. De opname
// gaat als bijlage mee met het record; de tekst komt uit de transcriptie in de EU en wordt aan het
// veld toegevoegd. Typen blijft altijd mogelijk.
const props = defineProps<{ modelValue: string; record: { soort: string; id: string }; placeholder?: string; rijen?: number; groot?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [v: string]; opname: [id: string] }>()
const { functie } = useMe()
const toast = useToast()
const o = useOpname()
const aan = computed(() => !!functie('spraak.inspreken')?.beschikbaar && o.kan.value)
const bezig = ref(false)
async function wissel() {
  if (!o.neemtOp.value) { try { await o.start() } catch { toast.toon('Geen toegang tot de microfoon. Typ je tekst.', 'fout') } return }
  bezig.value = true
  const id = await o.stop(props.record)
  if (!id) { bezig.value = false; toast.toon('Dat verstond ik niet. Probeer het nog eens of typ.', 'let-op'); return }
  emit('opname', id)
  const r = await o.tekstVan(id)
  bezig.value = false
  if (r.tekst) emit('update:modelValue', [props.modelValue, r.tekst].filter(Boolean).join('\n'))
  else if (r.reden) toast.toon(r.reden, 'let-op')
}
</script>

<template>
  <div class="verslag-veld">
    <button v-if="aan" type="button" :class="['ba-mic', { 'ba-mic--aan': o.neemtOp.value, 'ba-mic--klein': !groot }]" :aria-pressed="o.neemtOp.value" :disabled="bezig" data-test="vv-mic" @click="wissel">
      <Icoon :naam="o.neemtOp.value ? 'Square' : 'Mic'" />{{ o.neemtOp.value ? `Stop · ${o.seconden.value} s` : bezig ? 'Tekst maken…' : groot ? 'Spreek je verslag in' : 'Inspreken' }}
    </button>
    <textarea :value="modelValue" class="invoer mt-8" :rows="rijen ?? 4" :placeholder="placeholder ?? 'Of typ je tekst'" data-test="vv-tekst" @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)" />
  </div>
</template>
