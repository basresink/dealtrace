<script setup lang="ts">
// Prospect (standaardlabel) en contactpersoon als zoekvelden (opzet van DealDrive, NieuweTaakFlyout en TaakFlyout): typen zoekt,
// klikken kiest, het kruisje wist. Met een klant toont het contactveld diens contacten (beslisser eerst);
// zonder klant zoek je over alle contacten en neemt het gekozen contact zijn klant mee. Een andere klant
// wist een contact dat er niet bij hoort.
export interface Klant { id: string; naam: string; plaats?: string | null; branche?: string | null }
export interface Contact { id: string; naam: string; functie?: string | null; accountId?: string | null; accountNaam?: string | null }
const props = withDefaults(defineProps<{ prefix?: string; klantLabel?: string; contactLabel?: string }>(), { prefix: 'nt', klantLabel: 'Prospect', contactLabel: 'Contactpersoon' })
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
    <ZoekKiezer
      :zoek="zoekKlant" :kop="klantLabel" :gekozen="klant" :gekozen-test="t('klant-keuze')" :wis-label="`Wis gekozen ${klantLabel.toLowerCase()}`"
      :placeholder="`Zoek op ${klantLabel.toLowerCase()}naam…`" :data-test="t('klant')" :optie-test="() => t('klant-optie')" :sub="accountSub"
      :leeg="`Geen ${klantLabel.toLowerCase()} gevonden.`" @kies="(a) => (klant = a)" @wis="wisKlant"
    />
  </div>
  <div class="veld">
    <ZoekKiezer
      :zoek="zoekContact" :sleutel="klant?.id ?? null" :kop="contactLabel" :gekozen="contact" :gekozen-test="t('contact-keuze')" :wis-label="`Wis gekozen ${contactLabel.toLowerCase()}`"
      :placeholder="klant ? `Kies of zoek een ${contactLabel.toLowerCase()}…` : 'Zoek op contactnaam of functie…'"
      :data-test="t('contact')" :optie-test="() => t('contact-optie')" :sub="(c) => contactSub(c, !klant)"
      :leeg="klant ? `Geen ${contactLabel.toLowerCase()} bij deze ${klantLabel.toLowerCase()} gevonden.` : `Geen ${contactLabel.toLowerCase()} gevonden.`" laad-tekst="Contactpersonen laden…"
      @kies="kiesContact" @wis="contact = null"
    />
  </div>
</template>
