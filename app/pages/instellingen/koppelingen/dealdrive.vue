<script setup lang="ts">
// DealDrive-koppeling voor de beheerder (P23, hoofdstuk 12): alleen de stand, Test verbinding, de mislukte
// overdrachten en het logboek. Inrichten (basis-URL, organisatie-id, geheim, stand) doet de founder in
// Platformbeheer. Het geheim komt nooit naar het scherm.
const { functie } = useMe()
const toast = useToast()
const aan = computed(() => !!functie('koppelingen.dealdrive')?.beschikbaar)
const { data: dd, refresh } = await useFetch<any>('/api/koppelingen/dealdrive/status', { immediate: aan.value, default: () => null })
const datum = (s: string) => new Date(s).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' })
const moment = (s: string) => new Date(s).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })
const kop = computed(() => {
  if (!dd.value) return ''
  if (dd.value.stand === 'uit') return 'Nog niet beschikbaar: DealDrive bouwt de ontvangende kant.'
  const naam = dd.value.stand === 'mock' ? 'Gekoppeld met de mock van DealDrive' : 'Gekoppeld met DealDrive'
  return dd.value.laatste ? `${naam} · laatste overdracht ${datum(dd.value.laatste.op)}` : naam
})
const STAND: Record<string, string> = { uit: 'Uit', mock: 'Mock', http: 'Aan' }
const HANDELING: Record<string, string> = { overdragen: 'Overdracht', ping: 'Test verbinding', zoeken: 'Ontdubbelen' }
const bezig = ref(false)
async function test() {
  bezig.value = true
  try { const r = await $fetch<any>('/api/koppelingen/dealdrive/test', { method: 'POST' }); toast.toon(r.melding, r.ok ? undefined : 'fout'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
async function opnieuw(id: string) {
  try { await $fetch(`/api/overdrachten/${id}/opnieuw`, { method: 'POST' }); toast.toon('De overdracht is opnieuw verstuurd.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const titel = computed(() => {
  if (!dd.value) return 'DealDrive'
  if (dd.value.stand === 'uit') return 'DealDrive staat nog uit'
  const m = dd.value.telling.mislukt ?? 0
  return m ? `DealDrive gekoppeld, ${m} ${m === 1 ? 'overdracht mislukt' : 'overdrachten mislukt'}` : `DealDrive gekoppeld, ${dd.value.telling.bevestigd ?? 0} overdrachten bevestigd`
})
useHead({ title: 'DealDrive · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="koppelingen.dealdrive" />
    <template v-else>
      <InstellingenKop groep="Koppelingen" :titel="titel" uitleg="DealDrive: na de eerste afspraak gaat het account naar DealDrive, waar de deal en de offerte ontstaan. DealDrive meldt terug wat ermee gebeurt." helpartikel="koppelingen">
        <template #acties><button v-if="dd" type="button" class="dd-actie dd-actie--primair" :disabled="bezig" data-test="dealdrive-test" @click="test"><Icoon naam="RefreshCw" class="dd-actie-icoon" />Test verbinding</button></template>
      </InstellingenKop>
      <section class="section section--laatste">
        <div v-if="dd" class="container">
          <article class="kaart" data-test="dealdrive-stand">
            <header class="kaart-kop"><h2 class="kaart-titel">{{ kop }}</h2><InstellingLabel :stand="dd.stand === 'uit' ? 'uit' : 'gekoppeld'" :tekst="STAND[dd.stand]" /></header>
            <p class="kaart-meta">De founder richt de koppeling in. Staat hij uit, dan krijg je bij een overdracht een taak met de briefing om te mailen of te downloaden.</p>
            <p v-if="dd.getestOp" class="kaart-meta">Laatst getest {{ moment(dd.getestOp) }}.</p>
            <p class="kaart-meta">Overdrachten: {{ dd.telling.verstuurd ?? 0 }} verstuurd, {{ dd.telling.bevestigd ?? 0 }} bevestigd, {{ dd.telling.mislukt ?? 0 }} mislukt.</p>
          </article>
          <article class="kaart mt-16" data-test="dealdrive-mislukt">
            <header class="kaart-kop"><h2 class="kaart-titel">Mislukte overdrachten</h2></header>
            <LegeStaat v-if="!dd.mislukt.length" titel="Geen mislukte overdrachten." tekst="Alles wat naar DealDrive ging, is aangekomen." />
            <ul v-else class="schakel-lijst">
              <li v-for="m in dd.mislukt" :key="m.id" class="schakel-rij"><span><NuxtLink :to="`/accounts/${m.accountId}`">{{ m.account }}</NuxtLink><span class="meta"> · {{ datum(m.op) }} · {{ m.melding }}</span></span><button type="button" class="dd-act" @click="opnieuw(m.id)">Opnieuw proberen</button></li>
            </ul>
          </article>
          <article class="kaart mt-16" data-test="dealdrive-logboek">
            <header class="kaart-kop"><h2 class="kaart-titel">Logboek</h2></header>
            <p class="kaart-meta">Zonder inhoud: alleen wat er gebeurde, wanneer en of het lukte.</p>
            <LegeStaat v-if="!dd.runs.length && !dd.gebeurtenissen.length" titel="Nog niets in het logboek." tekst="Na de eerste overdracht of test staat hier wat er gebeurde." />
            <ul class="schakel-lijst">
              <li v-for="r in dd.runs" :key="r.start + r.handeling" class="schakel-rij"><span>{{ HANDELING[r.handeling] ?? r.handeling }}</span><span class="dd-acties"><span class="meta">{{ moment(r.start) }}</span><Label v-if="r.ok" soort="overdracht" waarde="bevestigd" tekst="Gelukt" /><Label v-else soort="overdracht" waarde="mislukt" :tekst="r.fout || 'Mislukt'" /></span></li>
              <li v-for="g in dd.gebeurtenissen" :key="g.op + g.soort" class="schakel-rij"><span>Terugmelding {{ g.soort }}</span><span class="meta">{{ moment(g.op) }} · {{ g.resultaat }}</span></li>
            </ul>
          </article>
        </div>
      </section>
    </template>
  </div>
</template>
