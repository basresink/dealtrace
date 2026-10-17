<script setup lang="ts">
// Het accountplan in een venster (opzet van DealDrive): kicker Accountplan, naam, statuspil, account (link) en
// periode; de blokken met hun uitleg (klantinformatie, doelen SMART, kansen, bedreigingen, strategieën,
// evaluatie) en het actieplan, waarin elke actie een taak op het account is (vinkje, titel, datum,
// verwijderen). Voet: Verwijderen, Wijzigen, Open accountplan en Sluiten. Wijzigen zet de kerngegevens en
// de blokken in het venster zelf open.
import { ACCOUNTPLAN_SECTIES, ACTIEPLAN_UITLEG, WEERGAVE_LABEL, dagKort, geldigheidLabel, type AccountplanSectie } from '~~/shared/accountplannen'
import { nlMoment } from '~~/shared/datum'
const props = defineProps<{ planId: string | null }>()
const emit = defineEmits<{ sluit: []; gewijzigd: []; verwijderd: [] }>()
const toast = useToast()
const plan = ref<any>(null)
const laden = ref(false)
const bewerk = ref(false)
const bezig = ref(false)
const vraagVerwijder = ref(false)
const concept = reactive<{ titel: string; geldigVan: string; geldigTot: string; secties: Record<string, string> }>({ titel: '', geldigVan: '', geldigTot: '', secties: {} })

async function laad() {
  if (!props.planId) { plan.value = null; return }
  laden.value = true
  try { plan.value = await $fetch(`/api/accountplannen/${props.planId}`) } catch (e) { toast.toon(foutTekst(e), 'fout'); emit('sluit') } finally { laden.value = false }
}
watch(() => props.planId, () => { bewerk.value = false; laad() }, { immediate: true })

const dag = (iso: string | null) => (iso ? dagKort(nlMoment(new Date(iso)).datum) : 'geen datum')

