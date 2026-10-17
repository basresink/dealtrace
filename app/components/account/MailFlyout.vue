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
  <FlyoutShell v-if="open" open titel-id="mf-titel" data-test="mail-flyout" @sluit="emit('sluit')">
      <template #kop><span class="fo-kicker">Nieuwe mail</span><h2 id="mf-titel" class="fo-titel">{{ account.naam }}</h2><p class="fo-meta">Aan {{ aan ?? 'de beslisser of de eerste contactpersoon met een e-mailadres' }}</p></template>
        <form id="mf-form" class="fs-form" @submit.prevent="verstuur">
        <div class="fo-body">
          <label class="veld"><span class="veld-label">Onderwerp</span><input v-model="onderwerp" class="invoer" maxlength="200" data-test="mail-onderwerp"></label>
          <label class="veld mt-16"><span class="veld-label">Tekst</span><textarea v-model="tekst" class="invoer" rows="10" data-test="mail-tekst" /></label>
          <p class="meta mt-8">De Bewaker toetst consent, afmeldingen en het frequentieplafond voordat de mail weggaat.</p>
        </div>
        </form>
      <template #voet>
        <footer class="fo-foot fs-voet">
          <button type="submit" form="mf-form" class="dd-actie dd-actie--zwart fs-hoofdactie" :disabled="bezig || !onderwerp.trim() || !tekst.trim()" data-test="mail-verstuur"><Icoon naam="Check" :grootte="16" />Versturen</button>
          <span class="fo-foot-vul" />
        </footer>
      </template>
    </FlyoutShell>
</template>
