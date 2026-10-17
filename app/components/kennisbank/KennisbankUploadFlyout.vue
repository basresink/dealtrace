<script setup lang="ts">
// Een document toevoegen aan de kennisbank (opzet van DealDrive KennisbankUploadFlyout): bestand slepen of
// kiezen, naam, type (of automatisch herkennen), versie, beschrijving en de koppeling aan bedrijven en contacten.
// Vanaf de account- of contactkaart staat die koppeling al vast. Het document verschijnt dan op het tabblad
// Documenten van die kaarten en blijft in de kennisbank zoekbaar.
import { DOCUMENT_TYPES, MAX_GROOTTE, TYPE_LABEL, grootteLabel, raadType } from '~~/shared/kennisbank'

const props = defineProps<{
  open: boolean
  /** Vanaf de accountkaart of contactkaart: deze koppeling staat vast. */
  account?: { id: string; naam: string } | null
  contact?: { id: string; naam: string } | null
}>()
const emit = defineEmits<{ sluit: []; bewaard: [id: string] }>()
const toast = useToast()
const bestand = ref<File | null>(null)
const naam = ref('')
const type = ref('')
const versie = ref('1')
const beschrijving = ref('')
const accounts = ref<{ id: string; naam: string }[]>([])
const contacten = ref<{ id: string; naam: string; accountNaam?: string | null }[]>([])
const bezig = ref(false)
const sleep = ref(false)
const vast = computed(() => !!(props.account || props.contact))

watch(() => props.open, (o) => {
  if (!o) return
  bestand.value = null; naam.value = ''; type.value = ''; versie.value = '1'; beschrijving.value = ''
  accounts.value = []; contacten.value = []
})
function kies(f: File | undefined | null) { if (!f) return; bestand.value = f; naam.value = f.name }
const geraden = computed(() => (naam.value ? TYPE_LABEL[raadType(naam.value, bestand.value?.type ?? '')] : null))
const base64 = (f: File) => new Promise<string>((ok, nee) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] ?? ''); r.onerror = nee; r.readAsDataURL(f) })

function voegAccountToe(a: { id: string; naam: string }) { if (!accounts.value.some((x) => x.id === a.id)) accounts.value.push({ id: a.id, naam: a.naam }) }
function voegContactToe(c: { id: string; naam: string; accountNaam?: string | null }) { if (!contacten.value.some((x) => x.id === c.id)) contacten.value.push({ id: c.id, naam: c.naam, accountNaam: c.accountNaam }) }

