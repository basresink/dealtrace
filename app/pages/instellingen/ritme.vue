<script setup lang="ts">
// Accountmatrix en ritmes (F16): klassen, segmenten, belmatrix, afspraakmatrix,
// afkoeling en frequentieplafond, overschrijven per reis. Iedereen kijkt mee; de
// beheerder wijzigt. "niet ingesteld" (leeg) en "bewust uit (0)" zijn verschillend.
import { PERIODEN, ritmeLabel } from '~~/shared/ritmematrix'
const toast = useToast()
const { data, refresh } = await useFetch<any>('/api/ritme', { default: () => ({ klassen: [], codes: [], belmatrix: {}, afspraakmatrix: {}, afkoeling: [], segmenten: [], reizen: [], kan: {}, waarschuwingen: [] }) })
const klein = ref(false)
onMounted(() => { klein.value = window.matchMedia('(max-width: 767px)').matches })
const beheer = computed(() => data.value.kan.beheer && !klein.value)
const status = ref('')
let timer: any
function bewaarLater(key: string, value: () => unknown) {
  status.value = 'Opslaan…'
  clearTimeout(timer)
  timer = setTimeout(async () => {
    try { await $fetch(`/api/settings/${key}`, { method: 'PUT', body: { value: value() } }); status.value = 'Opgeslagen'; await refresh() } catch (e) { status.value = 'Opslaan mislukt'; toast.toon(foutTekst(e), 'fout') }
  }, 600)
}
const PERIODE_LABEL: Record<string, string> = { maand: 'per maand', kwartaal: 'per kwartaal', halfjaar: 'per halfjaar', jaar: 'per jaar' }
// Matrix bewerken: leeg = niet ingesteld (null), 0 = bewust uit.
function matrixWaarde(sleutel: 'belmatrix' | 'afspraakmatrix') {
  const m = data.value[sleutel]
  return Object.fromEntries(Object.entries(m).map(([rij, cellen]: any) => [rij, Object.fromEntries(Object.entries(cellen).map(([c, cel]: any) => [c, cel.waarde]))]))
}
function zetCel(sleutel: 'belmatrix' | 'afspraakmatrix', rij: string, code: string, veld: 'aantal' | 'periode', w: string) {
  const cel = data.value[sleutel][rij][code]
  const huidig = cel.waarde ?? { aantal: null, periode: cel.standaard?.periode ?? 'maand' }
  const nieuw = veld === 'aantal' ? { ...huidig, aantal: w === '' ? null : Math.max(0, Math.round(Number(w))) } : { ...huidig, periode: w }
  cel.waarde = nieuw.aantal === null ? null : nieuw
  cel.label = cel.waarde ? ritmeLabel(cel.waarde) : `niet ingesteld (standaard ${ritmeLabel(cel.standaard)})`
  bewaarLater(sleutel, () => matrixWaarde(sleutel))
}
function zetKlassen() { bewaarLater('klassen', () => data.value.klassen.map(({ aantal, standaardGrenzen, ...k }: any) => k)) }
// Grenzen per klasse (B02): leeg "tot" is zonder bovengrens; leeg "vanaf" volgt de standaard voor de code.
function zetGrens(k: any, veld: 'minMedewerkers' | 'maxMedewerkers', w: string) {
  k[veld] = w === '' ? null : Math.max(0, Math.round(Number(w)))
  if (veld === 'minMedewerkers' && k.minMedewerkers !== null) k.standaardGrenzen = null
  zetKlassen()
}
function nieuweKlasse() { data.value.klassen.push({ id: `kl-${Date.now()}`, code: '', naam: '', omschrijving: '', tabblad: 'Prospects', minMedewerkers: null, maxMedewerkers: null, aantal: 0 }) }
const voorstel = ref<any>(null)
async function stelVoor(toepassen = false) {
  try {
    voorstel.value = await $fetch('/api/accountklassen/voorstel', { method: 'POST', body: { toepassen } })
    if (toepassen) { toast.toon('Klassen gezet.'); voorstel.value = null; await refresh() }
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const nieuwSegment = reactive({ naam: '', sleutel: '', waarde: '' })
function voegSegmentToe() {
  const s = [...data.value.segmenten.map(({ leden, ...x }: any) => x), { id: `sg-${Date.now()}`, naam: nieuwSegment.naam, filters: nieuwSegment.sleutel ? [{ sleutel: nieuwSegment.sleutel, vergelijking: 'is', waarde: nieuwSegment.waarde }] : [] }]
  Object.assign(nieuwSegment, { naam: '', sleutel: '', waarde: '' })
  bewaarLater('segmenten', () => s)
}
function zetPlafond() { bewaarLater('frequentieplafond', () => data.value.frequentieplafond) }
function zetCapaciteit() { bewaarLater('capaciteit', () => data.value.capaciteit) }
function zetAfkoeling() { bewaarLater('afkoeling', () => Object.fromEntries(data.value.afkoeling.map((k: any) => [k.id, k.dagen]))) }
const RIJ_LABEL: Record<string, string> = { prospect: 'Prospect', klant: 'Klant', meeting: 'Meeting (online)', bezoek: 'Bezoek' }
useHead({ title: 'Accountmatrix · Instellingen · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Instellingen · Accountmatrix" titel="Accountmatrix en ritmes" uitleg="Hoeveel aandacht elk account verdient. De matrix is de inrichting, de regels zijn de uitvoering." helpartikel="accountmatrix">
      <template #acties><span v-if="status" class="meta" role="status" data-test="opslagstatus">{{ status }}</span></template>
    </PaginaKop>
    <section class="section section--laatste">
      <div class="container">
        <p class="alleen-groot-melding kaart kaart--geel">Beter op een groot scherm.</p>
        <p v-if="!data.kan.beheer" class="kaart kaart--geel" data-test="meekijken">Je kunt meekijken. Alleen een beheerder wijzigt de inrichting.</p>
        <p v-for="w in data.waarschuwingen" :key="w" class="kaart kaart--geel mt-8">{{ w }}</p>

        <article v-if="data.voorMij" class="kaart mt-16" data-test="voor-mij">
          <h2 class="kaart-titel">Wat betekent dit voor mij</h2>
          <p class="kaart-meta">Voor je {{ data.voorMij.accounts }} prospects in reis verwacht de matrix deze week ongeveer <strong class="tnum">{{ data.voorMij.bellen }}</strong> belmomenten en <strong class="tnum">{{ data.voorMij.bezoeken }}</strong> bezoeken. Je capaciteit: {{ data.voorMij.capaciteit }} {{ data.voorMij.werkplek === 'buitendienst' ? 'bezoeken' : 'beltaken' }} per week.</p>
        </article>

        <span class="kicker kicker--streep mt-16">1 · Accountklassen</span>
        <div class="kaart mt-8" data-test="klassen">
          <p v-if="data.zonderKlasse" class="kaart kaart--geel">{{ data.zonderKlasse }} prospects hebben nog geen klasse.
            <button v-if="beheer" type="button" class="dd-act" data-test="stel-klasse-voor" @click="stelVoor(false)">Stel voor uit medewerkers</button></p>
          <div v-if="voorstel" class="mt-8">
            <ul class="schakel-lijst"><li v-for="v in voorstel.voorstel.slice(0, 20)" :key="v.accountId" class="schakel-rij"><span>{{ v.naam }}</span><span class="meta">{{ v.medewerkers ?? 'onbekend' }} → {{ data.klassen.find((k: any) => k.id === v.klasse)?.naam ?? 'geen voorstel' }}</span></li></ul>
            <button type="button" class="dd-act dd-act--primair mt-8" data-test="klasse-toepassen" @click="stelVoor(true)">Pas toe</button>
          </div>
          <table class="tabel tabel--kaarten">
            <thead><tr><th>Code</th><th>Naam</th><th>Vanaf (medewerkers)</th><th>Tot en met</th><th>Omschrijving</th><th>Tabblad</th><th>Accounts</th></tr></thead>
            <tbody><tr v-for="k in data.klassen" :key="k.id" :data-test="`klasse-${k.id}`">
              <td><input v-model="k.code" class="invoer invoer--klein" maxlength="2" :disabled="!beheer" aria-label="Code" @input="zetKlassen"></td>
              <td><input v-model="k.naam" class="invoer invoer--klein" :disabled="!beheer" aria-label="Naam" @input="zetKlassen"></td>
              <template v-if="(k.tabblad ?? 'Prospects') !== 'Klanten'">
                <td><input class="invoer invoer--klein" type="number" min="0" :value="k.minMedewerkers ?? ''" :placeholder="k.standaardGrenzen?.min != null ? String(k.standaardGrenzen.min) : ''" :disabled="!beheer" :aria-label="`${k.naam || 'Klasse'} vanaf`" data-test="klasse-vanaf" @input="zetGrens(k, 'minMedewerkers', ($event.target as HTMLInputElement).value)"></td>
                <td><input class="invoer invoer--klein" type="number" min="0" :value="k.maxMedewerkers ?? ''" :placeholder="k.standaardGrenzen ? (k.standaardGrenzen.max != null ? String(k.standaardGrenzen.max) : 'geen') : 'geen'" :disabled="!beheer" :aria-label="`${k.naam || 'Klasse'} tot en met`" data-test="klasse-tot" @input="zetGrens(k, 'maxMedewerkers', ($event.target as HTMLInputElement).value)"></td>
              </template>
              <template v-else><td class="meta">n.v.t.</td><td class="meta">n.v.t.</td></template>
              <td><input v-model="k.omschrijving" class="invoer invoer--klein" :disabled="!beheer" aria-label="Omschrijving" @input="zetKlassen"></td>
              <td>{{ k.tabblad ?? 'Prospects' }}</td><td class="tnum">{{ k.aantal }}</td>
            </tr></tbody>
          </table>
          <p class="kaart-meta mt-8" data-test="klasse-uitleg">De klasse volgt uit het aantal medewerkers met deze grenzen. Valt een bedrijf onder de laagste grens, dan krijgt het de laagste klasse; zonder aantal medewerkers blijft de klasse leeg. Een met de hand gekozen klasse blijft staan.</p>
          <button v-if="beheer" type="button" class="dd-act mt-8" @click="nieuweKlasse">+ Klasse</button>
        </div>

        <span class="kicker kicker--streep mt-16">2 · Segmenten</span>
        <div class="kaart mt-8">
          <ul class="schakel-lijst"><li v-for="s in data.segmenten" :key="s.id" class="schakel-rij"><span><strong>{{ s.naam }}</strong> <span class="meta">{{ s.filters.map((x: any) => `${x.sleutel} ${x.vergelijking} ${x.waarde}`).join(' en ') || 'alle accounts' }}</span></span><span class="tnum">{{ s.leden }}</span></li></ul>
          <p v-if="!data.segmenten.length" class="kaart-meta">Nog geen segmenten.</p>
          <form v-if="beheer" class="formulier-raster mt-8" @submit.prevent="voegSegmentToe">
            <label class="veld"><span class="veld-label">Naam</span><input v-model="nieuwSegment.naam" class="invoer" required></label>
            <label class="veld"><span class="veld-label">Veld (eigen veld)</span><input v-model="nieuwSegment.sleutel" class="invoer" placeholder="segment"></label>
            <label class="veld"><span class="veld-label">Is gelijk aan</span><input v-model="nieuwSegment.waarde" class="invoer" placeholder="installateur"></label>
            <button type="submit" class="dd-act">+ Segment</button>
          </form>
        </div>

        <template v-for="m in (['belmatrix', 'afspraakmatrix'] as const)" :key="m">
          <span class="kicker kicker--streep mt-16">{{ m === 'belmatrix' ? '3 · Belmatrix' : '4 · Afspraakmatrix' }}</span>
          <div class="kaart mt-8 tabel-wrap" :data-test="m">
            <p class="kaart-meta">Leeg is "niet ingesteld": de standaard geldt. 0 is "bewust uit": geen ritmetaken.</p>
            <table class="tabel matrix-tabel">
              <thead><tr><th /><th v-for="c in data.codes" :key="c">{{ c }}</th></tr></thead>
              <tbody><tr v-for="rij in Object.keys(data[m])" :key="rij">
                <th>{{ RIJ_LABEL[rij] }}</th>
                <td v-for="c in data.codes" :key="c">
                  <div class="matrix-cel">
                    <template v-if="beheer">
                      <input class="invoer invoer--klein" type="number" min="0" :value="data[m][rij][c].waarde?.aantal ?? ''" :placeholder="data[m][rij][c].standaard ? String(data[m][rij][c].standaard.aantal) : ''" :aria-label="`${RIJ_LABEL[rij]} ${c} aantal`" :data-test="`cel-${m}-${rij}-${c}`" @input="zetCel(m, rij, c, 'aantal', ($event.target as HTMLInputElement).value)">
                      <select class="invoer invoer--klein" :value="data[m][rij][c].waarde?.periode ?? data[m][rij][c].standaard?.periode ?? 'maand'" :aria-label="`${RIJ_LABEL[rij]} ${c} periode`" @change="zetCel(m, rij, c, 'periode', ($event.target as HTMLSelectElement).value)"><option v-for="p in PERIODEN" :key="p" :value="p">{{ PERIODE_LABEL[p] }}</option></select>
                    </template>
                    <span class="matrix-label" :class="{ 'matrix-label--uit': data[m][rij][c].waarde?.aantal === 0 }" :data-test="`label-${m}-${rij}-${c}`">{{ data[m][rij][c].label }}</span>
                  </div>
                </td>
              </tr></tbody>
            </table>
          </div>
        </template>

        <span class="kicker kicker--streep mt-16">5 · Afkoelperiodes, consent en capaciteit</span>
        <div class="kaart mt-8">
          <div class="formulier-raster">
            <label v-for="k in data.afkoeling" :key="k.id" class="veld"><span class="veld-label">{{ k.label }} (dagen na nee)</span><input v-model.number="k.dagen" type="number" min="0" max="730" class="invoer" :disabled="!beheer" @input="zetAfkoeling"></label>
          </div>
          <div class="formulier-raster mt-16">
            <label class="veld"><span class="veld-label">Frequentieplafond: berichten per kanaal</span><input v-model.number="data.frequentieplafond.maxBerichten" type="number" min="0" class="invoer" :disabled="!beheer" @input="zetPlafond"></label>
            <label class="veld"><span class="veld-label">per aantal werkdagen (buiten het ritme)</span><input v-model.number="data.frequentieplafond.werkdagen" type="number" min="1" class="invoer" :disabled="!beheer" @input="zetPlafond"></label>
            <label class="veld"><span class="veld-label">Dagplafond binnendienst (beltaken)</span><input v-model.number="data.capaciteit.binnendienst" type="number" min="0" class="invoer" :disabled="!beheer" @input="zetCapaciteit"></label>
            <label class="veld"><span class="veld-label">Dagplafond buitendienst (bezoeken per regiodag)</span><input v-model.number="data.capaciteit.buitendienst" type="number" min="0" class="invoer" :disabled="!beheer" @input="zetCapaciteit"></label>
            <label class="veld"><span class="veld-label">Dagplafond startactiviteiten (per persoon)</span><input v-model.number="data.capaciteit.startactiviteiten" type="number" min="1" class="invoer" :disabled="!beheer" data-test="startplafond" @input="zetCapaciteit"></label>
          </div>
        </div>

        <span class="kicker kicker--streep mt-16">6 · Overschrijven per reis</span>
        <div class="kaart mt-8">
          <ul class="schakel-lijst"><li v-for="r in data.reizen" :key="r.id" class="schakel-rij"><span>{{ r.naam }}</span><span class="meta">{{ r.eigenRitme ? 'eigen ritme of belmatrix' : 'volgt deze pagina' }}</span></li></ul>
          <p class="kaart-meta mt-8">Nooit twee ritmes tegelijk op één account: het hercontactritme tot de afspraak gaat voor het onderhoudsritme van de belmatrix.</p>
        </div>
      </div>
    </section>
  </div>
</template>
