<script setup lang="ts">
// Het accountplan in een venster (opzet van DealDrive). Kop: kicker Accountplan, titel, statuspil, account
// (link) en periode. Daaronder kaarten: Kerngegevens (eigenaar, geldigheid, "x van y klaar") met Markeer als
// afgerond of Heropenen; Contactpersonen met hun rol; Extra velden; de zes blokken (Klantinformatie,
// Doelstellingen (SMART), Kansen, Bedreigingen, Strategieën, Evaluatie); het Actieplan, waarin elke actie een
// taak op het account is. Voet: Verwijderen (rood, met bevestiging), Wijzigen, Open accountplan en Sluiten.
// Wijzigen zet het hele plan in het venster open (kerngegevens, eigenaar, contactpersonen, velden en blokken,
// met per blok een voorzet van de Pitstop) met Opslaan en Annuleren in de voet.
import { ACCOUNTPLAN_SECTIES, ACTIEPLAN_LEEG, WEERGAVE_LABEL, afrondVraag, dagKort, geldigheidLabel, metHoofdletter, type AccountplanSectie } from '~~/shared/accountplannen'
import { nlMoment } from '~~/shared/datum'
const props = defineProps<{ planId: string | null }>()
const emit = defineEmits<{ sluit: []; gewijzigd: []; verwijderd: [] }>()
const toast = useToast()
const plan = ref<any>(null)
const laden = ref(false)
const bewerk = ref(false)
const bezig = ref(false)
const vraagVerwijder = ref(false)
const vraagAfronden = ref<string | null>(null)
const concept = reactive<{ titel: string; eigenaarId: string; geldigVan: string; geldigTot: string; contactIds: string[]; velden: Record<string, unknown>; secties: Record<string, string> }>({ titel: '', eigenaarId: '', geldigVan: '', geldigTot: '', contactIds: [], velden: {}, secties: {} })
const nieuw = reactive({ titel: '', datum: '', contactId: '' })
// Opslaan-status in de kop (FlyoutShell): Gewijzigd in de bewerkstand tot Opslaan.
const opslag = useFlyoutOpslag()

async function laad() {
  if (!props.planId) { plan.value = null; return }
  laden.value = true
  try { plan.value = await $fetch(`/api/accountplannen/${props.planId}`) } catch (e) { toast.toon(foutTekst(e), 'fout'); emit('sluit') } finally { laden.value = false }
}
watch(() => props.planId, () => { bewerk.value = false; laad() }, { immediate: true })

const dag = (iso: string | null) => (iso ? dagKort(nlMoment(new Date(iso)).datum) : 'geen datum')
const kan = computed(() => !!plan.value?.kan?.bewerken)

