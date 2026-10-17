<script setup lang="ts">
// Een gespreksverslag lezen (tabblad Gespreksverslagen en tijdlijn): het verslag van een afspraak, een transcript,
// de notitie bij een belpoging, of bij de belactiviteit van een afgeronde beltaak het verslag en het transcript samen.
defineProps<{ open: boolean; verslag: any | null }>()
const emit = defineEmits<{ sluit: []; afspraak: [id: string] }>()
</script>

<template>
  <FlyoutShell v-if="open && verslag" open titel-id="vf-titel" data-test="verslag-flyout" :ai="{ accountId: verslag.accountId ?? null, label: verslag.titel, vraag: '', voorstellen: ['Vat dit verslag samen', 'Wat is de volgende stap?', 'Welke koopsignalen zie je?'] }" @sluit="emit('sluit')">
      <template #kop><span class="fo-kicker">{{ verslag.bronLabel }} · {{ verslag.typeLabel }}</span><h2 id="vf-titel" class="fo-titel">{{ verslag.titel }}</h2><p class="fo-meta">{{ new Date(verslag.datum).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' }) }}<template v-if="verslag.contact"> · {{ verslag.contact }}</template> · {{ verslag.woorden }} woorden</p></template>
        <div class="fo-body">
          <article class="fo-blok" data-test="vf-verslag">
            <h3 v-if="verslag.transcript" class="fo-blok-titel">Gespreksverslag</h3>
            <p v-if="verslag.tekst" class="fo-tekst vf-tekst">{{ verslag.tekst }}</p>
            <p v-else class="meta">Er is geen verslag geschreven; wel een transcript.</p>
          </article>
          <article v-if="verslag.transcript" class="fo-blok" data-test="vf-transcript">
            <h3 class="fo-blok-titel">Transcript</h3>
            <p class="meta">{{ verslag.transcript.woorden }} woorden</p>
            <p class="fo-tekst vf-tekst">{{ verslag.transcript.tekst }}</p>
          </article>
        </div>
      <template #voet>
        <footer v-if="verslag.afspraakId" class="fo-foot fs-voet"><button type="button" class="dd-actie dd-actie--zwart fs-hoofdactie" @click="emit('afspraak', verslag.afspraakId)"><Icoon naam="Calendar" :grootte="16" />Open de afspraak</button><span class="fo-foot-vul" /></footer>
      </template>
    </FlyoutShell>
</template>

<style scoped>
.vf-tekst { white-space: pre-wrap; line-height: 1.6; }
</style>
