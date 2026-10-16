<script setup lang="ts">
// Klant en contactpersoon als zoekvelden (opzet van DealDrive, NieuweTaakFlyout en TaakFlyout): typen zoekt,
// klikken kiest, het kruisje wist. Met een klant toont het contactveld diens contacten (beslisser eerst);
// zonder klant zoek je over alle contacten en neemt het gekozen contact zijn klant mee. Een andere klant
// wist een contact dat er niet bij hoort.
export interface Klant { id: string; naam: string; plaats?: string | null }
export interface Contact { id: string; naam: string; functie?: string | null; accountId?: string | null; accountNaam?: string | null }
const props = withDefaults(defineProps<{ prefix?: string; klantLabel?: string; contactLabel?: string }>(), { prefix: 'nt', klantLabel: 'Klant', contactLabel: 'Contactpersoon' })
const klant = defineModel<Klant | null>('klant', { default: null })
const contact = defineModel<Contact | null>('contact', { default: null })

watch(klant, (k) => { if (contact.value?.accountId && contact.value.accountId !== k?.id) contact.value = null })
const zoekKlant = (q: string) => zoekAccounts(q)
const zoekContact = (q: string) => zoekContacten(q, klant.value?.id)
function wisKlant() { klant.value = null; contact.value = null }
function kiesContact(c: Contact) {
  if (!klant.value && c.accountId) klant.value = { id: c.accountId, naam: c.accountNaam ?? '' }
  contact.value = c
}
const t = (s: string) => `${props.prefix}-${s}`
</script>

<template>
  <div class="veld">
    <span class="veld-label">{{ klantLabel }}</span>
    <div v-if="klant" class="zoek-keuze" :data-test="t('klant-keuze')">
      <span class="zoek-keuze-tekst">{{ klant.naam }}<span v-if="klant.plaats" class="zoek-keuze-sub"> · {{ klant.plaats }}</span></span>
      <button type="button" class="zoek-keuze-wis kck-wis" :aria-label="`Wis gekozen ${klantLabel.toLowerCase()}`" @click="wisKlant">×</button>
    </div>
    <ZoekKiezer v-else :zoek="zoekKlant" :placeholder="`Zoek op ${klantLabel.toLowerCase()}naam…`" :label="`Zoek een ${klantLabel.toLowerCase()}`" :data-test="t('klant')" :optie-test="() => t('klant-optie')" :sub="(a) => a.plaats" :leeg="`Geen ${klantLabel.toLowerCase()} gevonden.`" @kies="(a) => (klant = a)" />
  </div>
  <div class="veld">
    <span class="veld-label">{{ contactLabel }}</span>
    <div v-if="contact" class="zoek-keuze" :data-test="t('contact-keuze')">
      <span class="zoek-keuze-tekst">{{ contact.naam }}<span v-if="contact.functie" class="zoek-keuze-sub"> · {{ contact.functie }}</span></span>
      <button type="button" class="zoek-keuze-wis kck-wis" :aria-label="`Wis gekozen ${contactLabel.toLowerCase()}`" @click="contact = null">×</button>
    </div>
    <ZoekKiezer
      v-else :zoek="zoekContact" :min="klant ? 0 : 2" :sleutel="klant?.id ?? null"
      :placeholder="klant ? `Kies of zoek een ${contactLabel.toLowerCase()}…` : 'Zoek op contactnaam…'" :label="`Zoek een ${contactLabel.toLowerCase()}`"
      :data-test="t('contact')" :optie-test="() => t('contact-optie')" :sub="(c) => [c.functie, klant ? null : c.accountNaam].filter(Boolean).join(' · ')"
      :leeg="klant ? `Geen ${contactLabel.toLowerCase()} bij deze ${klantLabel.toLowerCase()} gevonden.` : `Geen ${contactLabel.toLowerCase()} gevonden.`" laad-tekst="Contactpersonen laden…"
      @kies="kiesContact"
    />
  </div>
</template>

<style scoped>
.kck-wis { width: var(--touch-target-min); height: var(--touch-target-min); }
</style>
