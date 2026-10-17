<script setup lang="ts">
// "Voeg toe" (F02, voorheen Neem over): de lead wordt een prospect. Bovenaan de gegevens uit de lead, die je
// aanvult (bedrijf en contactpersonen). Daaronder drie keuzes: voeg toe aan een prospectreis (reis en fase),
// maak een eerste taak aan (type, datum en contactpersoon) en, als accountplannen voor jouw niveau aanstaan,
// Maak accountplan aan (een leeg plan via /api/accountplannen). Een salesmanager kiest ook de eigenaar.
import { nlMoment, plusDagen } from '~~/shared/datum'
import { TAAK_TYPES } from '~~/shared/taken'
const props = defineProps<{ lead: any | null; context: any }>()
const emit = defineEmits<{ sluit: []; klaar: [uit: { id: string; naam: string; tekst: string; accountplanId: string | null }] }>()
const toast = useToast()

type Contact = { naam: string; functie: string; email: string; telefoon: string }
const g = reactive({ naam: '', plaats: '', postcode: '', adres: '', website: '', telefoon: '', email: '', kvk: '', medewerkers: '' as string | number })
const contacten = ref<Contact[]>([])
const eigenaar = ref('')
const inReis = ref(true)
const reisId = ref('')
const faseId = ref('')
const metTaak = ref(true)
const taakType = ref('belblok')
const taakDatum = ref('')
const taakContact = ref<number | ''>('')
const metPlan = ref(false)
const bezig = ref(false)
const fout = ref('')

const vandaag = () => nlMoment(new Date()).datum
/** De eerstvolgende werkdag na vandaag (zaterdag en zondag tellen niet). */
function volgendeWerkdag() {
  let d = plusDagen(vandaag(), 1)
  while ([0, 6].includes(new Date(`${d}T12:00:00Z`).getUTCDay())) d = plusDagen(d, 1)
  return d
}
const werkplekVan = (id: string) => (props.context?.team ?? []).find((u: any) => u.id === id)?.werkplek ?? props.context?.werkplek
const buiten = computed(() => werkplekVan(eigenaar.value) === 'buitendienst')
const ikZelf = computed(() => !eigenaar.value || eigenaar.value === props.context?.ik)

watch(() => props.lead, (l) => {
  if (!l) return
  const f = l.feiten ?? {}
  Object.assign(g, { naam: l.naam ?? f.naam ?? '', plaats: f.plaats ?? l.plaats ?? '', postcode: f.postcode ?? '', adres: f.adres ?? '', website: f.website ?? '', telefoon: '', email: '', kvk: f.kvk ?? '', medewerkers: f.medewerkers ?? '' })
  contacten.value = (f.contacten ?? []).map((c: any) => ({ naam: c.naam ?? '', functie: c.functie ?? '', email: c.email ?? '', telefoon: c.telefoon ?? '' }))
  eigenaar.value = props.context?.ik ?? ''
  inReis.value = true; reisId.value = ''; faseId.value = ''
  metTaak.value = true
  taakType.value = werkplekVan(eigenaar.value) === 'buitendienst' ? 'bezoek' : 'belblok'
  taakDatum.value = volgendeWerkdag()
  taakContact.value = contacten.value.length ? 0 : ''
  metPlan.value = false
  fout.value = ''
}, { immediate: true })
watch(eigenaar, () => { if (taakType.value === 'belblok' && buiten.value) taakType.value = 'bezoek' })
watch(reisId, () => { faseId.value = '' })

const reis = computed(() => (props.context?.reizen ?? []).find((r: any) => r.id === reisId.value) ?? null)
const typeKeuzes = computed(() => [
  ...(buiten.value ? [] : [{ id: 'belblok', label: ikZelf.value ? 'Bellen in je eerstvolgende acquisitieblok' : 'Bellen in het eerstvolgende acquisitieblok' }]),
  ...TAAK_TYPES.map((t) => ({ id: t.id, label: t.label })),
])
const contactKeuzes = computed(() => contacten.value.map((c, i) => ({ i, naam: c.naam.trim() })).filter((c) => c.naam))
watch(contactKeuzes, (k) => { if (taakContact.value !== '' && !k.some((c) => c.i === taakContact.value)) taakContact.value = '' })
const kanPlan = computed(() => !!props.context?.kan?.accountplan)