function startBewerken() {
  const p = plan.value
  Object.assign(concept, { titel: p.titel, geldigVan: p.geldigVan ?? '', geldigTot: p.geldigTot ?? '', secties: { ...p.secties } })
  bewerk.value = true
}
async function bewaar() {
  bezig.value = true
  try {
    await opslag.bewaar(() => $fetch(`/api/accountplannen/${props.planId}`, { method: 'PUT', body: { titel: concept.titel, geldigVan: concept.geldigVan || null, geldigTot: concept.geldigTot || null, secties: concept.secties } }))
    toast.toon('Accountplan bewaard.'); bewerk.value = false; await laad(); emit('gewijzigd')
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
async function zetActie(a: any, klaar: boolean) {
  try { await $fetch(`/api/accountplannen/${props.planId}/acties/${a.id}`, { method: 'PUT', body: { klaar } }); await laad(); emit('gewijzigd') } catch (e) { toast.toon(foutTekst(e), 'fout'); await laad() }
}
async function haalWeg(a: any) {
  if (!confirm(`Actie "${a.titel}" uit het plan halen? De taak wordt geannuleerd.`)) return
  try { await $fetch(`/api/accountplannen/${props.planId}/acties/${a.id}`, { method: 'DELETE' }); toast.toon('Actie uit het plan gehaald.'); await laad(); emit('gewijzigd') } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function verwijder() {
  vraagVerwijder.value = false
  try { await $fetch(`/api/accountplannen/${props.planId}`, { method: 'DELETE' }); toast.toon('Accountplan verwijderd. De acties staan nog als taak op het account.'); emit('verwijderd') } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
function sluit() { if (bewerk.value) { bewerk.value = false; return } emit('sluit') }
// Opslaan-status in de kop (FlyoutShell): Gewijzigd in de bewerkstand tot Opslaan; Vraag AI met dit plan.
const opslag = useFlyoutOpslag()
opslag.volg(() => (bewerk.value ? concept : null))
watch(bewerk, () => opslag.basis(), { flush: 'sync' })
const ai = computed(() => (plan.value ? { accountId: plan.value.account?.id ?? plan.value.accountId ?? null, label: plan.value.titel, vraag: '', voorstellen: ['Wat ontbreekt er nog in dit plan?', 'Welke actie heeft nu de meeste impact?', 'Vat dit accountplan samen'] } : null))
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
              <span class="tnum">{{ geldigheidLabel(plan) }}</span>
            </p></template>

        <div class="fo-body">
          <p v-if="laden && !plan" class="fo-leeg">Laden...</p>
          <template v-else-if="plan">
            <!-- Wijzigen: kerngegevens en blokken in het venster -->
            <template v-if="bewerk">
              <article class="fo-blok fo-blok--accent">
                <span class="fo-blok-kicker">Kerngegevens</span>
                <label class="veld"><span class="veld-label">Titel</span><input v-model="concept.titel" class="invoer" maxlength="160" data-test="apf-titel-invoer"></label>
                <div class="apf-rij">
                  <label class="veld"><span class="veld-label">Geldig van</span><input v-model="concept.geldigVan" type="date" class="invoer tnum"></label>
                  <label class="veld"><span class="veld-label">Geldig tot</span><input v-model="concept.geldigTot" type="date" class="invoer tnum"></label>
                </div>
              </article>
              <article v-for="s in ACCOUNTPLAN_SECTIES" :key="s.sleutel" class="fo-blok">
                <label class="veld"><span class="fo-blok-kicker">{{ s.titel }}</span>
                  <textarea v-model="concept.secties[s.sleutel]" class="invoer apf-tekstvak" rows="4" :placeholder="s.uitleg" :data-test="`apf-veld-${s.sleutel}`" />
                </label>
              </article>
            </template>

            <template v-else>
              <article v-for="s in ACCOUNTPLAN_SECTIES" :key="s.sleutel" class="fo-blok" :data-test="`apf-blok-${s.sleutel}`">
                <span class="fo-blok-kicker">{{ s.titel }}</span>
                <p v-if="plan.secties[s.sleutel as AccountplanSectie]" class="fo-tekst">{{ plan.secties[s.sleutel as AccountplanSectie] }}</p>
                <p v-else class="apf-uitleg">{{ s.uitleg }}</p>
              </article>
            </template>

            <article class="fo-blok fo-blok--agent" data-test="apf-actieplan">
              <div class="fo-blok-kop"><span class="fo-blok-kicker">Actieplan</span><span class="apf-teller tnum">{{ plan.voortgang.klaar }}/{{ plan.voortgang.totaal }}</span></div>
              <ul v-if="plan.acties.length" class="apf-acties" role="list">
                <li v-for="a in plan.acties" :key="a.id" class="apf-actie" :data-test="`apf-actie-${a.id}`">
                  <label class="apf-vink"><input type="checkbox" :checked="a.klaar" :disabled="!plan.kan.bewerken" :aria-label="`Markeer ${a.titel} als klaar`" data-test="apf-vink" @change="zetActie(a, ($event.target as HTMLInputElement).checked)"></label>
                  <span class="apf-actie-tekst">
                    <span class="apf-actie-titel" :class="{ 'apf-actie-titel--klaar': a.klaar }">{{ a.titel }}</span>
                    <span class="apf-actie-meta tnum">{{ dag(a.dueDate) }}<template v-if="a.contactNaam"> · {{ a.contactNaam }}</template></span>
                  </span>
                  <button v-if="plan.kan.bewerken" type="button" class="dd-act dd-act--icoon apf-weg" :aria-label="`Verwijder actie ${a.titel}`" title="Verwijder actie" @click="haalWeg(a)"><Icoon naam="Trash2" :grootte="14" /></button>
                </li>
              </ul>
              <p v-else class="apf-uitleg">Nog geen acties. Een strategie zonder acties met een datum blijft een voornemen.</p>
              <p class="apf-uitleg apf-hint">{{ ACTIEPLAN_UITLEG }} Acties voeg je toe op de pagina van het plan.</p>
            </article>
          </template>
        </div>
      <template #voet>
        <footer v-if="plan" class="fo-foot fs-voet apf-voet">
          <template v-if="bewerk">
            <button type="button" class="dd-actie dd-actie--zwart fs-hoofdactie" :disabled="bezig || concept.titel.trim().length < 3" data-test="apf-bewaar" @click="bewaar"><Icoon naam="Check" :grootte="16" />Opslaan</button>
            <span class="fo-foot-vul" />
            <button type="button" class="dd-actie dd-actie--secundair" @click="bewerk = false">Annuleren</button>
          </template>
          <template v-else>
            <NuxtLink :to="`/accountplannen/${plan.id}`" class="dd-actie dd-actie--zwart fs-hoofdactie" data-test="apf-open"><Icoon naam="ArrowRight" :grootte="16" />Open accountplan</NuxtLink>
            <span class="fo-foot-vul" />
            <button v-if="plan.kan.bewerken" type="button" class="fs-ibtn" title="Wijzigen" aria-label="Wijzigen" data-test="apf-wijzig" @click="startBewerken"><Icoon naam="Pencil" :grootte="18" /></button>
            <button v-if="plan.kan.bewerken" type="button" class="fs-ibtn fs-ibtn--rood" title="Verwijderen" aria-label="Verwijderen" data-test="apf-verwijder" @click="vraagVerwijder = true"><Icoon naam="Trash2" :grootte="18" /></button>
          </template>
        </footer>
      </template>
    </FlyoutShell>
    <BevestigVenster :open="vraagVerwijder" titel="Accountplan verwijderen?" :tekst="`${plan?.titel ?? 'Dit plan'} verdwijnt. De acties blijven als taak op het account staan.`" bevestig="Verwijderen" gevaar @bevestigd="verwijder" @geannuleerd="vraagVerwijder = false" />
  </Teleport>
</template>

<style scoped>
.apf-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; }
.apf-rij { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 10px; }
.apf-tekstvak { width: 100%; min-height: 96px; resize: vertical; }
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
@media (max-width: 719px) {
  .apf-voet { flex-wrap: wrap; row-gap: 8px; }
  .apf-voet .fo-foot-vul { display: none; }
  .apf-rij { grid-template-columns: 1fr; }
  .apf-vink, .apf-weg { min-width: var(--touch-target-min); min-height: var(--touch-target-min); }
}
</style>