async function bewaar() {
  if (!bestand.value) return
  if (bestand.value.size > MAX_GROOTTE) { toast.toon('Het document is groter dan 8 MB.', 'fout'); return }
  bezig.value = true
  try {
    const body = {
      naam: naam.value.trim() || bestand.value.name, mime: bestand.value.type || '', data: await base64(bestand.value),
      type: type.value || undefined, versie: versie.value, beschrijving: beschrijving.value,
      accountIds: props.contact ? [] : props.account ? [props.account.id] : accounts.value.map((a) => a.id),
      contactIds: props.contact ? [props.contact.id] : vast.value ? [] : contacten.value.map((c) => c.id),
    }
    const r = await $fetch<{ id: string; tekstStatus: string }>('/api/documenten', { method: 'POST', body })
    toast.toon(r.tekstStatus === 'niet-gelezen' ? 'Document bewaard. Het lezen van de inhoud is mislukt (een scan of een beveiligd bestand?); de AI kent alleen titel, type en koppelingen.' : r.tekstStatus === 'gelezen' ? 'Document bewaard in de kennisbank. De AI kan vragen over de inhoud beantwoorden.' : 'Document bewaard in de kennisbank.')
    emit('bewaard', r.id)
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
</script>

<template>
  <FlyoutShell v-if="open" open titel-id="kbu-titel" breedte="breed" data-test="kennisbank-upload" @sluit="emit('sluit')">
      <template #kop>
            <span class="fo-kicker"><Icoon naam="Upload" :grootte="12" /> Kennisbank · upload</span>
            <h2 id="kbu-titel" class="fo-titel">{{ contact ? contact.naam : account ? account.naam : 'Document toevoegen' }}</h2>
            <p class="fo-meta">{{ vast ? 'Het document komt in de kennisbank en staat op het tabblad Documenten van deze kaart.' : 'Koppel het aan bedrijven of contacten: dan staat het ook op hun tabblad Documenten en blijft het in de kennisbank zoekbaar.' }}</p></template>
        <form id="kbu-form" class="fs-form" @submit.prevent="bewaar">
        <div class="fo-body fo-body--formulier">
          <label class="kbu-drop" :class="{ 'kbu-drop--over': sleep, 'kbu-drop--vol': bestand }" @dragover.prevent="sleep = true" @dragleave="sleep = false" @drop.prevent="sleep = false; kies($event.dataTransfer?.files?.[0])">
            <Icoon :naam="bestand ? 'FileText' : 'Upload'" :grootte="22" />
            <span><strong>{{ bestand ? bestand.name : 'Sleep een bestand hierheen' }}</strong><br><span class="meta">{{ bestand ? grootteLabel(bestand.size) : 'of klik om te kiezen. PDF, Word, Excel, PowerPoint, tekst, Markdown of afbeelding, tot 8 MB.' }}</span></span>
            <input type="file" class="kbu-invoer" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.markdown,.csv,image/jpeg,image/png,image/webp" data-test="document-bestand" @change="kies(($event.target as HTMLInputElement).files?.[0])">
          </label>
          <label class="veld"><span class="veld-label">Naam</span><input v-model="naam" class="invoer" maxlength="200" data-test="document-naam"></label>
          <div class="kbu-rij">
            <label class="veld"><span class="veld-label">Type</span>
              <select v-model="type" class="invoer" data-test="document-type">
                <option value="">Automatisch{{ geraden ? ` (${geraden})` : '' }}</option>
                <option v-for="t in DOCUMENT_TYPES" :key="t" :value="t">{{ TYPE_LABEL[t] }}</option>
              </select>
            </label>
            <label class="veld"><span class="veld-label">Versie</span><input v-model="versie" class="invoer" maxlength="20" inputmode="decimal" data-test="document-versie"></label>
          </div>
          <label class="veld"><span class="veld-label">Beschrijving <span class="meta">(optioneel)</span></span><textarea v-model="beschrijving" class="invoer" rows="2" maxlength="1000" placeholder="Wat staat erin en wanneer gebruik je het?" data-test="document-beschrijving" /></label>

          <template v-if="!vast">
            <div class="veld">
              <span class="veld-label">Koppel aan een bedrijf</span>
              <div v-if="accounts.length" class="kbu-chips"><span v-for="a in accounts" :key="a.id" class="chip" data-test="kbu-account-chip">{{ a.naam }}<button type="button" class="chip-weg" :aria-label="`${a.naam} ontkoppelen`" @click="accounts = accounts.filter((x) => x.id !== a.id)">×</button></span></div>
              <ZoekKiezer :zoek="zoekAccounts" placeholder="Zoek op naam van de prospect of klant…" label="Zoek een bedrijf" data-test="kbu-account" :optie-test="() => 'kbu-account-optie'" :sub="accountSub" leeg="Geen bedrijf gevonden." @kies="voegAccountToe" />
            </div>
            <div class="veld">
              <span class="veld-label">Koppel aan contact</span>
              <div v-if="contacten.length" class="kbu-chips"><span v-for="c in contacten" :key="c.id" class="chip" data-test="kbu-contact-chip">{{ c.naam }}<button type="button" class="chip-weg" :aria-label="`${c.naam} ontkoppelen`" @click="contacten = contacten.filter((x) => x.id !== c.id)">×</button></span></div>
              <ZoekKiezer :zoek="(q: string) => zoekContacten(q)" placeholder="Zoek op contactnaam…" label="Zoek een contact" data-test="kbu-contact" :optie-test="() => 'kbu-contact-optie'" :sub="(c) => contactSub(c)" leeg="Geen contact gevonden." @kies="voegContactToe" />
            </div>
          </template>
          <p v-else class="meta kbu-vast" data-test="kbu-vast"><Icoon naam="Link" :grootte="14" /> Gekoppeld aan {{ contact ? contact.naam : account!.naam }}</p>
        </div>
        </form>
      <template #voet>
        <footer class="fo-foot fs-voet">
          <button type="submit" form="kbu-form" class="dd-actie dd-actie--zwart fs-hoofdactie" :disabled="bezig || !bestand" data-test="document-bewaar"><Icoon naam="Check" :grootte="16" />Uploaden</button>
          <span class="fo-foot-vul" />
        </footer>
      </template>
    </FlyoutShell>
</template>

<style scoped>
.kbu-drop { position: relative; display: flex; align-items: center; gap: 14px; padding: 24px 20px; border: 1px dashed var(--border-strong); background: var(--surface); cursor: pointer; }
.kbu-drop--over { border-color: var(--ink); background: var(--yellow-soft); }
.kbu-drop--vol { border-style: solid; }
.kbu-invoer { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.kbu-rij { display: grid; grid-template-columns: 2fr 1fr; gap: 12px; }
.kbu-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.kbu-vast { display: flex; align-items: center; gap: 6px; }
@media (max-width: 719px) {
  .kbu-rij { grid-template-columns: 1fr; }
  .kbu-chips .chip-weg { min-width: 44px; min-height: 44px; }
}
</style>
