<script setup lang="ts">
// "+ Inzicht" (P19, Gevorderd): zelf een inzicht toevoegen met prospect, optioneel een contact, titel, bron en
// citaat. Prospect en contact kies je met KlantContactKiezer; het contact komt in signals.contact_id en het
// inzicht staat daarmee ook op de contactkaart.
import type { Contact, Klant } from '../taken/KlantContactKiezer.vue'
const props = defineProps<{ open: boolean; account?: { id: string; naam: string } | null }>()
const emit = defineEmits<{ sluit: []; opgeslagen: [] }>()
const toast = useToast()
const klant = ref<Klant | null>(null)
const contact = ref<Contact | null>(null)
const f = reactive({ titel: '', bron: '', url: '', citaat: '' })
const bezig = ref(false)
watch(() => props.open, (o) => { if (o) { klant.value = props.account ?? null; contact.value = null; Object.assign(f, { titel: '', bron: '', url: '', citaat: '' }) } })
const klaar = computed(() => !!klant.value && f.titel.trim() && f.bron.trim() && f.citaat.trim())
async function opslaan() {
  bezig.value = true
  try {
    await opslag.bewaar(() => $fetch('/api/signals/handmatig', { method: 'POST', body: { accountId: klant.value!.id, contactId: contact.value?.id, titel: f.titel, bron: f.bron, url: f.url || undefined, citaat: f.citaat } }))
    toast.toon('Inzicht toegevoegd.'); emit('opgeslagen'); emit('sluit')
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
// Opslaan-status in de kop (FlyoutShell): Gewijzigd tot de hoofdactie opslaat; sluiten met wijzigingen vraagt eerst.
const opslag = useFlyoutOpslag()
opslag.volg(() => [f, klant.value?.id ?? null, contact.value?.id ?? null])
</script>

<template>
  <FlyoutShell v-if="open" open titel-id="imb-titel" breedte="smal" data-test="inzicht-met-bron" :opslag="opslag" @sluit="emit('sluit')" @bewaar="opslaan">
      <template #kop><span class="fo-kicker">Inzicht</span><h2 id="imb-titel" class="fo-titel">Nieuw inzicht</h2></template>
        <form id="imb-form" class="fs-form" @submit.prevent="opslaan">
        <div class="fo-body fo-body--formulier">
          <KlantContactKiezer v-model:klant="klant" v-model:contact="contact" prefix="imb" klant-label="Prospect" contact-label="Contact" />
          <p class="veld-uitleg imb-uitleg">Het contact is optioneel. Met een contact staat het inzicht ook op de contactkaart.</p>
          <label class="veld"><span class="veld-label">Titel</span><input v-model="f.titel" class="invoer" maxlength="140" required data-test="imb-titel"></label>
          <label class="veld"><span class="veld-label">Bron</span><input v-model="f.bron" class="invoer" maxlength="140" placeholder="Bijvoorbeeld: gesprek op de vakbeurs" required data-test="imb-bron"></label>
          <label class="veld"><span class="veld-label">URL</span><input v-model="f.url" class="invoer" type="url" placeholder="https://" data-test="imb-url"></label>
          <label class="veld"><span class="veld-label">Citaat</span><textarea v-model="f.citaat" class="invoer" rows="3" maxlength="600" required data-test="imb-citaat" /></label>
        </div>
        </form>
      <template #voet>
        <footer class="fo-foot fs-voet">
          <button type="submit" form="imb-form" class="dd-actie dd-actie--zwart fs-hoofdactie" :disabled="!klaar || bezig" data-test="imb-opslaan"><Icoon naam="Check" :grootte="16" />Opslaan</button>
          <span class="fo-foot-vul" />
        </footer>
      </template>
    </FlyoutShell>
</template>

<style scoped>
.imb-uitleg { margin-top: -8px; }
</style>
