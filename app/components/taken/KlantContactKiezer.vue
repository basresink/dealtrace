<script setup lang="ts">
// Klant en contactpersoon als zoekvelden (opzet van DealDrive, NieuweTaakFlyout en TaakFlyout): typen zoekt,
// klikken kiest, het kruisje wist. Met een klant toont het contactveld diens contacten (beslisser eerst);
// zonder klant zoek je over alle contacten en neemt het gekozen contact zijn klant mee. Een andere klant
// wist een contact dat er niet bij hoort.
export interface Klant { id: string; naam: string; plaats?: string | null }
export interface Contact { id: string; naam: string; functie?: string | null; accountId?: string | null; accountNaam?: string | null }
const props = withDefaults(defineProps<{ prefix?: string }>(), { prefix: 'nt' })
const klant = defineModel<Klant | null>('klant', { default: null })
const contact = defineModel<Contact | null>('contact', { default: null })

const klantZoek = ref('')
const klantActief = ref(false)
const klanten = ref<Klant[]>([])
const contactZoek = ref('')
const contactActief = ref(false)
const contacten = ref<Contact[]>([])
const laadt = ref(false)
let klantTimer: ReturnType<typeof setTimeout> | undefined
let contactTimer: ReturnType<typeof setTimeout> | undefined
watch(klantZoek, (q) => {
  clearTimeout(klantTimer)
  klantTimer = setTimeout(async () => { klanten.value = q.trim().length >= 2 ? await $fetch<Klant[]>('/api/accounts/kies', { query: { q: q.trim() } }).catch(() => []) : [] }, 250)
})
async function laadContacten() {
  const q = contactZoek.value.trim()
  if (!klant.value && q.length < 2) { contacten.value = []; return }
  laadt.value = true
  contacten.value = await $fetch<Contact[]>('/api/contacten/kies', { query: { q: q || undefined, accountId: klant.value?.id } }).catch(() => [])
  laadt.value = false
}
watch(contactZoek, () => { clearTimeout(contactTimer); contactTimer = setTimeout(laadContacten, 250) })
watch(contactActief, (a) => { if (a) laadContacten() })
watch(klant, (k) => { contacten.value = []; if (contact.value?.accountId && contact.value.accountId !== k?.id) contact.value = null })
function kiesKlant(a: Klant) { klant.value = a; klantZoek.value = ''; klantActief.value = false; klanten.value = [] }
function wisKlant() { klant.value = null; contact.value = null }
function kiesContact(c: Contact) {
  if (!klant.value && c.accountId) klant.value = { id: c.accountId, naam: c.accountNaam ?? '' }
  contact.value = c
  contactZoek.value = ''
  contactActief.value = false
}
const t = (s: string) => `${props.prefix}-${s}`
</script>

<template>
  <div class="veld">
    <span class="veld-label">Klant</span>
    <div v-if="klant" class="zoek-keuze" :data-test="t('klant-keuze')">
      <span class="zoek-keuze-tekst">{{ klant.naam }}<span v-if="klant.plaats" class="zoek-keuze-sub"> · {{ klant.plaats }}</span></span>
      <button type="button" class="zoek-keuze-wis kck-wis" aria-label="Wis gekozen klant" @click="wisKlant">×</button>
    </div>
    <div v-else class="zoekveld">
      <input v-model="klantZoek" class="invoer" placeholder="Zoek op klantnaam…" autocomplete="off" aria-label="Zoek een klant" :data-test="t('klant')" @focus="klantActief = true" @blur="klantActief = false">
      <ul v-if="klantActief && klanten.length" class="zoeklijst">
        <li v-for="a in klanten" :key="a.id"><button type="button" class="zoeklijst-item" :data-test="t('klant-optie')" @mousedown.prevent="kiesKlant(a)">{{ a.naam }}<span v-if="a.plaats" class="zoeklijst-sub"> · {{ a.plaats }}</span></button></li>
      </ul>
      <p v-else-if="klantActief && klantZoek.trim().length >= 2" class="zoeklijst-leeg kck-leeg">Geen klant gevonden.</p>
    </div>
  </div>
  <div class="veld">
    <span class="veld-label">Contactpersoon</span>
    <div v-if="contact" class="zoek-keuze" :data-test="t('contact-keuze')">
      <span class="zoek-keuze-tekst">{{ contact.naam }}<span v-if="contact.functie" class="zoek-keuze-sub"> · {{ contact.functie }}</span></span>
      <button type="button" class="zoek-keuze-wis kck-wis" aria-label="Wis gekozen contactpersoon" @click="contact = null">×</button>
    </div>
    <div v-else class="zoekveld">
      <input v-model="contactZoek" class="invoer" :placeholder="klant ? 'Kies of zoek een contactpersoon…' : 'Zoek op contactnaam…'" autocomplete="off" aria-label="Zoek een contactpersoon" :data-test="t('contact')" @focus="contactActief = true" @blur="contactActief = false">
      <ul v-if="contactActief && contacten.length" class="zoeklijst">
        <li v-for="c in contacten" :key="c.id"><button type="button" class="zoeklijst-item" :data-test="t('contact-optie')" @mousedown.prevent="kiesContact(c)">{{ c.naam }}<span class="zoeklijst-sub">{{ [c.functie, klant ? null : c.accountNaam].filter(Boolean).map((x) => ` · ${x}`).join('') }}</span></button></li>
      </ul>
      <p v-else-if="contactActief && (klant || contactZoek.trim().length >= 2)" class="zoeklijst-leeg kck-leeg">{{ laadt ? 'Contactpersonen laden…' : klant ? 'Geen contactpersoon bij deze klant gevonden.' : 'Geen contactpersoon gevonden.' }}</p>
    </div>
  </div>
</template>

<style scoped>
.kck-leeg { position: absolute; top: 100%; left: 0; right: 0; z-index: 5; }
.kck-wis { width: var(--touch-target-min); height: var(--touch-target-min); }
</style>
