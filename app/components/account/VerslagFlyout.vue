<script setup lang="ts">
// Een gespreksverslag lezen (tabblad Gespreksverslagen en tijdlijn): het verslag van een afspraak, een transcript,
// de notitie bij een belpoging, of bij de belactiviteit van een afgeronde beltaak het verslag en het transcript samen.
defineProps<{ open: boolean; verslag: any | null }>()
const emit = defineEmits<{ sluit: []; afspraak: [id: string] }>()
</script>

<template>
  <Teleport to="body">
    <div v-if="open && verslag" class="fo-overlay" @click.self="emit('sluit')">
      <aside class="fo-panel" role="dialog" aria-modal="true" aria-labelledby="vf-titel" data-test="verslag-flyout">
        <header class="fo-head">
          <div class="fo-head-tekst"><span class="fo-kicker">{{ verslag.bronLabel }} · {{ verslag.typeLabel }}</span><h2 id="vf-titel" class="fo-titel">{{ verslag.titel }}</h2><p class="fo-meta">{{ new Date(verslag.datum).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' }) }}<template v-if="verslag.contact"> · {{ verslag.contact }}</template> · {{ verslag.woorden }} woorden</p></div>
          <button type="button" class="fo-sluit" aria-label="Sluiten" @click="emit('sluit')"><Icoon naam="X" /></button>
        </header>
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
        <footer v-if="verslag.afspraakId" class="fo-foot dd-acties"><span class="dd-acties-vul fo-foot-vul" /><button type="button" class="dd-act" @click="emit('afspraak', verslag.afspraakId)">Open de afspraak</button></footer>
      </aside>
    </div>
  </Teleport>
</template>

<style scoped>
.vf-tekst { white-space: pre-wrap; line-height: 1.6; }
</style>
