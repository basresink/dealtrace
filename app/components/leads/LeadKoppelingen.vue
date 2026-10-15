<script setup lang="ts">
// Tabblad Koppelingen (F02, 12): de kaart KvK. De beheerder plakt de sleutel, test hem en
// slaat hem op (eerst testen, dan opslaan) en zet een maandplafond; een Expert gebruikt de bron.
// De sleutel komt nooit terug naar het scherm. Datacollectief en CRM komen met P15 en P20.
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
    <article class="kaart">
      <header class="kaart-kop"><h3 class="kaart-titel">Datacollectief</h3><span class="pil pil--grijs">Komt later</span></header>
      <p class="tekst">Bedrijven en contactpersonen met functie, direct nummer en zakelijk e-mailadres.</p>
    </article>
    <article class="kaart">
      <header class="kaart-kop"><h3 class="kaart-titel">CRM</h3><span class="pil pil--grijs">Komt later</span></header>
      <p class="tekst">Ontdubbelen tegen je CRM en overgenomen leads terugschrijven, in twee richtingen.</p>
    </article>
  </div>
</template>
