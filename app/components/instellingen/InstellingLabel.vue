<script setup lang="ts">
// Label voor de stand van een onderdeel onder Instellingen (sjabloon, soort, artikel, agent, koppeling,
// factuur). Eén plek die elke stand op een bestaand label uit het register zet (shared/labels.ts), zodat
// vorm, tint en icoon gelijk zijn aan de rest van de app: aan en gekoppeld zacht groen, uit gestippeld
// met pauze, concept gestippeld met potlood, feiten (startset, eigen, van Dealtrace) met een rand.
type Stand = 'aan' | 'uit' | 'startset' | 'eigen' | 'platform' | 'concept' | 'gepubliceerd' | 'verborgen' | 'gearchiveerd'
  | 'gekoppeld' | 'niet-gekoppeld' | 'fout' | 'factuur-open' | 'betaald' | 'achterstallig' | 'geannuleerd'

const props = defineProps<{ stand: Stand; tekst?: string | null }>()

const KAART: Record<Stand, { soort: string; waarde: string; tekst: string }> = {
  aan: { soort: 'overdracht', waarde: 'bevestigd', tekst: 'Aan' },
  uit: { soort: 'status', waarde: 'gepauzeerd', tekst: 'Uit' },
  startset: { soort: 'account', waarde: 'prospect', tekst: 'Startset' },
  eigen: { soort: 'briefing', waarde: 'eigen', tekst: 'Eigen' },
  platform: { soort: 'aikoppeling', waarde: 'platform', tekst: 'Van Dealtrace' },
  concept: { soort: 'richting', waarde: 'concept', tekst: 'Concept' },
  gepubliceerd: { soort: 'overdracht', waarde: 'bevestigd', tekst: 'Gepubliceerd' },
  verborgen: { soort: 'status', waarde: 'gedeactiveerd', tekst: 'Verborgen' },
  gearchiveerd: { soort: 'status', waarde: 'gedeactiveerd', tekst: 'Gearchiveerd' },
  gekoppeld: { soort: 'overdracht', waarde: 'bevestigd', tekst: 'Gekoppeld' },
  'niet-gekoppeld': { soort: 'aikoppeling', waarde: 'mock', tekst: 'Niet gekoppeld' },
  fout: { soort: 'overdracht', waarde: 'mislukt', tekst: 'Fout' },
  'factuur-open': { soort: 'avgverzoek', waarde: 'open', tekst: 'Open' },
  betaald: { soort: 'avgverzoek', waarde: 'afgehandeld', tekst: 'Betaald' },
  achterstallig: { soort: 'avgverzoek', waarde: 'over_tijd', tekst: 'Achterstallig' },
  geannuleerd: { soort: 'status', waarde: 'gedeactiveerd', tekst: 'Geannuleerd' },
}
const def = computed(() => KAART[props.stand] ?? KAART.concept)
</script>

<template>
  <Label :soort="def.soort" :waarde="def.waarde" :tekst="tekst ?? def.tekst" :data-stand="stand" />
</template>
