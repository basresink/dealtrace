<script setup lang="ts">
// Eén slot van de agent-prompts (P24): de tekst, het vaste kader (alleen lezen), Proefdraai en Opslaan, met de
// versies (hooguit 10). Voor de founder de platformlaag, voor de beheerder de eigen laag.
const props = defineProps<{ slot: any; kader: string; basis: string; voorbeeld?: string | null }>()
const emit = defineEmits<{ bewaard: [] }>()
const toast = useToast()
const { metHerbevestiging } = useHerbevestig()
const tekst = ref(props.slot.versies?.[0]?.tekst ?? '')
const proef = ref<any>(null)
const bezig = ref(false)
async function draai() {
  bezig.value = true
  try { proef.value = await $fetch(`${props.basis}/${props.slot.slot}/proefdraai`, { method: 'POST', body: { tekst: tekst.value } }) } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
async function bewaar() {
  try { const r: any = await metHerbevestiging(() => $fetch(`${props.basis}/${props.slot.slot}`, { method: 'PUT', body: { tekst: tekst.value } })); toast.toon(r.tekst); emit('bewaard') } catch (e: any) { if (!e?.geannuleerd) toast.toon(foutTekst(e), 'fout') }
}
</script>

<template>
  <article class="kaart" :data-test="`prompt-${slot.slot}`">
    <header class="kaart-kop"><h2 class="kaart-titel">{{ slot.naam }}</h2><span class="meta">{{ slot.versies?.length ? `versie ${slot.versies[0].versie}` : 'standaard uit de code' }}</span></header>
    <p v-if="voorbeeld" class="kaart-meta">Platformtekst (alleen lezen): {{ voorbeeld }}</p>
    <textarea v-model="tekst" class="invoer mt-8" rows="4" :aria-label="`Prompt ${slot.naam}`" placeholder="Leeg: de laag erboven of de standaard uit de code" />
    <p class="kaart-meta mt-8"><strong>Vast kader</strong> (niet te wijzigen): {{ kader }}</p>
    <div class="dd-acties mt-8"><button type="button" class="dd-act" :disabled="bezig || !tekst.trim()" @click="draai">Proefdraai</button><button type="button" class="dd-act dd-act--primair" :disabled="!tekst.trim()" @click="bewaar">Opslaan</button></div>
    <pre v-if="proef" class="pd-uit mt-8">{{ proef.ok ? JSON.stringify(proef.antwoord, null, 2) : proef.fouten.join('\n') }}</pre>
    <details v-if="slot.versies?.length" class="mt-8"><summary>Versies</summary>
      <ul class="schakel-lijst"><li v-for="v in slot.versies" :key="v.versie" class="schakel-rij"><span>Versie {{ v.versie }} · {{ v.auteur }}</span><button type="button" class="tekst-link" @click="tekst = v.tekst">Gebruik deze tekst</button></li></ul>
    </details>
  </article>
</template>

<style scoped>
.pd-uit { background: var(--bg-zacht, #f6f5f0); padding: 12px; border-radius: 8px; white-space: pre-wrap; font-size: 13px; max-height: 240px; overflow: auto; }
</style>
