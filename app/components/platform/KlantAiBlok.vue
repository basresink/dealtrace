<script setup lang="ts">
// Klantflyout, blok AI-koppeling en prompts (F23, pakket C). Welke koppeling deze klant gebruikt (eigen of
// die van het platform, sleutel alleen als vingerafdruk), een eigen sleutel of de mock instellen, terug naar
// de platformkoppeling, en per promptslot of de klant een eigen laag heeft (versie en datum, nooit de tekst).
import { PAKKET_LABEL, type Pakket } from '~~/shared/types'

interface Koppeling { provider: string; vingerafdruk: string | null; modellen: Record<string, string>; regio: string; geenTraining: boolean; getestOp: string | null }
const props = defineProps<{
  klant: { id: string; naam: string; pakket: string; ai: { eigen: Koppeling | null; platform: Koppeling | null; modus: string; omgeving: boolean }; prompts: { slot: string; naam: string; eigen: { versies: number; versie: number; op: string } | null; bekend: boolean }[] }
}>()
const emit = defineEmits<{ gewijzigd: [] }>()
const toast = useToast()
const { metHerbevestiging } = useHerbevestig()
const sleutel = ref('')
const provider = ref<'claude' | 'mock'>('claude')
const bezig = ref(false)
watch(() => props.klant.ai.eigen, (e) => { provider.value = (e?.provider as 'claude' | 'mock') ?? 'claude' }, { immediate: true })

const bron = computed(() => (props.klant.ai.eigen ? (props.klant.ai.eigen.provider === 'mock' ? 'mock' : 'eigen') : 'platform'))
const zin = computed(() => {
  const ai = props.klant.ai
  if (ai.eigen?.provider === 'mock') return 'Deze klant krijgt altijd de mock, ook als het platform een sleutel heeft.'
  if (ai.eigen) return `Deze klant gebruikt een eigen sleutel (${ai.eigen.vingerafdruk ?? 'zonder vingerafdruk'}).`
  if (ai.platform?.vingerafdruk) return `Deze klant gebruikt de platformkoppeling (${ai.platform.vingerafdruk}).`
  return ai.omgeving ? 'Deze klant gebruikt de sleutel uit de omgeving.' : 'Er is nog geen sleutel; de klant krijgt de mock.'
})
const eigenPrompts = computed(() => props.klant.prompts.filter((p) => p.eigen).length)
const datum = (t: string) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(t))
const kanBewaren = computed(() => provider.value === 'mock' || !!sleutel.value.trim() || !!props.klant.ai.eigen?.vingerafdruk)

async function bewaar() {
  if (!kanBewaren.value) { toast.toon('Plak eerst de sleutel van deze klant.', 'fout'); return }
  bezig.value = true
  try {
    const e = props.klant.ai.eigen
    const r: any = await metHerbevestiging(() => $fetch('/api/platform/ai', { method: 'PUT', body: { organisatieId: props.klant.id, provider: provider.value, ...(sleutel.value.trim() ? { sleutel: sleutel.value.trim() } : {}), modellen: e?.modellen ?? {}, regio: e?.regio ?? 'EU', geenTraining: e?.geenTraining ?? true } }))
    sleutel.value = ''
    toast.toon(r.tekst)
    emit('gewijzigd')
  } catch (e) { const t = foutTekst(e); if (t) toast.toon(t, 'fout') } finally { bezig.value = false }
}
async function terugNaarPlatform() {
  bezig.value = true
  try {
    const r: any = await metHerbevestiging(() => $fetch(`/api/platform/klanten/${props.klant.id}/ai`, { method: 'DELETE' }))
    toast.toon(r.tekst)
    emit('gewijzigd')
  } catch (e) { const t = foutTekst(e); if (t) toast.toon(t, 'fout') } finally { bezig.value = false }
}
async function test() {
  try { const r: any = await $fetch('/api/platform/ai/test', { method: 'POST', body: { organisatieId: props.klant.id } }); toast.toon(r.melding, r.ok ? undefined : 'fout') } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
</script>

<template>
  <article class="fo-blok" data-test="klant-ai">
    <header class="fo-blok-kop"><h3 class="fo-blok-titel">AI-koppeling en prompts</h3><Label soort="aikoppeling" :waarde="bron" /></header>
    <p class="fo-tekst" data-test="klant-ai-zin">{{ zin }}<template v-if="klant.ai.modus === 'mock'"> Op deze omgeving staat AI_PROVIDER op mock, dus alles antwoordt met de mock.</template></p>
    <div class="formulier-raster mt-8">
      <div class="veld"><span class="veld-label">Eigen koppeling</span>
        <div class="keuzegroep" role="group" aria-label="Provider van deze klant">
          <button type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': provider === 'claude' }" :aria-pressed="provider === 'claude'" data-test="klant-ai-claude" @click="provider = 'claude'">Claude</button>
          <button type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': provider === 'mock' }" :aria-pressed="provider === 'mock'" data-test="klant-ai-mock" @click="provider = 'mock'">Mock</button>
        </div>
      </div>
      <label v-if="provider === 'claude'" class="veld"><span class="veld-label">Sleutel van deze klant</span>
        <input v-model="sleutel" class="invoer" type="password" autocomplete="off" :placeholder="klant.ai.eigen?.vingerafdruk ? `Bewaard (${klant.ai.eigen.vingerafdruk})` : 'Plak de sleutel'" data-test="klant-ai-sleutel">
      </label>
    </div>
    <p class="veld-uitleg">Een eigen sleutel gaat vóór die van het platform. Een nieuwe sleutel vraagt je authenticator-code; je ziet hem daarna alleen als vingerafdruk.</p>
    <div class="dd-acties mt-8">
      <button type="button" class="dd-act" data-test="klant-ai-test" @click="test">Test verbinding</button>
      <button v-if="klant.ai.eigen" type="button" class="dd-act" :disabled="bezig" data-test="klant-ai-terug" @click="terugNaarPlatform">Gebruik de platformkoppeling</button>
      <button type="button" class="dd-act dd-act--primair" :disabled="bezig" data-test="klant-ai-bewaar" @click="bewaar">Eigen koppeling opslaan</button>
    </div>

    <h4 class="veld-label mt-16">Agent-prompts</h4>
    <p class="fo-tekst">
      <template v-if="eigenPrompts">{{ eigenPrompts }} van {{ klant.prompts.length }} slots met een eigen laag; de rest volgt het platform.</template>
      <template v-else-if="klant.pakket === 'starter'">Eigen prompts kan de klant vanaf {{ PAKKET_LABEL['plus' as Pakket] }}; nu volgt alles het platform.</template>
      <template v-else>Alle slots volgen het platform.</template>
    </p>
    <ul v-if="klant.prompts[0]?.bekend !== false" class="schakel-lijst" data-test="klant-prompts">
      <li v-for="p in klant.prompts" :key="p.slot" class="schakel-rij">
        <span>{{ p.naam }}</span>
        <span class="veld-uitleg kai-stand">{{ p.eigen ? `Eigen laag, versie ${p.eigen.versie} van ${datum(p.eigen.op)}` : 'Platform' }}</span>
      </li>
    </ul>
    <p v-else class="veld-uitleg">De stand per slot verschijnt na migratie 0075.</p>
    <p class="veld-uitleg">De tekst van een eigen laag zie je hier niet; die schrijft de beheerder van de klant bij Instellingen, Agent-prompts.</p>
  </article>
</template>

<style scoped>
.kai-stand { text-align: right; }
</style>