function nieuwContact() { contacten.value.push({ naam: '', functie: '', email: '', telefoon: '' }) }
function weg(i: number) {
  contacten.value.splice(i, 1)
  if (taakContact.value === i) taakContact.value = ''
  else if (typeof taakContact.value === 'number' && taakContact.value > i) taakContact.value--
}

async function voegToe() {
  if (!g.naam.trim()) { fout.value = 'Geef het bedrijf een naam.'; return }
  if (metTaak.value && taakType.value !== 'belblok' && (!taakDatum.value || taakDatum.value < vandaag())) { fout.value = 'Kies een datum vanaf vandaag voor de eerste taak.'; return }
  bezig.value = true; fout.value = ''
  try {
    const r = await $fetch<any>(`/api/leads/${props.lead.id}/overnemen`, {
      method: 'POST',
      body: {
        eigenaar: eigenaar.value || undefined,
        gegevens: { ...g, contacten: contacten.value },
        inReis: inReis.value, reisId: inReis.value ? reisId.value || undefined : undefined, faseId: inReis.value ? faseId.value || undefined : undefined,
        taak: metTaak.value ? { type: taakType.value, datum: taakType.value === 'belblok' ? null : taakDatum.value, contact: taakContact.value === '' ? null : taakContact.value } : null,
      },
    })
    let accountplanId: string | null = null
    let tekst = r.tekst as string
    if (metPlan.value && kanPlan.value) {
      try {
        const p = await $fetch<any>('/api/accountplannen', { method: 'POST', body: { accountId: r.id, titel: `Accountplan ${r.naam}` } })
        accountplanId = p.id
        tekst = `${tekst} Het accountplan staat klaar om in te vullen.`
      } catch (e) { toast.toon(`${r.naam} staat erbij, maar het accountplan lukte niet: ${foutTekst(e)}`, 'let-op') }
    }
    toast.toon(tekst, 'succes', { tekst: 'Open kaart', naar: `/accounts/${r.id}` })
    emit('klaar', { id: r.id, naam: r.naam, tekst, accountplanId })
  } catch (e) { fout.value = foutTekst(e); toast.toon(fout.value, 'fout') } finally { bezig.value = false }
}
// Flyoutstandaard (FlyoutShell): Escape, focus en de opslaan-status regelt de shell; Gewijzigd tot Voeg toe.
const opslag = useFlyoutOpslag()
opslag.volg(() => [g, contacten.value])
const ai = computed(() => ({ label: props.lead?.naam, vraag: '', voorstellen: ['Zoek de gegevens van dit bedrijf op', 'Bij welke doelgroep hoort dit bedrijf?', 'Wat is een goede eerste taak?'] }))
</script>

