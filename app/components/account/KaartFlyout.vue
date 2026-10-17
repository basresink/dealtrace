<script setup lang="ts">
// Een venster van de accountkaart of de contactkaart dat onder Meer hangt (Dossier, Kwalificatie, Ritme,
// Reis, Belscript): de flyoutstandaard (FlyoutShell) met kicker, titel, uitleg, Vraag AI en sluiten, en de
// inhoud als slot. Vraag AI opent de assistent met dit account en drie vragen die bij het venster passen.
// Sluit met Escape, de sluitknop en een klik naast het venster.
import type { FlyoutOpslag } from '~/composables/useFlyoutOpslag'
const props = withDefaults(defineProps<{ open: boolean; kicker: string; titel: string; meta?: string | null; test: string; maat?: 'smal' | 'normaal' | 'breed'; accountId?: string | null; opslag?: FlyoutOpslag | null }>(), { meta: null, maat: 'normaal', accountId: null, opslag: null })
const emit = defineEmits<{ sluit: [] }>()
const titelId = computed(() => `${props.test}-titel`)
const VOORSTELLEN: Record<string, string[]> = {
  'kwalificatie-flyout': ['Wat ontbreekt er nog in BAND?', 'Wie hoort er in het buying committee?', 'Met welke vraag toets ik het budget?'],
  'ritme-flyout': ['Past dit ritme bij dit account?', 'Wanneer neem ik het beste weer contact op?', 'Wat zeg ik bij het volgende contact?'],
  'reis-flyout': ['Waar staat dit account in de reis?', 'Wat brengt het naar de volgende fase?', 'Welke fasewissel zegt het meest?'],
  'dossier-flyout': ['Vat het dossier samen', 'Wat is er nieuw sinds vorige week?', 'Welke aanleiding heb ik om te bellen?'],
  'belscript-flyout': ['Schrijf een openingszin', 'Welke bezwaren kan ik verwachten?', 'Maak het script korter'],
}
const ai = computed(() => ({ accountId: props.accountId, label: props.titel, vraag: '', voorstellen: VOORSTELLEN[props.test] ?? [`Wat moet ik weten over ${props.titel}?`] }))
</script>

<template>
  <FlyoutShell :open="open" :kicker="kicker" :titel="titel" :meta="meta" :titel-id="titelId" :breedte="maat" :ai="ai" :opslag="opslag" :sluit-test="`${test}-sluit`" :data-test="test" @sluit="emit('sluit')">
    <div class="fo-body kf-body">
      <slot />
    </div>
    <template v-if="$slots.voet" #voet><slot name="voet" /></template>
  </FlyoutShell>
</template>

<style scoped>
.kf-body { display: flex; flex-direction: column; gap: var(--kaart-gap, 16px); }
.kf-body :deep(.kaart) { margin: 0; }
</style>
