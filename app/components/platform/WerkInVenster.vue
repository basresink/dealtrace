<script setup lang="ts">
// "Werken in <organisatie>" (13.3 flow 4): verplichte reden, "Alleen meekijken"
// (standaard) of "Ook wijzigen". Bij "Alleen na toestemming" ontstaat een verzoek.
const props = defineProps<{ organisatie: { id: string; naam: string } | null }>()
const emit = defineEmits<{ sluit: [] }>()
const { metHerbevestiging } = useHerbevestig()
const toast = useToast()
const reden = ref('')
const modus = ref<'meekijken' | 'wijzigen'>('meekijken')
const bezig = ref(false)
watch(() => props.organisatie, () => { reden.value = ''; modus.value = 'meekijken' })

async function start() {
  if (!props.organisatie) return
  bezig.value = true
  try {
    const res = await metHerbevestiging(() => $fetch.raw<any>('/api/platform/werk-in', {
      method: 'POST', body: { organisatieId: props.organisatie!.id, reden: reden.value, modus: modus.value },
    }))
    if (res.status === 202) {
      toast.toon(`Toegang aangevraagd bij ${props.organisatie.naam}. Je krijgt een melding zodra de beheerder beslist.`)
      emit('sluit')
      return
    }
    window.location.href = '/'
  } catch (e) {
    const t = foutTekst(e)
    if (t) toast.toon(t, 'fout')
  } finally {
    bezig.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="organisatie" class="cd-overlay" @click.self="emit('sluit')">
      <form class="cd-dialog" role="dialog" aria-modal="true" aria-labelledby="wi-titel" data-test="werk-in-venster" @submit.prevent="start">
        <div class="cd-head"><h2 id="wi-titel" class="cd-title">Werken in {{ organisatie.naam }}</h2></div>
        <p class="cd-message">Alles wat je doet staat in de audit van het platform en van de klant. De beheerder krijgt een melding.</p>
        <label class="veld">
          <span class="veld-label">Reden <span class="veld-verplicht">verplicht</span></span>
          <input v-model="reden" class="invoer" placeholder="Bijvoorbeeld Ticket 1042" minlength="5" required data-test="werk-in-reden">
          <span class="veld-uitleg">Minstens 5 tekens.</span>
        </label>
        <div class="veld mt-16"><span class="veld-label">Modus</span>
          <div class="keuzegroep" role="group" aria-label="Modus">
            <button type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': modus === 'meekijken' }" :aria-pressed="modus === 'meekijken'" @click="modus = 'meekijken'">Alleen meekijken</button>
            <button type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': modus === 'wijzigen' }" :aria-pressed="modus === 'wijzigen'" data-test="modus-wijzigen" @click="modus = 'wijzigen'">Ook wijzigen</button>
          </div>
          <span v-if="modus === 'wijzigen'" class="veld-uitleg">Ook wijzigen vraagt om je authenticator-code.</span>
        </div>
        <div class="cd-foot">
          <button type="button" class="cd-btn cd-btn--ghost" @click="emit('sluit')">Annuleren</button>
          <button type="submit" class="cd-btn cd-btn--primary" :disabled="bezig || reden.trim().length < 5" data-test="werk-in-start">Werk in deze organisatie</button>
        </div>
      </form>
    </div>
  </Teleport>
</template>
