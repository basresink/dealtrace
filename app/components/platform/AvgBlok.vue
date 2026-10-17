<script setup lang="ts">
// Klantflyout, blok Data en AVG (F23, bouwplan 15.2, pakket C). Wat er van deze klant in Dealtrace staat
// (alleen getallen, via dealtrace_platform_avg), de bronnen, de bewaartermijnen die de klant koos, de
// verwerkersovereenkomst, de export (die maakt de beheerder van de klant; de founder vraagt erom) en de
// AVG-verzoeken met hun termijn van 30 dagen. Een verzoek bevat nooit persoonsgegevens, alleen een kenmerk.
import { AVG_VERZOEK_LABEL, AVG_VERZOEK_SOORTEN, bronNaam, dagenTot, grootteTekst, kenmerkFout, verzoekStand, type AvgVerzoek, type AvgVerzoekSoort, type Verwerkersovereenkomst } from '~~/shared/platformAvg'
import { BEWAAR_SOORTEN, VASTE_TERMIJNEN, VERWERKERS, termijnTekst, type Bewaartermijnen } from '~~/shared/privacy'

interface Tellingen {
  accounts: number; prospects: number; klanten: number; gedeactiveerd: number; contacten: number; contactenVerrijkt: number; contactenImport: number
  leadsOpen: number; leadsAfgewezen: number; accountsPerBron: Record<string, number>; leadsPerBron: Record<string, number>
  activiteiten: number; verslagen: number; transcripten: number; bijlagen: number; bijlagenBytes: number; opnames: number
  onderdrukt: number; belMeNiet: number; laatsteExport: string | null; exports12m: number
}
const props = defineProps<{
  klantId: string
  vandaag: string
  avg: { tellingen: Tellingen | null; bewaren: { termijnen: Bewaartermijnen; ingesteld: boolean }; verwerkersovereenkomst: Verwerkersovereenkomst | null; verzoeken: AvgVerzoek[]; exportGevraagdOp: string | null }
}>()
const emit = defineEmits<{ gewijzigd: [] }>()
const toast = useToast()
const t = computed(() => props.avg.tellingen)
const datum = (d: string | null | undefined) => (d ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d.length === 10 ? `${d}T12:00:00Z` : d)) : '')
const bronnen = (r: Record<string, number>) => Object.entries(r).sort((a, b) => b[1] - a[1]).map(([b, n]) => `${bronNaam(b)} ${n}`).join(' · ') || 'geen'

