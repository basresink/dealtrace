<script setup lang="ts">
// AI-voorzet voor één blok van een accountplan (de Pitstop, met credits). De knop "Voorzet" vraagt een
// voorstel; dat staat in een paars vak met "Gebaseerd op", eventuele vragen en de credits. Overnemen zet de
// tekst (of de acties) in het formulier; niets wordt stil opgeslagen. Bestaat er al tekst, dan heet de knop
// "Vervang mijn tekst". Alleen zichtbaar met de functie Pitstop.
import type { VoorzetDoel } from '~~/shared/accountplannen'
const props = defineProps<{ doel: VoorzetDoel; planId?: string | null; accountId?: string | null; concept?: Record<string, unknown> | null; heeftTekst?: boolean }>()
const emit = defineEmits<{ tekst: [tekst: string]; acties: [acties: { titel: string; datum: string }[]] }>()
const { functie } = useMe()
const toast = useToast()
const aan = computed(() => !!functie('pitstop.maken')?.beschikbaar)
const bezig = ref(false)
const voorstel = ref<any>(null)

async function vraag() {
  if (!props.planId && !props.accountId) { toast.toon('Kies eerst een prospect. Dan weet de Pitstop voor wie hij schrijft.', 'fout'); return }
  bezig.value = true
  try {
    voorstel.value = await $fetch('/api/accountplannen/voorstel', { method: 'POST', body: { doel: props.doel, planId: props.planId ?? null, accountId: props.accountId ?? null, concept: props.concept ?? null } })
    if (voorstel.value?.mislukt) toast.toon(voorstel.value.mislukt, 'fout')
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
function neemOver() {
  const v = voorstel.value
  if (!v) return
  if (props.doel === 'actieplan') emit('acties', v.acties)
  else emit('tekst', v.tekst)
  voorstel.value = null
}
const leeg = computed(() => !!voorstel.value && (props.doel === 'actieplan' ? !voorstel.value.acties.length : !voorstel.value.tekst))
</script>

<template>
  <div v-if="aan" class="apv" :data-test="`apv-${doel}`">
    <button v-if="!voorstel" type="button" class="dd-act apv-knop" :disabled="bezig" :data-test="`apv-vraag-${doel}`" @click="vraag">
      <Icoon naam="Sparkles" :grootte="14" />{{ bezig ? 'Pitstop schrijft...' : 'Voorzet van de Pitstop' }}
    </button>
    <div v-else class="apv-vak" role="region" :aria-label="`Voorzet voor ${doel}`" :data-test="`apv-voorstel-${doel}`">
      <div class="apv-kop"><Label soort="ai" waarde="voorstel" /><span class="apv-credits tnum">{{ voorstel.credits }} credits</span></div>
      <p v-if="leeg" class="apv-tekst">{{ voorstel.mislukt ?? 'De Pitstop had te weinig om een voorzet te schrijven.' }}</p>
      <p v-else-if="doel !== 'actieplan'" class="apv-tekst">{{ voorstel.tekst }}</p>
      <ul v-else class="apv-acties" role="list">
        <li v-for="(a, i) in voorstel.acties" :key="i">{{ a.titel }} <span class="meta tnum">{{ a.datum }}</span></li>
      </ul>
      <ul v-if="voorstel.vragen?.length" class="apv-vragen" role="list"><li v-for="(q, i) in voorstel.vragen" :key="i">{{ q }}</li></ul>
      <div v-if="voorstel.bronnen?.length" class="apv-herkomst"><span class="apv-label">Gebaseerd op</span><span v-for="(b, i) in voorstel.bronnen" :key="i" class="pil pil--leeg">{{ b.label }}</span></div>
      <div class="dd-acties apv-knoppen">
        <button v-if="!leeg" type="button" class="dd-act dd-act--geel" :data-test="`apv-neem-${doel}`" @click="neemOver">{{ doel === 'actieplan' ? 'Acties toevoegen' : heeftTekst ? 'Vervang mijn tekst' : 'Overnemen' }}</button>
        <button type="button" class="dd-act" :data-test="`apv-weg-${doel}`" @click="voorstel = null">Laat liggen</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.apv { margin-top: 8px; }
.apv-knop { display: inline-flex; align-items: center; gap: 6px; }
.apv-vak { padding: 12px 14px; background: var(--lbl-paars-vlak); border-left: 3px solid var(--lbl-paars-rand); }
.apv-kop { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
.apv-credits { font-size: 12px; color: var(--muted); }
.apv-tekst { margin: 0; font-size: 14px; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
.apv-acties, .apv-vragen { margin: 0; padding-left: 18px; font-size: 14px; line-height: 1.5; }
.apv-vragen { margin-top: 6px; color: var(--ink-soft); font-size: 13px; }
.apv-herkomst { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 8px; }
.apv-label { font-size: var(--fs-label); font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.apv-knoppen { margin-top: 10px; }
@media (max-width: 719px) { .apv-knop, .apv-knoppen .dd-act { min-height: var(--touch-target-min); } }
</style>
