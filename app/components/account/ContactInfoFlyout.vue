<script setup lang="ts">
// Info-venster van de contactkaart in de opzet van DealDrive (ContactInfoFlyout): kop "Contactgegevens" met
// naam en functie; blokken Persoon (met foto), Bereik en eigen velden met per veld inline bewerken (potlood,
// "+ Voeg ... toe" als het leeg is). Daarna Extra bronnen, Toestemming en voorkeur met "Bel me niet",
// Status (vertrokken in plaats van verwijderen) en voor Expert Verhuizen. Elke wijziging bewaart zichzelf.
import { CONTACTROL_LABEL, ROLLEN_CONTACT } from '~~/shared/contactgegevens'
import type { KiesAccount } from '~/utils/kiezers'
const props = defineProps<{ open: boolean; contact: any }>()
const emit = defineEmits<{ sluit: []; gewijzigd: [] }>()
const toast = useToast()
const { me } = useMe()
const beheerder = computed(() => me.value?.gebruiker.rol === 'beheerder')
// Opslaan-status in de kop (FlyoutShell): typen in een veld is Gewijzigd, bewaren Opslaan… en dan
// Opgeslagen om HH:MM. Sluiten met een open veld vraagt of je het wilt bewaren.
const opslag = useFlyoutOpslag()
const body = ref<HTMLElement | null>(null)
const shell = ref<{ vraagSluiten: () => Promise<void> } | null>(null)
function typ(e: Event) { if ((e.target as HTMLElement | null)?.closest('.bv-bewerk')) opslag.gewijzigd() }
function veldDicht() { nextTick(() => { if (opslag.stand === 'gewijzigd' && !body.value?.querySelector('.bv--bewerk')) opslag.basis() }) }
function bewaarOpen() { for (const f of body.value?.querySelectorAll<HTMLFormElement>('.bv-bewerk') ?? []) f.requestSubmit(); veldDicht() }
const ai = computed(() => ({ accountId: props.contact?.accountId ?? null, label: props.contact?.naam, vraag: '', voorstellen: [`Wat weet ik over ${props.contact?.voornaam || props.contact?.naam || 'dit contact'}?`, 'Schrijf een korte introductiemail', 'Wie beïnvloedt dit contact?'] }))
const telHref = computed(() => { const t = props.contact?.mobiel || props.contact?.telefoon; return t ? `tel:${String(t).replace(/[^\d+]/g, '')}` : null })
async function bewaar(patch: Record<string, unknown>) {
  try { await opslag.bewaar(() => $fetch(`/api/contacten/${props.contact.id}`, { method: 'PUT', body: patch })); emit('gewijzigd') } catch (e) { toast.toon(foutTekst(e), 'fout') }
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

// Verhuizen (Expert): het nieuwe bedrijf kies je met de gedeelde zoekkiezer (eigen recente prospects eerst).
const verhuisNaar = ref<KiesAccount | null>(null)
async function zoekBedrijf(q: string) { return (await zoekAccounts(q)).filter((a) => a.id !== props.contact?.accountId) }
async function verhuis() {
  if (!verhuisNaar.value) return
  try { await $fetch(`/api/contacten/${props.contact.id}/verhuis`, { method: 'POST', body: { accountId: verhuisNaar.value.id } }); toast.toon('Contact verhuisd.'); verhuisNaar.value = null; emit('gewijzigd') } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
</script>

<template>
  <FlyoutShell ref="shell" :open="open && !!contact" kicker="Contactgegevens" :titel="contact?.naam" :meta="[contact?.functie, contact?.account?.naam].filter(Boolean).join(' · ') || null" titel-id="ci-titel" breedte="smal" :opslag="opslag" :ai="ai" data-test="contact-info-flyout" @sluit="emit('sluit')" @bewaar="bewaarOpen">
        <div ref="body" class="fo-body ci-body" @input="typ" @click="veldDicht" @keyup.esc="veldDicht">
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
            <ZoekKiezer :zoek="zoekBedrijf" kop="Nieuw bedrijf" :gekozen="verhuisNaar" wis-label="Wis gekozen bedrijf" placeholder="Zoek een prospect of klant op naam" data-test="ci-verhuis-zoek" gekozen-test="ci-verhuis-keuze" :optie-test="() => 'ci-verhuis-optie'" :sub="accountSub" leeg="Geen bedrijf gevonden." @kies="(a) => (verhuisNaar = a)" @wis="verhuisNaar = null" />
            <button type="button" class="dd-act ci-knop" :disabled="!verhuisNaar" @click="verhuis">Verhuis</button>
          </section>
        </div>
    <template #voet>
      <footer class="fo-foot fs-voet">
        <button type="button" class="dd-actie dd-actie--zwart fs-hoofdactie" data-test="ci-klaar" @click="shell?.vraagSluiten()"><Icoon naam="Check" :grootte="16" />Klaar</button>
        <span class="fo-foot-vul" />
        <a v-if="telHref" :href="telHref" class="fs-ibtn" title="Bellen" aria-label="Bellen" data-test="ci-bel"><Icoon naam="Phone" :grootte="18" /></a>
        <a v-if="contact?.email" :href="`mailto:${contact.email}`" class="fs-ibtn" title="Mailen" aria-label="Mailen" data-test="ci-mail"><Icoon naam="Mail" :grootte="18" /></a>
      </footer>
    </template>
  </FlyoutShell>
</template>

<style scoped>
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
