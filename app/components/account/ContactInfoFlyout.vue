<script setup lang="ts">
// Info-venster van de contactkaart in de opzet van DealDrive (ContactInfoFlyout): kop "Contactgegevens" met
// naam en functie; blokken Persoon (met foto), Bereik en eigen velden met per veld inline bewerken (potlood,
// "+ Voeg ... toe" als het leeg is). Daarna Extra bronnen, Toestemming en voorkeur met "Bel me niet",
// Status (vertrokken in plaats van verwijderen) en voor Expert Verhuizen. Elke wijziging bewaart zichzelf.
import { CONTACTROL_LABEL, ROLLEN_CONTACT } from '~~/shared/contactgegevens'
const props = defineProps<{ open: boolean; contact: any }>()
const emit = defineEmits<{ sluit: []; gewijzigd: [] }>()
const toast = useToast()
const { me } = useMe()
const beheerder = computed(() => me.value?.gebruiker.rol === 'beheerder')
const status = ref('')
async function bewaar(patch: Record<string, unknown>) {
  status.value = 'Opslaan…'
  try { await $fetch(`/api/contacten/${props.contact.id}`, { method: 'PUT', body: patch }); status.value = 'Opgeslagen'; emit('gewijzigd') } catch (e) { status.value = 'Opslaan mislukt'; toast.toon(foutTekst(e), 'fout') }
}
const veld = (k: string) => (v: string) => bewaar({ [k]: v || null })
function bewaarAchternaam(v: string) { if (v.trim()) bewaar({ achternaam: v.trim() }) }
const rolOpties = ROLLEN_CONTACT.map((r) => ({ waarde: r, label: CONTACTROL_LABEL[r] }))
const STATUS_C: Record<string, string> = { onbekend: 'Onbekend', ja: 'Ja', nee: 'Nee' }