function startBewerken() {
  const p = plan.value
  Object.assign(concept, {
    titel: p.titel, eigenaarId: p.eigenaar?.id ?? '', geldigVan: p.geldigVan ?? '', geldigTot: p.geldigTot ?? '', contactIds: p.beslissers.map((b: any) => b.id),
    velden: Object.fromEntries(p.velden.map((v: any) => [v.sleutel, v.waarde])), secties: { ...p.secties },
  })
  bewerk.value = true
}
async function bewaar() {
  bezig.value = true
  try {
    await opslag.bewaar(() => $fetch(`/api/accountplannen/${props.planId}`, {
      method: 'PUT',
      body: {
        titel: concept.titel, ...(concept.eigenaarId ? { eigenaarId: concept.eigenaarId } : {}), geldigVan: concept.geldigVan || null, geldigTot: concept.geldigTot || null,
        contactIds: concept.contactIds, secties: concept.secties, ...(plan.value.velden.length ? { velden: concept.velden } : {}),
      },
    }))
    toast.toon('Accountplan bewaard.'); bewerk.value = false; await laad(); emit('gewijzigd')
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
async function zetStatus(status: 'actueel' | 'afgerond') {
  vraagAfronden.value = null
  try { await $fetch(`/api/accountplannen/${props.planId}`, { method: 'PUT', body: { status } }); toast.toon(status === 'afgerond' ? 'Accountplan afgerond.' : 'Accountplan heropend.'); await laad(); emit('gewijzigd') } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
function wisselStatus() {
  if (plan.value.status === 'afgerond') return zetStatus('actueel')
  const vraag = afrondVraag(plan.value)
  if (vraag) vraagAfronden.value = vraag
  else zetStatus('afgerond')
}
async function zetActie(a: any, klaar: boolean) {
  try { await $fetch(`/api/accountplannen/${props.planId}/acties/${a.id}`, { method: 'PUT', body: { klaar } }); await laad(); emit('gewijzigd') } catch (e) { toast.toon(foutTekst(e), 'fout'); await laad() }
}
async function voegActieToe() {
  if (nieuw.titel.trim().length < 3) return
  try {
    await $fetch(`/api/accountplannen/${props.planId}/acties`, { method: 'POST', body: { titel: nieuw.titel, datum: nieuw.datum || null, contactId: nieuw.contactId || null } })
    toast.toon('Actie toegevoegd. Hij staat als taak op het account.')
    Object.assign(nieuw, { titel: '', datum: '', contactId: '' })
    await laad(); emit('gewijzigd')
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const weg = ref<any>(null)
async function haalWeg() {
  const a = weg.value; weg.value = null
  try { await $fetch(`/api/accountplannen/${props.planId}/acties/${a.id}`, { method: 'DELETE' }); toast.toon('Actie uit het plan gehaald; de taak is geannuleerd.'); await laad(); emit('gewijzigd') } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function verwijder() {
  vraagVerwijder.value = false
  try { await $fetch(`/api/accountplannen/${props.planId}`, { method: 'DELETE' }); toast.toon('Accountplan verwijderd. De acties staan nog als taak op het account.'); emit('verwijderd') } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
function annuleer() { bewerk.value = false; opslag.reset() }
function sluit() { if (bewerk.value) { annuleer(); return } emit('sluit') }
opslag.volg(() => (bewerk.value ? concept : null))
watch(bewerk, () => opslag.basis(), { flush: 'sync' })
const ai = computed(() => (plan.value ? { accountId: plan.value.account?.id ?? null, label: plan.value.titel, vraag: '', voorstellen: ['Wat ontbreekt er nog in dit plan?', 'Welke actie heeft nu de meeste impact?', 'Vat dit accountplan samen'] } : null))
const conceptVoorAi = computed(() => ({ ...concept.secties, geldigTot: concept.geldigTot || null }))
</script>

<template>
  <Teleport to="body">
    <FlyoutShell v-if="planId" open titel-id="apf-titel" breedte="breed" overlay-klasse="fo-overlay--donker" sluit-test="apf-sluit" :opslag="opslag" :ai="ai" data-test="ap-flyout" @sluit="sluit" @bewaar="bewaar">
      <template #kop>
        <span class="fo-kicker"><Icoon naam="ClipboardCheck" :grootte="12" /> Accountplan</span>
        <h2 id="apf-titel" class="fo-titel">{{ plan?.titel ?? 'Accountplan' }}</h2>
        <p v-if="plan" class="fo-meta apf-meta">
          <Label soort="plan" :waarde="plan.weergave" :tekst="WEERGAVE_LABEL[plan.weergave as 'actueel']" data-test="apf-status" />
          <NuxtLink v-if="plan.account" :to="`/accounts/${plan.account.id}`" class="fo-link" data-test="apf-account">{{ plan.account.naam }}</NuxtLink>
          <span class="tnum" data-test="apf-periode">{{ metHoofdletter(geldigheidLabel(plan)) }}</span>
        </p>
      </template>

      <div class="fo-body">
        <p v-if="laden && !plan" class="fo-leeg">Laden...</p>
        <template v-else-if="plan">
          <!-- Kerngegevens -->
          <article class="fo-blok fo-blok--accent" data-test="apf-kern">
            <div class="fo-blok-kop">
              <span class="fo-blok-kicker">Kerngegevens</span>
              <button v-if="kan && !bewerk" type="button" class="dd-act apf-afronden" data-test="apf-afronden" @click="wisselStatus">{{ plan.status === 'afgerond' ? 'Heropenen' : 'Markeer als afgerond' }}</button>
            </div>
            <template v-if="bewerk">
              <label class="veld"><span class="veld-label">Titel</span><input v-model="concept.titel" class="invoer" maxlength="160" data-test="apf-titel-invoer"></label>
              <label v-if="plan.eigenaren.length > 1" class="veld mt-8"><span class="veld-label">Eigenaar</span>
                <select v-model="concept.eigenaarId" class="invoer" data-test="apf-eigenaar"><option v-for="e in plan.eigenaren" :key="e.id" :value="e.id">{{ e.naam }}</option></select>
              </label>
              <div class="apf-rij">
                <label class="veld"><span class="veld-label">Geldig van</span><input v-model="concept.geldigVan" type="date" class="invoer tnum" data-test="apf-van"></label>
                <label class="veld"><span class="veld-label">Geldig tot</span><input v-model="concept.geldigTot" type="date" class="invoer tnum" data-test="apf-tot"></label>
              </div>
            </template>
            <dl v-else class="apf-kern">
              <div class="apf-kern-item"><dt>Eigenaar</dt><dd data-test="apf-eigenaar-naam">{{ plan.eigenaar?.naam ?? 'Niet toegewezen' }}</dd></div>
              <div class="apf-kern-item"><dt>Geldigheid</dt><dd class="tnum">{{ metHoofdletter(geldigheidLabel(plan)) }}</dd></div>
              <div class="apf-kern-item"><dt>Actieplan</dt><dd class="tnum" data-test="apf-voortgang">{{ plan.voortgang.klaar }} van {{ plan.voortgang.totaal }} klaar</dd></div>
            </dl>
          </article>

          <!-- Contactpersonen: het beslissingsproces in beeld -->
          <article class="fo-blok" data-test="apf-blok-contacten">
            <span class="fo-blok-kicker">Contactpersonen</span>
            <AccountplanContacten v-if="bewerk" v-model="concept.contactIds" :contacten="plan.contacten" bewerk prefix="apf" />
            <AccountplanContacten v-else :model-value="plan.beslissers.map((b: any) => b.id)" :contacten="plan.contacten" prefix="apf" />
          </article>

          <article v-if="plan.velden.length" class="fo-blok" data-test="apf-blok-velden">
            <span class="fo-blok-kicker">Extra velden</span>
            <AccountplanVelden v-if="bewerk" v-model="concept.velden" :velden="plan.velden" bewerk prefix="apf" />
            <AccountplanVelden v-else :velden="plan.velden" prefix="apf" />
          </article>

          <!-- De zes blokken -->
          <article v-for="s in ACCOUNTPLAN_SECTIES" :key="s.sleutel" class="fo-blok" :data-test="`apf-blok-${s.sleutel}`">
            <template v-if="bewerk">
              <label class="veld"><span class="fo-blok-kicker">{{ s.titel }}</span>
                <textarea v-model="concept.secties[s.sleutel]" class="invoer apf-tekstvak" rows="5" :placeholder="s.uitleg" :data-test="`apf-veld-${s.sleutel}`" />
              </label>
              <AccountplanVoorzet :doel="s.sleutel" :plan-id="plan.id" :concept="conceptVoorAi" :heeft-tekst="!!concept.secties[s.sleutel]?.trim()" @tekst="(t) => (concept.secties[s.sleutel] = t)" />
            </template>
            <template v-else>
              <span class="fo-blok-kicker">{{ s.titel }}</span>
              <p v-if="plan.secties[s.sleutel as AccountplanSectie]" class="fo-tekst apf-tekst">{{ plan.secties[s.sleutel as AccountplanSectie] }}</p>
              <p v-else class="apf-uitleg">{{ s.uitleg }}</p>
            </template>
          </article>

          <!-- Actieplan -->
          <article class="fo-blok fo-blok--agent" data-test="apf-actieplan">
            <div class="fo-blok-kop"><span class="fo-blok-kicker">Actieplan</span><span class="apf-teller tnum">{{ plan.voortgang.klaar }}/{{ plan.voortgang.totaal }}</span></div>
            <ul v-if="plan.acties.length" class="apf-acties" role="list">
              <li v-for="a in plan.acties" :key="a.id" class="apf-actie" :data-test="`apf-actie-${a.id}`">
                <label class="apf-vink"><input type="checkbox" :checked="a.klaar" :disabled="!kan" :aria-label="`Markeer ${a.titel} als klaar`" data-test="apf-vink" @change="zetActie(a, ($event.target as HTMLInputElement).checked)"></label>
                <span class="apf-actie-tekst">
                  <span class="apf-actie-titel" :class="{ 'apf-actie-titel--klaar': a.klaar }">{{ a.titel }}</span>
                  <span class="apf-actie-meta tnum">{{ dag(a.dueDate) }}<template v-if="a.contactNaam"> · {{ a.contactNaam }}</template></span>
                </span>
                <button v-if="kan" type="button" class="dd-act dd-act--icoon apf-weg" :aria-label="`Verwijder actie ${a.titel}`" title="Verwijder actie" @click="weg = a"><Icoon naam="Trash2" :grootte="14" /></button>
              </li>
            </ul>
            <p v-else class="apf-uitleg">{{ ACTIEPLAN_LEEG }}</p>
            <form v-if="kan && !bewerk" class="apf-nieuw" data-test="apf-actie-nieuw" @submit.prevent="voegActieToe">
              <label class="veld apf-nieuw-titel"><span class="sr-only">Nieuwe actie</span><input v-model="nieuw.titel" class="invoer" maxlength="200" placeholder="Nieuwe actie, begin met een werkwoord" data-test="apf-actie-titel"></label>
              <label class="veld"><span class="sr-only">Datum</span><input v-model="nieuw.datum" type="date" class="invoer tnum" aria-label="Datum" data-test="apf-actie-datum"></label>
              <label class="veld"><span class="sr-only">Contactpersoon</span>
                <select v-model="nieuw.contactId" class="invoer" data-test="apf-actie-contact"><option value="">Geen contactpersoon</option><option v-for="c in plan.contacten.filter((x: any) => !x.vertrokken)" :key="c.id" :value="c.id">{{ c.naam }}</option></select>
              </label>
              <button type="submit" class="dd-act apf-nieuw-knop" :disabled="nieuw.titel.trim().length < 3" data-test="apf-actie-toevoegen"><Icoon naam="Plus" :grootte="14" />Toevoegen</button>
            </form>
            <p class="apf-uitleg apf-hint">Elke actie is een taak op het account: je ziet hem ook op de accountkaart, op Vandaag en bij Taken.</p>
          </article>
        </template>
      </div>
      <template #voet>
        <footer v-if="plan" class="fo-foot fs-voet apf-voet">
          <template v-if="bewerk">
            <button type="button" class="dd-actie dd-actie--zwart fs-hoofdactie" :disabled="bezig || concept.titel.trim().length < 3" data-test="apf-bewaar" @click="bewaar"><Icoon naam="Check" :grootte="16" />Opslaan</button>
            <span class="fo-foot-vul" />
            <button type="button" class="dd-actie dd-actie--secundair" data-test="apf-annuleer" @click="annuleer">Annuleren</button>
          </template>
          <template v-else>
            <button v-if="plan.kan.verwijderen" type="button" class="dd-actie dd-actie--gevaar" data-test="apf-verwijder" @click="vraagVerwijder = true">Verwijderen</button>
            <span class="fo-foot-vul" />
            <button v-if="kan" type="button" class="dd-actie dd-actie--secundair" data-test="apf-wijzig" @click="startBewerken">Wijzigen</button>
            <FunctieLink :to="`/accountplannen/${plan.id}`" class="dd-actie dd-actie--secundair" data-test="apf-open">Open accountplan</FunctieLink>
            <button type="button" class="dd-actie dd-actie--zwart" data-test="apf-sluiten" @click="emit('sluit')">Sluiten</button>
          </template>
        </footer>
      </template>
    </FlyoutShell>
    <BevestigVenster :open="vraagVerwijder" titel="Accountplan verwijderen?" :tekst="`${plan?.titel ?? 'Dit plan'} verdwijnt, met alle blokken en notities. De acties blijven als taak op het account staan.`" bevestig="Verwijderen" gevaar @bevestigd="verwijder" @geannuleerd="vraagVerwijder = false" />
    <BevestigVenster :open="!!vraagAfronden" titel="Toch afronden?" :tekst="vraagAfronden ?? ''" bevestig="Afronden" @bevestigd="zetStatus('afgerond')" @geannuleerd="vraagAfronden = null" />
    <BevestigVenster :open="!!weg" titel="Actie uit het plan halen?" :tekst="`${weg?.titel ?? ''}: de taak wordt geannuleerd.`" bevestig="Uit het plan halen" gevaar @bevestigd="haalWeg" @geannuleerd="weg = null" />
  </Teleport>
</template>

<style scoped>
.apf-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; }
.apf-rij { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 10px; }
.apf-kern { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 0; }
.apf-kern-item dt { font-size: var(--fs-label); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.apf-kern-item dd { margin: 2px 0 0; font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
.apf-afronden { flex-shrink: 0; }
.apf-tekstvak { width: 100%; min-height: 96px; resize: vertical; }
.apf-tekst { white-space: pre-wrap; overflow-wrap: anywhere; }
.apf-uitleg { margin: 0; font-size: 13px; line-height: 1.5; color: var(--muted); }
.apf-hint { margin-top: 10px; font-size: 12px; }
.apf-teller { font-size: 12px; font-weight: 700; color: var(--muted); }
.apf-acties { list-style: none; margin: 0; padding: 0; }
.apf-actie { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border); }
.apf-actie:last-child { border-bottom: 0; }
.apf-vink { display: inline-flex; align-items: center; justify-content: center; min-width: 36px; min-height: 36px; cursor: pointer; }
.apf-vink input { width: 18px; height: 18px; accent-color: var(--ink); }
.apf-actie-tekst { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.apf-actie-titel { font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
.apf-actie-titel--klaar { text-decoration: line-through; color: var(--muted); }
.apf-actie-meta { font-size: 12px; color: var(--muted); }
.apf-nieuw { display: grid; grid-template-columns: 150px minmax(0, 1fr) auto; gap: 8px; align-items: end; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border); }
.apf-nieuw-titel { grid-column: 1 / -1; }
.apf-nieuw-knop { min-height: 40px; display: inline-flex; align-items: center; gap: 4px; }
.apf-voet { flex-wrap: wrap; gap: 8px; }
@media (max-width: 719px) {
  .apf-voet { row-gap: 8px; }
  .apf-voet .fo-foot-vul { display: none; }
  .apf-voet .dd-actie { flex: 1 1 auto; }
  .apf-rij, .apf-nieuw { grid-template-columns: 1fr; }
  .apf-kern { grid-template-columns: 1fr; }
  .apf-vink, .apf-weg, .apf-afronden, .apf-nieuw-knop { min-width: var(--touch-target-min); min-height: var(--touch-target-min); }
}
</style>
