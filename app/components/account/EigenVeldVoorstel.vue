<script setup lang="ts">
// "Stel een veld voor" (Expert, F19): een verzoek aan de beheerder.
import { VELDTYPEN, VELDTYPE_LABEL } from '~~/shared/eigenVelden'
const toast = useToast()
const open = ref(false)
const f = reactive({ naam: '', type: 'tekst', reden: '' })
async function stuur() {
  try { await $fetch('/api/eigen-velden/voorstel', { method: 'POST', body: f }); toast.toon('Voorstel verstuurd naar je beheerder.'); open.value = false; Object.assign(f, { naam: '', type: 'tekst', reden: '' }) } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
</script>

<template>
  <div>
    <button v-if="!open" type="button" class="dd-act" @click="open = true">Stel een veld voor</button>
    <form v-else class="kaart formulier-raster" @submit.prevent="stuur">
      <label class="veld"><span class="veld-label">Naam</span><input v-model="f.naam" class="invoer" required></label>
      <label class="veld"><span class="veld-label">Type</span><select v-model="f.type" class="invoer"><option v-for="t in VELDTYPEN" :key="t" :value="t">{{ VELDTYPE_LABEL[t] }}</option></select></label>
      <label class="veld"><span class="veld-label">Waarom</span><input v-model="f.reden" class="invoer"></label>
      <button type="submit" class="dd-actie dd-actie--primair">Voorstel versturen</button>
    </form>
  </div>
</template>