// Eigen velden: onder een vast kopje als de sectie zo heet, anders per eigen sectie.
const VAST = ['Persoon', 'Bereik']
const eigenVoor = (titel: string) => (props.contact?.eigenVelden ?? []).filter((v: any) => (v.sectie ?? '').trim() === titel)
const eigenGroepen = computed(() => {
  const m = new Map<string, any[]>()
  for (const v of props.contact?.eigenVelden ?? []) {
    const s = (v.sectie ?? '').trim()
    if (VAST.includes(s)) continue
    const t = s || 'Eigen velden'
    ;(m.get(t) ?? m.set(t, []).get(t)!).push(v)
  }
  return [...m.entries()]
})
const veldUit = (v: any) => v.bewerkbaarDoor === 'beheerder' && !beheerder.value
function bewaarCf(sleutel: string, w: unknown) { bewaar({ customFields: { [sleutel]: w === '' ? null : w } }) }

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
          <div class="fo-head-tekst">
            <span class="fo-kicker">Contactgegevens</span>
            <h2 id="ci-titel" class="fo-titel">{{ contact.naam }}</h2>
            <p v-if="contact.functie || contact.account" class="fo-meta">{{ [contact.functie, contact.account?.naam].filter(Boolean).join(' · ') }}</p>
            <p class="fo-meta ci-status" aria-live="polite">{{ status }}</p>
          </div>
          <button type="button" class="fo-sluit" aria-label="Sluiten" @click="emit('sluit')"><Icoon naam="X" /></button>
        </header>
        <div class="fo-body ci-body">
          <section class="ci-sectie" data-test="ci-persoon">
            <h3 class="ci-sectie-titel">Persoon</h3>
            <div class="ci-vast">
              <span class="ci-vast-label">Foto</span>
              <div class="ci-foto">
                <ContactFoto :naam="contact.naam" :foto-url="contact.fotoUrl" :grootte="56" />
                <ContactFotoKnoppen :contact-id="contact.id" :foto-url="contact.fotoUrl" @gewijzigd="emit('gewijzigd')" />
              </div>
            </div>
            <BewerkVeld label="Voornaam" :waarde="contact.voornaam" @bewaar="veld('voornaam')($event)" />
            <BewerkVeld label="Achternaam" :waarde="contact.achternaam" test="ci-achternaam" @bewaar="bewaarAchternaam" />
            <BewerkVeld label="Functie" :waarde="contact.functie" leeg="+ Voeg functie toe" test="ci-functie" @bewaar="veld('functie')($event)" />
            <BewerkVeld label="Rol" :waarde="contact.rol" type="select" :opties="rolOpties" test="ci-rol" @bewaar="bewaar({ rol: $event || 'onbekend' })" />
            <EigenVeldRegel v-for="v in eigenVoor('Persoon')" :key="v.sleutel" :veld="v" :waarde="contact.customFields?.[v.sleutel]" :uit="veldUit(v)" @bewaar="bewaarCf(v.sleutel, $event)" />
          </section>

          <section class="ci-sectie" data-test="ci-bereik">
            <h3 class="ci-sectie-titel">Bereik</h3>
            <BewerkVeld label="E-mail" :waarde="contact.email" type="email" leeg="+ Voeg e-mail toe" test="ci-email" @bewaar="veld('email')($event)" />
            <BewerkVeld label="Telefoon" :waarde="contact.telefoon" type="tel" leeg="+ Voeg telefoon toe" @bewaar="veld('telefoon')($event)" />
            <BewerkVeld label="Mobiel" :waarde="contact.mobiel" type="tel" leeg="+ Voeg mobiel toe" @bewaar="veld('mobiel')($event)" />
            <BewerkVeld label="LinkedIn" :waarde="contact.linkedin" type="url" leeg="+ Voeg LinkedIn-profiel toe" @bewaar="veld('linkedin')($event)" />
            <BewerkVeld label="Instagram" :waarde="contact.instagram" type="url" leeg="+ Voeg Instagram-profiel toe" @bewaar="veld('instagram')($event)" />
            <BewerkVeld label="Facebook" :waarde="contact.facebook" type="url" leeg="+ Voeg Facebook-profiel toe" @bewaar="veld('facebook')($event)" />
            <EigenVeldRegel v-for="v in eigenVoor('Bereik')" :key="v.sleutel" :veld="v" :waarde="contact.customFields?.[v.sleutel]" :uit="veldUit(v)" @bewaar="bewaarCf(v.sleutel, $event)" />
          </section>

          <section v-for="[sectie, velden] in eigenGroepen" :key="sectie" class="ci-sectie" data-test="contact-eigen-velden">
            <h3 class="ci-sectie-titel">{{ sectie }}</h3>
            <EigenVeldRegel v-for="v in velden" :key="v.sleutel" :veld="v" :waarde="contact.customFields?.[v.sleutel]" :uit="veldUit(v)" @bewaar="bewaarCf(v.sleutel, $event)" />
          </section>

          <section class="ci-sectie" data-test="ci-extra-bronnen">
            <h3 class="ci-sectie-titel">Extra bronnen</h3>
            <ExtraBronnen :bronnen="contact.extraBronnen ?? []" uitleg="Eigen webadressen met meer over dit contact, zoals een interview, een spreekbeurt of een profiel op de site van het bedrijf." @bewaar="bewaar({ extraBronnen: $event })" />
          </section>

          <section class="ci-sectie">
            <h3 class="ci-sectie-titel">Toestemming en voorkeur</h3>
            <div class="formulier-raster ci-raster">
              <label v-for="k in ['email', 'whatsapp']" :key="k" class="veld"><span class="veld-label">{{ k === 'email' ? 'E-mail' : 'WhatsApp' }}</span>
                <select class="invoer" :value="contact.consent?.[k]?.status ?? 'onbekend'" :data-test="`consent-${k}`" @change="bewaar({ consent: { [k]: ($event.target as HTMLSelectElement).value } })"><option v-for="(l, s) in STATUS_C" :key="s" :value="s">{{ l }}</option></select>
                <span v-if="contact.consent?.[k]?.op" class="veld-uitleg">{{ contact.consent[k].op.slice(0, 10) }} · {{ contact.consent[k].bron }}</span>
              </label>
              <label class="veld"><span class="veld-label">Voorkeurskanaal</span><select class="invoer" :value="contact.voorkeurskanaal ?? ''" @change="bewaar({ voorkeurskanaal: ($event.target as HTMLSelectElement).value || null })"><option value="">Geen</option><option value="telefoon">Telefoon</option><option value="email">E-mail</option><option value="whatsapp">WhatsApp</option></select></label>
            </div>
            <div class="schakel-rij ci-schakel"><div><span class="schakel-naam">Bel me niet</span><span class="veld-uitleg">Haalt het nummer uit elke bellijst.</span></div><Schakelaar :aan="contact.belMeNiet" label="Bel me niet" data-test="bel-me-niet" @wissel="bewaar({ belMeNiet: $event })" /></div>
          </section>

          <section class="ci-sectie">
            <h3 class="ci-sectie-titel">Status</h3>
            <p class="ci-tekst">{{ contact.status === 'vertrokken' ? `Vertrokken${contact.vertrokkenOp ? ` op ${contact.vertrokkenOp}` : ''}. De historie blijft bewaard.` : 'Werkt hier nog. Vertrokken in plaats van verwijderen: de historie blijft bewaard.' }}</p>
            <button type="button" class="dd-act ci-knop" data-test="vertrokken-knop" @click="bewaar({ status: contact.status === 'vertrokken' ? 'actief' : 'vertrokken' })">{{ contact.status === 'vertrokken' ? 'Weer actief' : 'Markeer als vertrokken' }}</button>
          </section>

          <section v-if="contact.kan?.verhuizen" class="ci-sectie" data-test="verhuizen">
            <h3 class="ci-sectie-titel">Verhuizen</h3>
            <p class="ci-tekst">Naar een ander bedrijf. De historie blijft bewaard.</p>
            <select v-model="verhuisNaar" class="invoer" aria-label="Nieuw bedrijf"><option value="">Kies een bedrijf</option><option v-for="b in bedrijven" :key="b.id" :value="b.id">{{ b.name }}</option></select>
            <button type="button" class="dd-act ci-knop" :disabled="!verhuisNaar" @click="verhuis">Verhuis</button>
          </section>
        </div>
      </aside>
    </div>
  </Teleport>
</template>

<style scoped>
.ci-status:empty { display: none; }
.ci-body { display: flex; flex-direction: column; gap: 16px; }
.ci-sectie { padding: 4px 16px 12px; background: var(--wit); border: 1px solid var(--border); }
.ci-sectie-titel { margin: 12px 0 4px; padding-bottom: 6px; border-bottom: 1px solid var(--border); font-family: var(--font-serif); font-size: 14px; font-weight: 700; color: var(--ink); }
.ci-vast { display: grid; grid-template-columns: 116px minmax(0, 1fr); gap: 12px; align-items: center; padding: 6px 0; }
.ci-vast-label { font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.ci-foto { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.ci-raster { margin-top: 8px; }
.ci-schakel { margin-top: 12px; }
.ci-tekst { margin: 8px 0; font-size: 13px; line-height: 1.5; color: var(--ink-soft); }
.ci-knop { margin-top: 8px; }
@media (max-width: 767px) { .ci-vast { grid-template-columns: 1fr; gap: 2px; } }
</style>