<template>
  <FlyoutShell v-if="lead" open titel-id="vt-titel" breedte="smal" :opslag="opslag" :ai="ai" data-test="voeg-toe-flyout" @sluit="emit('sluit')" @bewaar="voegToe">
    <template #kop><span class="fo-kicker">Voeg toe als prospect</span><h2 id="vt-titel" class="fo-titel">{{ lead.naam }}</h2></template>
      <form id="vt-form" class="fs-form" novalidate @submit.prevent="voegToe">
        <div class="fo-body fo-body--formulier">
          <article class="fo-blok" data-test="vt-gegevens">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Gegevens</h3></header>
            <p class="meta vt-uitleg">Uit de lead. Vul aan wat je weet; de bron blijft bij elk veld bewaard.</p>
            <div class="formulier-raster">
              <label class="veld vt-breed"><span class="veld-label">Bedrijfsnaam <span class="veld-verplicht">*</span></span><input v-model="g.naam" class="invoer" required maxlength="200" data-test="vt-naam"></label>
              <label class="veld"><span class="veld-label">Plaats</span><input v-model="g.plaats" class="invoer" autocomplete="address-level2" data-test="vt-plaats"></label>
              <label class="veld"><span class="veld-label">Postcode</span><input v-model="g.postcode" class="invoer" placeholder="1234 AB" autocomplete="postal-code" data-test="vt-postcode"></label>
              <label class="veld"><span class="veld-label">Adres</span><input v-model="g.adres" class="invoer" data-test="vt-adres"></label>
              <label class="veld"><span class="veld-label">Website</span><input v-model="g.website" class="invoer" placeholder="https://" inputmode="url" data-test="vt-website"></label>
              <label class="veld"><span class="veld-label">Telefoon</span><input v-model="g.telefoon" class="invoer" type="tel" autocomplete="tel" data-test="vt-telefoon"></label>
              <label class="veld"><span class="veld-label">E-mail</span><input v-model="g.email" class="invoer" type="email" placeholder="info@bedrijf.test" data-test="vt-email"></label>
              <label class="veld"><span class="veld-label">KvK-nummer</span><input v-model="g.kvk" class="invoer" inputmode="numeric" maxlength="12" data-test="vt-kvk"></label>
              <label class="veld"><span class="veld-label">Aantal medewerkers</span><input v-model="g.medewerkers" class="invoer" type="number" min="0" step="1" inputmode="numeric" data-test="vt-medewerkers"></label>
            </div>
            <div class="vt-contacten" data-test="vt-contacten">
              <p class="veld-label">Contactpersonen</p>
              <p v-if="!contacten.length" class="meta">Nog geen contactpersoon bekend.</p>
              <fieldset v-for="(c, i) in contacten" :key="i" class="vt-contact" :data-test="`vt-contact-${i}`">
                <legend class="sr-only">Contactpersoon {{ i + 1 }}</legend>
                <div class="formulier-raster">
                  <label class="veld"><span class="veld-label">Naam</span><input v-model="c.naam" class="invoer" maxlength="120" :data-test="`vt-contact-naam-${i}`"></label>
                  <label class="veld"><span class="veld-label">Functie</span><input v-model="c.functie" class="invoer" maxlength="120"></label>
                  <label class="veld"><span class="veld-label">E-mail</span><input v-model="c.email" class="invoer" type="email"></label>
                  <label class="veld"><span class="veld-label">Telefoon</span><input v-model="c.telefoon" class="invoer" type="tel"></label>
                </div>
                <button type="button" class="dd-act vt-weg" :aria-label="`Contactpersoon ${c.naam || i + 1} weghalen`" @click="weg(i)"><Icoon naam="X" :grootte="14" />Weghalen</button>
              </fieldset>
              <button type="button" class="dd-act" data-test="vt-contact-erbij" @click="nieuwContact"><Icoon naam="Plus" :grootte="14" />Contactpersoon</button>
            </div>
            <label v-if="context?.team?.length" class="veld mt-16"><span class="veld-label">Eigenaar</span>
              <select v-model="eigenaar" class="invoer" data-test="vt-eigenaar"><option v-for="u in context.team" :key="u.id" :value="u.id">{{ u.naam.replace(/^Testgebruiker /, '') }}{{ u.id === context.ik ? ' (jij)' : '' }}</option></select>
            </label>
          </article>

          <article class="fo-blok" data-test="vt-blok-reis">
            <label class="vink vt-keuze"><input v-model="inReis" type="checkbox" data-test="vt-reis-aan"> <span><strong>Voeg toe aan prospectreis</strong><span class="meta vt-keuze-uitleg">Het account start in een fase van de reis; de motor zet daarna de stappen klaar.</span></span></label>
            <div v-if="inReis" class="formulier-raster mt-12">
              <label class="veld"><span class="veld-label">Reis</span>
                <select v-model="reisId" class="invoer" data-test="vt-reis"><option value="">Voorstel van Dealtrace (past bij de doelgroep)</option><option v-for="r in context?.reizen ?? []" :key="r.id" :value="r.id">{{ r.naam }}{{ r.isStandaard && !/standaard/i.test(r.naam) ? ' · standaardreis' : '' }}</option></select>
              </label>
              <label v-if="reis?.fases?.length" class="veld"><span class="veld-label">Fase</span>
                <select v-model="faseId" class="invoer" data-test="vt-fase"><option value="">Instapfase{{ reis.fases.find((f: any) => f.id === reis.instapFaseId) ? `: ${reis.fases.find((f: any) => f.id === reis.instapFaseId).label}` : '' }}</option><option v-for="f in reis.fases" :key="f.id" :value="f.id">{{ f.label }}</option></select>
              </label>
            </div>
            <p v-else class="meta mt-8" data-test="vt-zonder-reis">Het account komt bij je prospects zonder reis. Je zet het later in een reis op de accountkaart.</p>
          </article>

          <article class="fo-blok" data-test="vt-blok-taak">
            <label class="vink vt-keuze"><input v-model="metTaak" type="checkbox" data-test="vt-taak-aan"> <span><strong>Maak een eerste taak aan</strong><span class="meta vt-keuze-uitleg">Zo staat de eerste stap meteen in je lijst.</span></span></label>
            <div v-if="metTaak" class="formulier-raster mt-12">
              <label class="veld"><span class="veld-label">Type</span>
                <select v-model="taakType" class="invoer" data-test="vt-taak-type"><option v-for="t in typeKeuzes" :key="t.id" :value="t.id">{{ t.label }}</option></select>
              </label>
              <label v-if="taakType !== 'belblok'" class="veld"><span class="veld-label">Datum</span><input v-model="taakDatum" class="invoer" type="date" :min="vandaag()" data-test="vt-taak-datum"></label>
              <label class="veld"><span class="veld-label">Contactpersoon</span>
                <select v-model="taakContact" class="invoer" data-test="vt-taak-contact"><option value="">Geen contactpersoon</option><option v-for="c in contactKeuzes" :key="c.i" :value="c.i">{{ c.naam }}</option></select>
              </label>
            </div>
          </article>

          <article v-if="kanPlan" class="fo-blok" data-test="vt-blok-plan">
            <label class="vink vt-keuze"><input v-model="metPlan" type="checkbox" data-test="vt-accountplan"> <span><strong>Maak accountplan aan</strong><span class="meta vt-keuze-uitleg">Een leeg accountplan op jouw naam, dat je daarna invult bij Accountplannen.</span></span></label>
          </article>
          <p v-if="fout" class="veld-fout" role="alert" data-test="vt-fout">{{ fout }}</p>
        </div>
      </form>
    <template #voet>
        <footer class="fo-foot fs-voet">
          <button type="submit" form="vt-form" class="dd-actie dd-actie--zwart fs-hoofdactie" :disabled="bezig || !g.naam.trim()" data-test="vt-opslaan"><Icoon naam="Plus" :grootte="16" />{{ bezig ? 'Bezig…' : 'Voeg toe' }}</button>
          <span class="fo-foot-vul" />
        </footer>
    </template>
  </FlyoutShell>
</template>

<style scoped>
.vt-uitleg { margin: 0 0 12px; }
.vt-breed { grid-column: 1 / -1; }
.vt-contacten { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; margin-top: 16px; }
.vt-contacten > .veld-label { margin: 0; }
.vt-contact { position: relative; width: 100%; margin: 0; padding: 12px; border: 1px solid var(--border); background: var(--surface); }
.vt-weg { margin-top: 8px; }
.vt-keuze { align-items: flex-start; gap: 10px; min-height: var(--touch-target-min); }
.vt-keuze input { margin-top: 3px; }
.vt-keuze-uitleg { display: block; margin-top: 2px; font-weight: 400; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
