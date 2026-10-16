<script setup lang="ts">
// Overdragen na "Rond af" en vanaf de accountkaart (F17): keuzes, vervolgstap, wat er meegaat met
// "Bekijk briefing", en "Draag over" (geel) met bevestiging; "Later" laat de overdrachtstaak staan.
// Meldt DealDrive "al klant", dan volgt de vraag uit het contract. Is de dekking van de invloedskaart (F8) niet
// gehaald (beslisser en minstens één beïnvloeder gesproken), dan staat bovenaan een waarschuwing.
const props = defineProps<{ open: boolean; accountId: string | null; accountNaam: string; vervolgstap?: string }>()
const emit = defineEmits<{ sluit: []; overgedragen: [] }>()
const toast = useToast()
const keuze = ref<any>(null)
const { data, refresh } = useFetch<any>(() => `/api/accounts/${props.accountId}/overdracht`, { immediate: false, watch: false, default: () => null })
watch(() => [props.open, props.accountId], ([o]) => { if (o && props.accountId) { keuze.value = null; refresh() } }, { immediate: true })
const briefing = ref(false)
const bevestig = ref(false)
const alKlant = ref(false)
const bezig = ref(false)
const sleutel = ref(crypto.randomUUID())
const mag = computed(() => !!keuze.value && !!keuze.value.vervolgstap.omschrijving && (keuze.value.naar !== 'collega' || !!keuze.value.naarGebruikerId))
const naarTekst = computed(() => (keuze.value?.naar === 'dealdrive' ? 'DealDrive' : keuze.value?.naar === 'crm' ? 'het CRM' : 'je collega'))
async function draagOver(alsKans = false) {
  bezig.value = true
  try {
    const r = await $fetch<any>(`/api/accounts/${props.accountId}/overdragen`, { method: 'POST', body: { ...keuze.value, alsNieuweKansBijKlant: alsKans, idempotentieSleutel: alsKans ? crypto.randomUUID() : sleutel.value } })
    bevestig.value = false
    if (r.alKlant) { alKlant.value = true; return }
    alKlant.value = false
    toast.toon(r.tekst ?? `${props.accountNaam} is overgedragen.`)
    emit('overgedragen'); emit('sluit')
  } catch (e: any) {
    bevestig.value = false
    if (e?.data?.data?.reden === 'al_klant') alKlant.value = true
    else toast.toon(foutTekst(e), 'fout')
  } finally { bezig.value = false }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open && accountId" class="fo-overlay" @click.self="emit('sluit')">
      <form class="fo-panel fo-panel--schuif" role="dialog" aria-modal="true" aria-labelledby="ov-titel" data-test="overdracht-venster" @submit.prevent="mag && (bevestig = true)">
        <header class="fo-head">
          <div class="fo-head-tekst"><span class="fo-kicker">Overdragen?</span><h2 id="ov-titel" class="fo-titel">{{ accountNaam }}</h2></div>
          <button type="button" class="fo-sluit" aria-label="Sluiten" @click="emit('sluit')"><Icoon naam="X" /></button>
        </header>
        <div class="fo-body fo-body--formulier">
          <p v-if="data && !data.mag.ja && !data.alKlant" class="kaart kaart--geel" data-test="ov-niet">{{ data.mag.reden }}</p>
          <template v-else>
            <p v-if="data?.dekking?.waarschuwing" class="kaart kaart--geel" data-test="ov-dekking"><strong>{{ data.dekking.titel }}</strong> {{ data.dekking.waarschuwing }} Bekijk de invloedskaart op de accountkaart.</p>
            <article class="fo-blok"><OverdrachtKeuze v-model="keuze" :account-id="accountId" :vervolgstap="vervolgstap" /></article>
            <article v-if="data?.voorbeeld" class="fo-blok" data-test="ov-voorbeeld">
              <h3 class="fo-blok-titel">Wat gaat er mee</h3>
              <ul class="ov-mee">
                <li>Account met {{ data.voorbeeld.contacten }} {{ data.voorbeeld.contacten === 1 ? 'contact' : 'contacten' }} en het buying committee</li>
                <li>Dossier en de reis in {{ Math.min(5, data.voorbeeld.geschiedenis.length) }} regels</li>
                <li>{{ data.voorbeeld.verslag ? 'Verslag van de eerste afspraak' : 'Geen verslag vastgelegd' }}</li>
                <li>Vervolgstap en de briefing "Overdracht"</li>
              </ul>
              <button type="button" class="dd-tekstknop" :aria-expanded="briefing" data-test="bekijk-briefing" @click="briefing = !briefing">{{ briefing ? 'Verberg briefing' : 'Bekijk briefing' }}</button>
              <pre v-if="briefing" class="ov-briefing">{{ data.voorbeeld.briefing }}</pre>
            </article>
          </template>
        </div>
        <footer class="fo-foot">
          <button type="button" class="dd-actie dd-actie--secundair" @click="emit('sluit')">Annuleren</button>
          <button type="button" class="dd-actie dd-actie--secundair" data-test="ov-later" @click="toast.toon('De overdrachtstaak staat klaar voor morgen.'); emit('sluit')">Later</button>
          <span class="fo-foot-vul" />
          <button type="submit" class="dd-actie dd-actie--primair" :disabled="!mag || bezig || (data && !data.mag.ja && !data.alKlant)" data-test="draag-over">Draag over</button>
        </footer>
      </form>
    </div>
    <BevestigVenster :open="bevestig" :titel="`${accountNaam} overdragen?`" :tekst="keuze?.naar === 'collega' ? 'Je collega wordt eigenaar en krijgt een taak met de vervolgstap en de briefing. Het account verdwijnt uit je actieve reis.' : `Het account gaat naar ${naarTekst} en verdwijnt uit je actieve reis. De deal ontstaat in ${naarTekst}.`" bevestig="Draag over" @bevestigd="draagOver(false)" @geannuleerd="bevestig = false" />
    <BevestigVenster :open="alKlant" titel="Dit bedrijf is al klant in DealDrive." tekst="Overdragen als nieuwe kans bij een bestaande klant?" bevestig="Ja, draag over" @bevestigd="draagOver(true)" @geannuleerd="alKlant = false; emit('sluit')" />
  </Teleport>
</template>
