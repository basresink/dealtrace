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
useHead({ title: 'DealDrive · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="koppelingen.dealdrive" />
    <template v-else>
      <PaginaKop kicker="Instellingen · Koppelingen" titel="DealDrive" uitleg="Na de eerste afspraak gaat het account naar DealDrive, waar de deal en de offerte ontstaan. DealDrive meldt terug wat ermee gebeurt." helpartikel="koppelingen" />
      <section class="section section--laatste">
        <div v-if="dd" class="container">
          <article class="kaart" data-test="dealdrive-stand">
            <header class="kaart-kop"><h2 class="kaart-titel">{{ kop }}</h2><span class="pil" :class="dd.stand === 'uit' ? 'pil--leeg' : 'pil--groen'">{{ STAND[dd.stand] }}</span></header>
            <p class="kaart-meta">De founder richt de koppeling in. Staat hij uit, dan krijg je bij een overdracht een taak met de briefing om te mailen of te downloaden.</p>
            <p v-if="dd.getestOp" class="kaart-meta">Laatst getest {{ moment(dd.getestOp) }}.</p>
            <p class="kaart-meta">Overdrachten: {{ dd.telling.verstuurd ?? 0 }} verstuurd, {{ dd.telling.bevestigd ?? 0 }} bevestigd, {{ dd.telling.mislukt ?? 0 }} mislukt.</p>
            <div class="dd-acties mt-8"><button type="button" class="dd-act" :disabled="bezig" data-test="dealdrive-test" @click="test">Test verbinding</button></div>
          </article>
          <article class="kaart mt-16" data-test="dealdrive-mislukt">
            <header class="kaart-kop"><h2 class="kaart-titel">Mislukte overdrachten</h2></header>
            <p v-if="!dd.mislukt.length" class="kaart-meta">Geen.</p>
            <ul v-else class="schakel-lijst">
              <li v-for="m in dd.mislukt" :key="m.id" class="schakel-rij"><span><NuxtLink :to="`/accounts/${m.accountId}`">{{ m.account }}</NuxtLink><span class="meta"> · {{ datum(m.op) }} · {{ m.melding }}</span></span><button type="button" class="dd-act" @click="opnieuw(m.id)">Opnieuw proberen</button></li>
            </ul>
          </article>
          <article class="kaart mt-16" data-test="dealdrive-logboek">
            <header class="kaart-kop"><h2 class="kaart-titel">Logboek</h2></header>
            <p class="kaart-meta">Zonder inhoud: alleen wat er gebeurde, wanneer en of het lukte.</p>
            <p v-if="!dd.runs.length && !dd.gebeurtenissen.length" class="kaart-meta">Nog niets.</p>
            <ul class="schakel-lijst">
              <li v-for="r in dd.runs" :key="r.start + r.handeling" class="schakel-rij"><span>{{ HANDELING[r.handeling] ?? r.handeling }}</span><span class="meta">{{ moment(r.start) }} · {{ r.ok ? 'gelukt' : r.fout }}</span></li>
              <li v-for="g in dd.gebeurtenissen" :key="g.op + g.soort" class="schakel-rij"><span>Terugmelding {{ g.soort }}</span><span class="meta">{{ moment(g.op) }} · {{ g.resultaat }}</span></li>
            </ul>
          </article>
        </div>
      </section>
    </template>
  </div>
</template>
