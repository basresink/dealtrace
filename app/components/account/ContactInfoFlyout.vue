<script setup lang="ts">
// Info-flyout van de contactkaart (opzet uit DealDrive, 520 px): gegevens, toestemming en voorkeur,
// "Bel me niet", vertrokken en (Expert) verhuizen naar een ander bedrijf. Elke wijziging bewaart zichzelf.
import { CONTACTROL_LABEL, ROLLEN_CONTACT } from '~~/shared/contactgegevens'
const props = defineProps<{ open: boolean; contact: any }>()
const emit = defineEmits<{ sluit: []; gewijzigd: [] }>()
const toast = useToast()
const f = reactive<Record<string, any>>({})
watch(() => [props.open, props.contact], () => {
  const c = props.contact
  if (!c) return
  Object.assign(f, { voornaam: c.voornaam ?? '', achternaam: c.achternaam ?? '', functie: c.functie ?? '', email: c.email ?? '', telefoon: c.telefoon ?? '', mobiel: c.mobiel ?? '', linkedin: c.linkedin ?? '' })
}, { immediate: true })
const status = ref('')
async function bewaar(patch: Record<string, unknown>) {
  status.value = 'Opslaan…'
  try { await $fetch(`/api/contacten/${props.contact.id}`, { method: 'PUT', body: patch }); status.value = 'Opgeslagen'; emit('gewijzigd') } catch (e) { status.value = 'Opslaan mislukt'; toast.toon(foutTekst(e), 'fout') }
}
const STATUS_C: Record<string, string> = { onbekend: 'Onbekend', ja: 'Ja', nee: 'Nee' }
// Verhuizen (Expert): de lijst met bedrijven pas laden als het venster open is.
const verhuisNaar = ref('')
const bedrijven = ref<any[]>([])
watch(() => props.open, async (o) => {
  if (!o || !props.contact?.kan?.verhuizen || bedrijven.value.length) return
  try { const r = await $fetch<any>('/api/accounts', { query: { eigenaar: 'iedereen' } }); bedrijven.value = (r.rijen ?? []).filter((a: any) => a.id !== props.contact.accountId) } catch { bedrijven.value = [] }
}, { immediate: true })
async function verhuis() {
  try { await $fetch(`/api/contacten/${props.contact.id}/verhuis`, { method: 'POST', body: { accountId: verhuisNaar.value } }); toast.toon('Contact verhuisd.'); verhuisNaar.value = ''; emit('gewijzigd') } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open && contact" class="fo-overlay" @click.self="emit('sluit')">
      <aside class="fo-panel fo-panel--smal" role="dialog" aria-modal="true" aria-labelledby="ci-titel" data-test="contact-info-flyout">
        <header class="fo-head">
          <div class="fo-head-tekst"><span class="fo-kicker">Info</span><h2 id="ci-titel" class="fo-titel">{{ contact.naam }}</h2><p class="fo-meta" aria-live="polite">{{ status }}</p></div>
          <button type="button" class="fo-sluit" aria-label="Sluiten" @click="emit('sluit')"><Icoon naam="X" /></button>
        </header>
        <div class="fo-body fo-body--formulier">
          <article class="fo-blok">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Gegevens</h3></header>
            <div class="formulier-raster">
              <label class="veld"><span class="veld-label">Voornaam</span><input v-model="f.voornaam" class="invoer" @change="bewaar({ voornaam: f.voornaam || null })"></label>
              <label class="veld"><span class="veld-label">Achternaam</span><input v-model="f.achternaam" class="invoer" data-test="ci-achternaam" @change="bewaar({ achternaam: f.achternaam })"></label>
              <label class="veld"><span class="veld-label">Functie</span><input v-model="f.functie" class="invoer" data-test="ci-functie" @change="bewaar({ functie: f.functie || null })"></label>
              <label class="veld"><span class="veld-label">Rol</span><select class="invoer" :value="contact.rol" @change="bewaar({ rol: ($event.target as HTMLSelectElement).value })"><option v-for="r in ROLLEN_CONTACT" :key="r" :value="r">{{ CONTACTROL_LABEL[r] }}</option></select></label>
              <label class="veld"><span class="veld-label">E-mail</span><input v-model="f.email" class="invoer" type="email" @change="bewaar({ email: f.email || null })"></label>
              <label class="veld"><span class="veld-label">Telefoon</span><input v-model="f.telefoon" class="invoer" type="tel" @change="bewaar({ telefoon: f.telefoon || null })"></label>
              <label class="veld"><span class="veld-label">Mobiel</span><input v-model="f.mobiel" class="invoer" type="tel" @change="bewaar({ mobiel: f.mobiel || null })"></label>
              <label class="veld"><span class="veld-label">LinkedIn</span><input v-model="f.linkedin" class="invoer" @change="bewaar({ linkedin: f.linkedin || null })"></label>
            </div>
          </article>
          <article class="fo-blok">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Toestemming en voorkeur</h3></header>
            <div class="formulier-raster">
              <label v-for="k in ['email', 'whatsapp']" :key="k" class="veld"><span class="veld-label">{{ k === 'email' ? 'E-mail' : 'WhatsApp' }}</span>
                <select class="invoer" :value="contact.consent?.[k]?.status ?? 'onbekend'" :data-test="`consent-${k}`" @change="bewaar({ consent: { [k]: ($event.target as HTMLSelectElement).value } })"><option v-for="(l, s) in STATUS_C" :key="s" :value="s">{{ l }}</option></select>
                <span v-if="contact.consent?.[k]?.op" class="veld-uitleg">{{ contact.consent[k].op.slice(0, 10) }} · {{ contact.consent[k].bron }}</span>
              </label>
              <label class="veld"><span class="veld-label">Voorkeurskanaal</span><select class="invoer" :value="contact.voorkeurskanaal ?? ''" @change="bewaar({ voorkeurskanaal: ($event.target as HTMLSelectElement).value || null })"><option value="">Geen</option><option value="telefoon">Telefoon</option><option value="email">E-mail</option><option value="whatsapp">WhatsApp</option></select></label>
            </div>
            <div class="schakel-rij mt-16"><div><span class="schakel-naam">Bel me niet</span><span class="veld-uitleg">Haalt het nummer uit elke bellijst.</span></div><Schakelaar :aan="contact.belMeNiet" label="Bel me niet" data-test="bel-me-niet" @wissel="bewaar({ belMeNiet: $event })" /></div>
          </article>
          <article class="fo-blok">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Status</h3></header>
            <p class="fo-tekst">{{ contact.status === 'vertrokken' ? `Vertrokken${contact.vertrokkenOp ? ` op ${contact.vertrokkenOp}` : ''}. De historie blijft bewaard.` : 'Werkt hier nog. Vertrokken in plaats van verwijderen: de historie blijft bewaard.' }}</p>
            <button type="button" class="dd-act mt-8" data-test="vertrokken-knop" @click="bewaar({ status: contact.status === 'vertrokken' ? 'actief' : 'vertrokken' })">{{ contact.status === 'vertrokken' ? 'Weer actief' : 'Markeer als vertrokken' }}</button>
          </article>
          <article v-if="contact.kan?.verhuizen" class="fo-blok" data-test="verhuizen">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Verhuizen</h3></header>
            <p class="fo-tekst">Naar een ander bedrijf. De historie blijft bewaard.</p>
            <select v-model="verhuisNaar" class="invoer mt-8" aria-label="Nieuw bedrijf"><option value="">Kies een bedrijf</option><option v-for="b in bedrijven" :key="b.id" :value="b.id">{{ b.name }}</option></select>
            <button type="button" class="dd-act mt-8" :disabled="!verhuisNaar" @click="verhuis">Verhuis</button>
          </article>
        </div>
        <footer class="fo-foot dd-acties">
          <span class="dd-acties-vul fo-foot-vul" />
          <button type="button" class="dd-act" @click="emit('sluit')">Sluiten</button>
        </footer>
      </aside>
    </div>
  </Teleport>
</template>