// Verwerkersovereenkomst
const vo = reactive({ versie: '', getekendOp: '' })
const voOpen = ref(false)
function openVo() { Object.assign(vo, { versie: props.avg.verwerkersovereenkomst?.versie ?? '', getekendOp: props.avg.verwerkersovereenkomst?.getekendOp ?? props.vandaag }); voOpen.value = true }
async function bewaarVo() {
  try {
    await $fetch(`/api/platform/klanten/${props.klantId}/avg`, { method: 'PUT', body: { verwerkersovereenkomst: { versie: vo.versie, getekendOp: vo.getekendOp } } })
    voOpen.value = false; toast.toon('De verwerkersovereenkomst is vastgelegd.'); emit('gewijzigd')
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}

// Export: de beheerder maakt hem; de founder vraagt erom.
const exportOpen = ref(false)
const exportReden = ref('')
async function vraagExport() {
  try {
    await $fetch(`/api/platform/klanten/${props.klantId}/avg/export`, { method: 'POST', body: { reden: exportReden.value } })
    exportOpen.value = false; exportReden.value = ''; toast.toon('De beheerders hebben een melding om een export te maken.'); emit('gewijzigd')
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}

// Verzoeken
const nieuw = reactive({ open: false, soort: 'betrokkene-verwijderen' as AvgVerzoekSoort, kenmerk: '', ontvangenOp: '' })
const kenmerkMelding = computed(() => (nieuw.kenmerk ? kenmerkFout(nieuw.kenmerk) : null))
function openNieuw() { Object.assign(nieuw, { open: true, soort: 'betrokkene-verwijderen', kenmerk: '', ontvangenOp: props.vandaag }) }
async function legVast() {
  try {
    await $fetch(`/api/platform/klanten/${props.klantId}/avg/verzoeken`, { method: 'POST', body: { soort: nieuw.soort, kenmerk: nieuw.kenmerk, ontvangenOp: nieuw.ontvangenOp } })
    nieuw.open = false; toast.toon('Het verzoek is vastgelegd; de beheerders hebben een melding.'); emit('gewijzigd')
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function zetStatus(v: AvgVerzoek, status: 'afgehandeld' | 'open') {
  try {
    await $fetch(`/api/platform/klanten/${props.klantId}/avg/verzoeken/${v.id}`, { method: 'PUT', body: { status } })
    toast.toon(status === 'afgehandeld' ? `Verzoek ${v.kenmerk} is afgehandeld.` : `Verzoek ${v.kenmerk} staat weer open.`); emit('gewijzigd')
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const openVerzoeken = computed(() => props.avg.verzoeken.filter((v) => v.status === 'open').length)
function termijnZin(v: AvgVerzoek) {
  if (v.status === 'afgehandeld') return `afgehandeld op ${datum(v.afgehandeldOp)}`
  const n = dagenTot(v.termijnOp, props.vandaag)
  return n < 0 ? `${-n} ${-n === 1 ? 'dag' : 'dagen'} over tijd (termijn ${datum(v.termijnOp)})` : n === 0 ? 'termijn verloopt vandaag' : `nog ${n} ${n === 1 ? 'dag' : 'dagen'}, uiterlijk ${datum(v.termijnOp)}`
}
</script>

<template>
  <article class="fo-blok" data-test="klant-avg">
    <header class="fo-blok-kop"><h3 class="fo-blok-titel">Data en AVG</h3></header>

    <template v-if="t">
      <p class="fo-tekst">Alleen aantallen; de records zelf zie je als leverancier niet.</p>
      <div class="fo-cijfers avg-cijfers" data-test="avg-tellingen">
        <div class="fo-cijfer"><span class="fo-cijfer-label">Accounts</span><span class="fo-cijfer-waarde" data-test="avg-accounts">{{ t.accounts }}</span><span class="veld-uitleg">{{ t.prospects }} prospects · {{ t.klanten }} klanten</span></div>
        <div class="fo-cijfer"><span class="fo-cijfer-label">Contactpersonen</span><span class="fo-cijfer-waarde" data-test="avg-contacten">{{ t.contacten }}</span><span class="veld-uitleg">{{ t.contactenVerrijkt }} verrijkt · {{ t.contactenImport }} uit import</span></div>
        <div class="fo-cijfer"><span class="fo-cijfer-label">Activiteiten</span><span class="fo-cijfer-waarde">{{ t.activiteiten }}</span><span class="veld-uitleg">{{ t.verslagen }} verslagen</span></div>
        <div class="fo-cijfer"><span class="fo-cijfer-label">Bijlagen</span><span class="fo-cijfer-waarde">{{ t.bijlagen }}</span><span class="veld-uitleg">{{ grootteTekst(t.bijlagenBytes) }} · {{ t.opnames }} opnames</span></div>
        <div class="fo-cijfer"><span class="fo-cijfer-label">Leads</span><span class="fo-cijfer-waarde">{{ t.leadsOpen }}</span><span class="veld-uitleg">open · {{ t.leadsAfgewezen }} afgewezen</span></div>
        <div class="fo-cijfer"><span class="fo-cijfer-label">Niet benaderen</span><span class="fo-cijfer-waarde">{{ t.onderdrukt + t.belMeNiet }}</span><span class="veld-uitleg">{{ t.onderdrukt }} afgemeld · {{ t.belMeNiet }} bel-me-niet</span></div>
      </div>
      <dl class="avg-defs">
        <div class="def-rij"><dt>Bronnen van accounts</dt><dd data-test="avg-bronnen">{{ bronnen(t.accountsPerBron) }}</dd></div>
        <div class="def-rij"><dt>Bronnen van leads</dt><dd>{{ bronnen(t.leadsPerBron) }}</dd></div>
        <div class="def-rij"><dt>Transcripten</dt><dd>{{ t.transcripten }}</dd></div>
        <div class="def-rij"><dt>Gedeactiveerd</dt><dd>{{ t.gedeactiveerd }} prospects</dd></div>
      </dl>
    </template>
    <p v-else class="fo-tekst" data-test="avg-geen-tellingen">De aantallen verschijnen zodra migratie 0075 is toegepast.</p>

    <h4 class="veld-label mt-16">Bewaartermijnen</h4>
    <p class="fo-tekst">{{ avg.bewaren.ingesteld ? 'Zoals de klant ze koos bij Instellingen, Privacy:' : 'De klant koos nog niets; de standaard geldt:' }}</p>
    <dl class="avg-defs" data-test="avg-termijnen">
      <div v-for="d in BEWAAR_SOORTEN" :key="d.soort" class="def-rij"><dt>{{ d.naam }}</dt><dd>{{ termijnTekst(avg.bewaren.termijnen[d.soort]) }}</dd></div>
    </dl>
    <details class="mt-8"><summary>Vaste termijnen van Dealtrace</summary>
      <dl class="avg-defs"><div v-for="v in VASTE_TERMIJNEN" :key="v.onderwerp" class="def-rij"><dt>{{ v.onderwerp }}</dt><dd>{{ v.termijn }}. {{ v.gevolg }}</dd></div></dl>
    </details>

    <h4 class="veld-label mt-16">Verwerkersovereenkomst</h4>
    <p class="fo-tekst" data-test="avg-vo">
      <template v-if="avg.verwerkersovereenkomst">Getekend op {{ datum(avg.verwerkersovereenkomst.getekendOp) }}, versie {{ avg.verwerkersovereenkomst.versie }}.</template>
      <template v-else>Nog niet vastgelegd. Zonder getekende overeenkomst verwerk je geen gegevens van deze klant.</template>
    </p>
    <div v-if="voOpen" class="formulier-raster">
      <label class="veld"><span class="veld-label">Versie</span><input v-model="vo.versie" class="invoer" maxlength="40" placeholder="Bijvoorbeeld 2026.1" data-test="avg-vo-versie"></label>
      <label class="veld"><span class="veld-label">Getekend op</span><input v-model="vo.getekendOp" class="invoer" type="date" :max="vandaag" data-test="avg-vo-datum"></label>
      <div class="dd-acties"><button type="button" class="dd-act" @click="voOpen = false">Annuleren</button><button type="button" class="dd-act dd-act--primair" data-test="avg-vo-bewaar" @click="bewaarVo">Vastleggen</button></div>
    </div>
    <button v-else type="button" class="dd-act" data-test="avg-vo-open" @click="openVo">{{ avg.verwerkersovereenkomst ? 'Wijzigen' : 'Leg de ondertekening vast' }}</button>
    <details class="mt-8"><summary>Verwerkers van Dealtrace</summary>
      <dl class="avg-defs"><div v-for="v in VERWERKERS" :key="v.wat" class="def-rij"><dt>{{ v.wat }}</dt><dd>{{ v.waar }}</dd></div></dl>
    </details>

    <h4 class="veld-label mt-16">Export</h4>
    <p class="fo-tekst" data-test="avg-export">
      <template v-if="t?.laatsteExport">Laatste export door de beheerder op {{ datum(t.laatsteExport) }}; {{ t.exports12m }} in de afgelopen 12 maanden.</template>
      <template v-else-if="t">De beheerder heeft nog nooit een export gemaakt.</template>
      <template v-if="avg.exportGevraagdOp">Gevraagd op {{ datum(avg.exportGevraagdOp) }}.</template>
      Een export van klantdata maakt de beheerder zelf bij Instellingen, Privacy; jij kunt erom vragen.
    </p>
    <div v-if="exportOpen" class="formulier-raster">
      <label class="veld"><span class="veld-label">Waarom</span><input v-model="exportReden" class="invoer" maxlength="200" placeholder="Bijvoorbeeld: overstap na opzeggen" data-test="avg-export-reden"></label>
      <div class="dd-acties"><button type="button" class="dd-act" @click="exportOpen = false">Annuleren</button><button type="button" class="dd-act dd-act--primair" data-test="avg-export-verstuur" @click="vraagExport">Vraag de export</button></div>
    </div>
    <button v-else type="button" class="dd-act" data-test="avg-export-open" @click="exportOpen = true">Vraag de beheerder om een export</button>

    <h4 class="veld-label mt-16">AVG-verzoeken</h4>
    <p class="fo-tekst">{{ avg.verzoeken.length ? `${openVerzoeken} van ${avg.verzoeken.length} open.` : 'Geen verzoeken ontvangen.' }} Een verzoek handel je binnen 30 dagen af. Noteer alleen een kenmerk, nooit een naam of e-mailadres.</p>
    <ul v-if="avg.verzoeken.length" class="schakel-lijst" data-test="avg-verzoeken">
      <li v-for="v in avg.verzoeken" :key="v.id" class="schakel-rij avg-verzoek" :data-verzoek="v.kenmerk">
        <div class="avg-verzoek-tekst">
          <span class="schakel-naam">{{ AVG_VERZOEK_LABEL[v.soort] }} <Label soort="avgverzoek" :waarde="verzoekStand(v, vandaag)" /></span>
          <span class="veld-uitleg">Kenmerk {{ v.kenmerk }} · ontvangen {{ datum(v.ontvangenOp) }} · {{ termijnZin(v) }}</span>
        </div>
        <button v-if="v.status === 'open'" type="button" class="dd-act" data-test="avg-verzoek-af" @click="zetStatus(v, 'afgehandeld')">Afgehandeld</button>
        <button v-else type="button" class="dd-act" data-test="avg-verzoek-heropen" @click="zetStatus(v, 'open')">Heropen</button>
      </li>
    </ul>
    <div v-if="nieuw.open" class="formulier-raster mt-8">
      <label class="veld"><span class="veld-label">Soort</span>
        <select v-model="nieuw.soort" class="invoer" data-test="avg-verzoek-soort"><option v-for="s in AVG_VERZOEK_SOORTEN" :key="s" :value="s">{{ AVG_VERZOEK_LABEL[s] }}</option></select></label>
      <label class="veld"><span class="veld-label">Kenmerk</span><input v-model="nieuw.kenmerk" class="invoer" maxlength="60" placeholder="Ticketnummer" data-test="avg-verzoek-kenmerk"></label>
      <label class="veld"><span class="veld-label">Ontvangen op</span><input v-model="nieuw.ontvangenOp" class="invoer" type="date" :max="vandaag" data-test="avg-verzoek-datum"></label>
      <p v-if="kenmerkMelding" class="fo-fout">{{ kenmerkMelding }}</p>
      <div class="dd-acties"><button type="button" class="dd-act" @click="nieuw.open = false">Annuleren</button><button type="button" class="dd-act dd-act--primair" :disabled="!!kenmerkMelding" data-test="avg-verzoek-bewaar" @click="legVast">Vastleggen</button></div>
    </div>
    <button v-else type="button" class="dd-act mt-8" data-test="avg-verzoek-nieuw" @click="openNieuw"><Icoon naam="Plus" :grootte="14" />Verzoek vastleggen</button>
  </article>
</template>

<style scoped>
.avg-cijfers { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
.avg-defs { margin: 8px 0 0; }
.avg-defs .def-rij { grid-template-columns: 170px 1fr; }
.avg-defs dd { margin: 0; overflow-wrap: anywhere; }
.avg-verzoek { flex-wrap: wrap; }
.avg-verzoek-tekst { flex: 1 1 240px; min-width: 0; }
details summary { min-height: 44px; padding: 11px 0; box-sizing: border-box; cursor: pointer; font-weight: 600; }
@media (max-width: 767px) {
  .avg-defs .def-rij { grid-template-columns: 1fr; }
}
</style>
