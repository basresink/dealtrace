<script setup lang="ts">
// Mail koppelen (12, beheerder): SMTP van de organisatie. Eerst "Test" (SPF, DKIM, DMARC en de
// verbinding), dan "Opslaan". Het wachtwoord gaat versleuteld de database in en nooit terug naar het scherm.
const { functie } = useMe()
const aan = computed(() => !!functie('koppeling.mail')?.beschikbaar)
const toast = useToast()
const INKOMEND_LABEL: Record<string, string> = { gestopt: 'reeks gestopt', 'auto-antwoord': 'automatisch antwoord', 'geen-reeks': 'geen lopende reeks', onbekend: 'onbekende afzender' }
const { data, refresh } = await useFetch<any>('/api/koppelingen/mail', { immediate: aan.value, default: () => ({ status: 'uit', instellingen: { modus: 'smtp', poort: 587 } }) })
const f = reactive<any>({ modus: 'smtp', host: '', poort: 587, gebruiker: '', van: '', naam: '', domein: '', dkimSelector: 'default' })
const wachtwoord = ref('')
// Opslaan-status in de kaartkop: Gewijzigd tot Opslaan (na een geslaagde test).
const opslag = useFlyoutOpslag()
opslag.volg(() => [{ ...f }, wachtwoord.value])
watch(() => data.value, (d) => { Object.assign(f, d?.instellingen ?? {}); nextTick(() => opslag.basis()) }, { immediate: true })
onMounted(() => opslag.basis())
const test = ref<{ ok: boolean; tekst: string } | null>(null)
const bezig = ref(false)
async function testen() {
  bezig.value = true
  try { test.value = await $fetch('/api/koppelingen/mail/test', { method: 'POST', body: { instellingen: f, wachtwoord: wachtwoord.value || undefined } }) } catch (e) { test.value = { ok: false, tekst: foutTekst(e) } } finally { bezig.value = false }
}
async function opslaan() {
  try { const r = await opslag.bewaar(() => $fetch<any>('/api/koppelingen/mail', { method: 'PUT', body: { instellingen: f, wachtwoord: wachtwoord.value || undefined } })); toast.toon(`Mail gekoppeld. ${r.tekst}`); wachtwoord.value = ''; test.value = null; await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function ontkoppel() { try { await $fetch('/api/koppelingen/mail', { method: 'PUT', body: { uit: true } }); toast.toon('Mail ontkoppeld.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') } }
useHead({ title: 'Mail koppelen · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="koppeling.mail" />
    <template v-else>
      <InstellingenKop groep="Koppelingen" :titel="data.status === 'actief' ? 'Mail gekoppeld' : 'Mail nog niet gekoppeld'" :uitleg="data.status === 'actief' ? `Gekoppeld: ${data.instellingen.van}${data.instellingen.modus === 'mock' ? ' (testmailbox, er gaat geen echte mail uit)' : ''}.` : 'Nog niet gekoppeld. Concepten verstuur je dan via je eigen mailapp.'" helpartikel="koppelingen" />
      <section class="section section--laatste">
        <div class="container container--smal">
          <form class="kaart" data-test="mail-koppeling" @submit.prevent="opslaan" @input.capture="opslag.interactie()" @pointerdown.capture="opslag.interactie()">
            <header class="kaart-kop"><h2 class="kaart-titel">Mailserver</h2><Label soort="instelling" :waarde="data.status === 'actief' ? 'gekoppeld' : 'niet-gekoppeld'" /><OpslagStatus :opslag="opslag" test="mail-status" /></header>
            <div class="formulier-raster">
              <label class="veld"><span class="veld-label">Soort</span><select v-model="f.modus" class="invoer"><option value="smtp">SMTP</option><option value="mock">Testmailbox</option></select></label>
              <label class="veld"><span class="veld-label">Verzendadres</span><input v-model="f.van" type="email" class="invoer" placeholder="verkoop@bedrijf.nl"></label>
              <label class="veld"><span class="veld-label">Naam afzender</span><input v-model="f.naam" class="invoer"></label>
              <template v-if="f.modus === 'smtp'">
                <label class="veld"><span class="veld-label">Mailserver</span><input v-model="f.host" class="invoer" placeholder="smtp.bedrijf.nl"></label>
                <label class="veld"><span class="veld-label">Poort</span><input v-model.number="f.poort" type="number" class="invoer"></label>
                <label class="veld"><span class="veld-label">Gebruikersnaam</span><input v-model="f.gebruiker" class="invoer" autocomplete="off"></label>
                <label class="veld"><span class="veld-label">Wachtwoord</span><input v-model="wachtwoord" type="password" class="invoer" autocomplete="new-password" :placeholder="data.heeftWachtwoord ? 'Bewaard; laat leeg om te houden' : ''"></label>
                <label class="veld"><span class="veld-label">DKIM-selector</span><input v-model="f.dkimSelector" class="invoer"></label>
              </template>
            </div>
            <p v-if="test" class="kaart mt-16" :class="{ 'kaart--geel': !test.ok }" data-test="mail-test-uitslag">{{ test.tekst }}</p>
            <div class="dd-acties mt-16">
              <button type="button" class="dd-actie dd-actie--secundair" :disabled="bezig" data-test="mail-test" @click="testen">Test</button>
              <button type="submit" class="dd-actie dd-actie--primair" :disabled="!test?.ok" data-test="mail-opslaan">Opslaan</button>
              <button v-if="data.status === 'actief'" type="button" class="dd-actie dd-actie--secundair" @click="ontkoppel">Ontkoppelen</button>
            </div>
          </form>
          <!-- F7: antwoorden op opvolgreeksen herkennen. De provider stuurt inkomende mail door naar deze ondertekende URL. -->
          <article v-if="data.inkomend" class="kaart mt-16" data-test="mail-inkomend">
            <header class="kaart-kop"><h2 class="kaart-titel">Antwoorden herkennen</h2></header>
            <p class="kaart-meta">Laat je mailprovider inkomende mail op het verzendadres doorsturen (webhook, POST) naar dit adres. Een antwoord van een contact stopt zijn opvolgreeks en zet een taak bel terug binnen twee uur klaar. Een automatisch antwoord telt niet.</p>
            <label class="veld mt-8"><span class="veld-label">Adres voor inkomende mail</span><input class="invoer tnum" :value="data.inkomend.url" readonly data-test="mail-inkomend-url" @focus="($event.target as HTMLInputElement).select()"></label>
            <p v-if="data.instellingen.modus === 'mock'" class="meta mt-8">De testmailbox leest inkomende mail uit het geheugen bij elke ronde van de reeksen.</p>
            <ul v-if="data.inkomend.laatste.length" class="schakel-lijst mt-8" aria-label="Laatste inkomende mail">
              <li v-for="(x, i) in data.inkomend.laatste" :key="i" class="schakel-rij"><span>{{ x.van }}<template v-if="x.onderwerp"> · {{ x.onderwerp }}</template></span><span class="meta">{{ INKOMEND_LABEL[x.verwerking] ?? x.verwerking }} · {{ new Date(x.op).toLocaleDateString('nl-NL') }}</span></li>
            </ul>
            <LegeStaat v-else class="mt-8" titel="Nog geen inkomende mail." tekst="Zodra een contact antwoordt op een opvolgreeks, staat het hier." />
          </article>
        </div>
      </section>
    </template>
  </div>
</template>
