<script setup lang="ts">
// "+ Mail" op de accountkaart: zelf een mail schrijven aan de beslisser. Gaat langs de Bewaker en de
// mailkoppeling, net als een goedgekeurd concept, en komt in de tijdlijn en het tabblad E-mails.
const props = defineProps<{ open: boolean; account: { id: string; naam: string }; aan?: string | null; contactId?: string | null }>()
const emit = defineEmits<{ sluit: []; verstuurd: [] }>()
const toast = useToast()
const onderwerp = ref('')
const tekst = ref('')
const bezig = ref(false)
watch(() => props.open, (o) => { if (o) { onderwerp.value = ''; tekst.value = '' } })
async function verstuur() {
  bezig.value = true
  try {
    const r = await $fetch<any>(`/api/accounts/${props.account.id}/mail`, { method: 'POST', body: { onderwerp: onderwerp.value, tekst: tekst.value, contactId: props.contactId ?? undefined } })
    toast.toon(r.tekst ?? 'Verstuurd.'); emit('verstuurd')
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fo-overlay" @click.self="emit('sluit')">
      <form class="fo-panel" role="dialog" aria-modal="true" aria-labelledby="mf-titel" data-test="mail-flyout" @submit.prevent="verstuur">
        <header class="fo-head">
          <div class="fo-head-tekst"><span class="fo-kicker">Nieuwe mail</span><h2 id="mf-titel" class="fo-titel">{{ account.naam }}</h2><p class="fo-meta">Aan {{ aan ?? 'de beslisser of de eerste contactpersoon met een e-mailadres' }}</p></div>
          <button type="button" class="fo-sluit" aria-label="Sluiten" @click="emit('sluit')"><Icoon naam="X" /></button>
        </header>
        <div class="fo-body">
          <label class="veld"><span class="veld-label">Onderwerp</span><input v-model="onderwerp" class="invoer" maxlength="200" data-test="mail-onderwerp"></label>
          <label class="veld mt-16"><span class="veld-label">Tekst</span><textarea v-model="tekst" class="invoer" rows="10" data-test="mail-tekst" /></label>
          <p class="meta mt-8">De Bewaker toetst consent, afmeldingen en het frequentieplafond voordat de mail weggaat.</p>
        </div>
        <footer class="fo-foot dd-acties"><span class="dd-acties-vul fo-foot-vul" /><button type="button" class="dd-act" @click="emit('sluit')">Annuleren</button><button type="submit" class="dd-act dd-act--geel" :disabled="bezig || !onderwerp.trim() || !tekst.trim()" data-test="mail-verstuur">Versturen</button></footer>
      </form>
    </div>
  </Teleport>
</template>
