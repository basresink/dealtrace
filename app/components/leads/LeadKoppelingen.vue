<script setup lang="ts">
// Tabblad Koppelingen (F02, 12): de kaart KvK. De beheerder plakt de sleutel, test hem en
// slaat hem op (eerst testen, dan opslaan) en zet een maandplafond; een Expert gebruikt de bron.
// De sleutel komt nooit terug naar het scherm. Datacollectief (P15) op dezelfde manier, met een
// vingerafdruk, het tegoed, een maandplafond in records en de laatste runs. CRM komt met P20.
const toast = useToast()
const { data: kvk, refresh } = await useFetch<any>('/api/koppelingen/kvk', { default: () => null })
const sleutel = ref('')
const plafond = ref<number | ''>('')
const getest = ref<string | null>(null)
const fout = ref<string | null>(null)
const bezig = ref(false)
watch(kvk, (k) => { plafond.value = k?.plafond != null && k.plafond < k.pakketPlafond ? k.plafond : '' }, { immediate: true })
watch(sleutel, () => { getest.value = null; fout.value = null })
async function test() {
  bezig.value = true; fout.value = null
  try { await $fetch('/api/koppelingen/kvk/test', { method: 'POST', body: { sleutel: sleutel.value || undefined } }); getest.value = sleutel.value; toast.toon('De verbinding met KvK werkt.') } catch (e) { fout.value = foutTekst(e) } finally { bezig.value = false }
}
async function bewaar() {
  bezig.value = true; fout.value = null
  try {
    await $fetch('/api/koppelingen/kvk', { method: 'PUT', body: { sleutel: sleutel.value || undefined, plafond: plafond.value === '' ? null : plafond.value } })
    sleutel.value = ''; getest.value = null
    toast.toon('KvK is gekoppeld.')
    await refresh()
  } catch (e) { fout.value = foutTekst(e) } finally { bezig.value = false }
}
async function ontkoppel() {
  try { await $fetch('/api/koppelingen/kvk', { method: 'PUT', body: { uit: true } }); toast.toon('KvK is ontkoppeld.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const status = computed(() => (!kvk.value ? null : kvk.value.gekoppeld ? { t: kvk.value.bron === 'platform' ? 'Gekoppeld via Dealtrace' : 'Gekoppeld', c: 'pil--groen' } : kvk.value.status === 'fout' ? { t: 'Fout', c: 'pil--rood' } : { t: 'Niet gekoppeld', c: 'pil--grijs' }))
const fmt = (n: number) => new Intl.NumberFormat('nl-NL').format(n)

// Datacollectief
const { data: dc, refresh: verversDc } = await useFetch<any>('/api/koppelingen/datacollectief', { default: () => null })
const dcSleutel = ref('')
const dcPlafond = ref<number | ''>('')
const dcGetest = ref<string | null>(null)
const dcFout = ref<string | null>(null)
watch(dc, (k) => { dcPlafond.value = k?.plafond != null && k.plafond < k.pakketPlafond ? k.plafond : '' }, { immediate: true })
watch(dcSleutel, () => { dcGetest.value = null; dcFout.value = null })
const dcDoe = (url: string, method: string, body: unknown): Promise<any> => ($fetch as any)(url, { method, body })
async function dcTest() {
  bezig.value = true; dcFout.value = null
  try { const r = await dcDoe('/api/koppelingen/datacollectief/test', 'POST', { sleutel: dcSleutel.value || undefined }); dcGetest.value = dcSleutel.value; toast.toon(r.tegoed != null ? `De verbinding met Datacollectief werkt. Tegoed: ${fmt(r.tegoed)} records.` : 'De verbinding met Datacollectief werkt.') } catch (e) { dcFout.value = foutTekst(e) } finally { bezig.value = false }
}
async function dcBewaar() {
  bezig.value = true; dcFout.value = null
  try { await dcDoe('/api/koppelingen/datacollectief', 'PUT', { sleutel: dcSleutel.value || undefined, plafond: dcPlafond.value === '' ? null : dcPlafond.value }); dcSleutel.value = ''; dcGetest.value = null; toast.toon('Datacollectief gekoppeld.'); await verversDc() } catch (e) { dcFout.value = foutTekst(e) } finally { bezig.value = false }
}
async function dcOntkoppel() {
  try { await dcDoe('/api/koppelingen/datacollectief', 'PUT', { uit: true }); toast.toon('Datacollectief is ontkoppeld.'); await verversDc() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const dcStatusPil = computed(() => (!dc.value ? null : dc.value.gekoppeld ? { t: 'Actief', c: 'pil--groen' } : dc.value.status === 'fout' ? { t: 'Fout', c: 'pil--rood' } : { t: 'Niet gekoppeld', c: 'pil--grijs' }))
const datum = (d: string) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(d))
</script>

<template>
  <div class="raster raster--3" data-test="tab-koppelingen">
    <article class="kaart" data-test="kaart-kvk">
      <header class="kaart-kop"><h3 class="kaart-titel">KvK</h3><span v-if="status" class="pil" :class="status.c" data-test="kvk-status">{{ status.t }}</span></header>
      <p class="tekst">Zoeken op handelsnaam, KvK-nummer, plaats, postcode en SBI; basisprofiel en vestigingsprofiel; elke maand een controle op wijzigingen bij prospects in reis.</p>
      <template v-if="kvk">
        <p v-if="!kvk.pakketPlafond" class="meta mt-8">KvK is onderdeel van Plus en Compleet.</p>
        <template v-else>
          <p class="meta mt-8" data-test="kvk-teller">{{ fmt(kvk.gebruikt) }} van {{ fmt(kvk.plafond) }} bevragingen deze maand</p>
          <p v-if="kvk.fout" class="veld-fout mt-8" role="alert">{{ kvk.fout }}</p>
          <p v-if="!kvk.gekoppeld && !kvk.magInrichten" class="meta mt-8" data-test="kvk-nodig">Je beheerder koppelt KvK met de API-sleutel van je organisatie.</p>
          <p v-else-if="!kvk.gekoppeld" class="meta mt-8" data-test="kvk-nodig">Vraag een API-sleutel aan bij KvK (Zoeken en Basisprofiel) en plak hem hieronder. Zonder sleutel is KvK geen kiesbare bron.</p>
          <form v-if="kvk.magInrichten" class="mt-16" @submit.prevent="bewaar">
            <label class="veld"><span class="veld-label">API-sleutel</span><input v-model="sleutel" class="invoer" type="password" autocomplete="off" :placeholder="kvk.sleutelBestaat ? 'Sleutel staat erin; plak een nieuwe om te vervangen' : 'Plak hier de KvK-sleutel'" data-test="kvk-sleutel"></label>
            <label class="veld mt-8"><span class="veld-label">Maandplafond</span><input v-model.number="plafond" class="invoer" type="number" min="0" :max="kvk.pakketPlafond" :placeholder="`${fmt(kvk.pakketPlafond)} (je pakket)`" data-test="kvk-plafond"></label>
            <p v-if="fout" class="veld-fout mt-8" role="alert" data-test="kvk-fout">{{ fout }}</p>
            <div class="dd-acties mt-16">
              <button type="button" class="dd-act" :disabled="bezig || (!sleutel && !kvk.sleutelBestaat)" data-test="kvk-test" @click="test">Test verbinding</button>
              <button type="submit" class="dd-act dd-act--primair" :disabled="bezig || (!!sleutel && getest !== sleutel)" :title="sleutel && getest !== sleutel ? 'Test de verbinding eerst' : ''" data-test="kvk-opslaan">Opslaan</button>
              <button v-if="kvk.sleutelBestaat" type="button" class="dd-act" data-test="kvk-ontkoppel" @click="ontkoppel">Ontkoppel</button>
            </div>
          </form>
        </template>
      </template>
    </article>
    <article class="kaart" data-test="kaart-datacollectief">
      <header class="kaart-kop"><h3 class="kaart-titel">Datacollectief</h3><span v-if="dcStatusPil" class="pil" :class="dcStatusPil.c" data-test="dc-status">{{ dcStatusPil.t }}</span></header>
      <p class="tekst">Bedrijven en contactpersonen met functie, direct nummer en zakelijk e-mailadres. Selecties op doelgroep, en contactpersonen zoeken bij een account. Nooit privégegevens.</p>
      <template v-if="dc">
        <p v-if="!dc.pakketPlafond" class="meta mt-8" data-test="dc-pakket">Onderdeel van Compleet.<NuxtLink v-if="dc.magInrichten" to="/instellingen/abonnement"> Bekijk het abonnement</NuxtLink></p>
        <template v-else>
          <p class="meta mt-8" data-test="dc-teller">Datacollectief-records deze maand {{ fmt(dc.gebruikt) }} / {{ fmt(dc.plafond) }}<template v-if="dc.tegoed != null"> · tegoed {{ fmt(dc.tegoed) }}</template></p>
          <p v-if="dc.vingerafdruk" class="meta">Sleutel met vingerafdruk <code>{{ dc.vingerafdruk }}</code></p>
          <p v-if="dc.fout" class="veld-fout mt-8" role="alert">{{ dc.fout }}</p>
          <p v-if="!dc.gekoppeld && !dc.magInrichten" class="meta mt-8" data-test="dc-nodig">Datacollectief is nog niet gekoppeld. Je beheerder plakt de sleutel van jullie contract.</p>
          <p v-else-if="!dc.gekoppeld" class="meta mt-8" data-test="dc-nodig">Datacollectief is nog niet gekoppeld. Plak hier de sleutel van jullie contract.</p>
          <form v-if="dc.magInrichten" class="mt-16" @submit.prevent="dcBewaar">
            <label class="veld"><span class="veld-label">API-sleutel</span><input v-model="dcSleutel" class="invoer" type="password" autocomplete="off" :placeholder="dc.sleutelBestaat ? 'Sleutel staat erin; plak een nieuwe om te vervangen' : 'Plak hier de Datacollectief-sleutel'" data-test="dc-sleutel"></label>
            <label class="veld mt-8"><span class="veld-label">Maandplafond records</span><input v-model.number="dcPlafond" class="invoer" type="number" min="0" :max="dc.pakketPlafond" :placeholder="`${fmt(dc.pakketPlafond)} (jullie contract)`" data-test="dc-plafond"></label>
            <p v-if="dcFout" class="veld-fout mt-8" role="alert" data-test="dc-fout">{{ dcFout }}</p>
            <div class="dd-acties mt-16">
              <button type="button" class="dd-act" :disabled="bezig || (!dcSleutel && !dc.sleutelBestaat)" data-test="dc-test" @click="dcTest">Test verbinding</button>
              <button type="submit" class="dd-act dd-act--primair" :disabled="bezig || (!!dcSleutel && dcGetest !== dcSleutel)" :title="dcSleutel && dcGetest !== dcSleutel ? 'Test de verbinding eerst' : ''" data-test="dc-opslaan">Opslaan</button>
              <button v-if="dc.sleutelBestaat" type="button" class="dd-act" @click="dcOntkoppel">Ontkoppel</button>
            </div>
          </form>
          <details class="mt-16"><summary class="meta">Functies en laatste runs</summary>
            <ul class="schakel-lijst mt-8"><li class="schakel-rij">Selectie op doelgroep (branche, omvang, regio, functieniveau)</li><li class="schakel-rij">Contactpersonen zoeken bij een account</li><li class="schakel-rij">Een contact aanvullen met functie, nummer en e-mail</li></ul>
            <ul v-if="dc.runs?.length" class="schakel-lijst mt-8"><li v-for="(r, i) in dc.runs" :key="i" class="schakel-rij"><span>{{ datum(r.start) }} · {{ r.handeling }}</span><span class="meta">{{ r.gelezen }} gelezen<template v-if="r.fouten?.length"> · {{ r.fouten[0] }}</template></span></li></ul>
          </details>
        </template>
      </template>
    </article>
    <article class="kaart">
      <header class="kaart-kop"><h3 class="kaart-titel">CRM</h3><span class="pil pil--grijs">Komt later</span></header>
      <p class="tekst">Ontdubbelen tegen je CRM en overgenomen leads terugschrijven, in twee richtingen.</p>
    </article>
  </div>
</template>
