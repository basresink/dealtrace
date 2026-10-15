<script setup lang="ts">
// Abonnement (F23, spiegel voor de beheerder): pakket in gewone woorden, seats,
// contract en "Upgrade aanvragen". Facturen en betalen komen in P24.
const { functie } = useMe()
if (!functie('instellingen.abonnement')?.beschikbaar) throw createError({ statusCode: 403, statusMessage: 'Alleen de beheerder' })
const toast = useToast()
const { data: a } = await useFetch<any>('/api/instellingen/abonnement')
const datum = (t?: string) => (t ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(t)) : '')
const STATUS: Record<string, string> = { proef: 'Proefperiode', actief: 'Actief', opgezegd: 'Opgezegd' }
async function upgrade(pakket: string, label: string) {
  try { await $fetch('/api/instellingen/abonnement/upgrade', { method: 'POST', body: { pakket } }); toast.toon(`Upgrade naar ${label} aangevraagd. Dealtrace neemt contact met je op.`) } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
useHead({ title: 'Abonnement · Instellingen · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Instellingen · Abonnement" titel="Abonnement" uitleg="Je pakket, seats en contract." helpartikel="abonnement-verbruik-ai-credits" />
    <section v-if="a" class="section section--laatste">
      <div class="container">
        <div class="instellingen-raster">
          <article class="kaart" data-test="pakket">
            <header class="kaart-kop"><h2 class="kaart-titel">Pakket: {{ a.label }}</h2></header>
            <p class="kaart-meta">{{ a.uitleg }}</p>
          </article>
          <article class="kaart">
            <header class="kaart-kop"><h2 class="kaart-titel">Seats</h2></header>
            <p class="stat-num tnum" data-test="seats">{{ a.gebruikers }} / {{ a.seats ?? '–' }}</p>
            <p class="veld-uitleg">{{ a.gebruikersStand === 'zelf' ? 'Je voegt zelf gebruikers toe zolang er seats vrij zijn.' : 'Nieuwe gebruikers vraag je aan bij Dealtrace.' }}</p>
          </article>
          <article class="kaart">
            <header class="kaart-kop"><h2 class="kaart-titel">Contract</h2></header>
            <dl class="gegevens">
              <dt>Status</dt><dd>{{ STATUS[a.contract.status] ?? 'Actief' }}</dd>
              <template v-if="a.contract.proefTot"><dt>Proef tot</dt><dd>{{ datum(a.contract.proefTot) }}</dd></template>
              <template v-if="a.contract.start"><dt>Start</dt><dd>{{ datum(a.contract.start) }}</dd></template>
              <template v-if="a.contract.looptijdMaanden"><dt>Looptijd</dt><dd>{{ a.contract.looptijdMaanden }} maanden</dd></template>
              <template v-if="a.contract.opzegtermijnMaanden"><dt>Opzegtermijn</dt><dd>{{ a.contract.opzegtermijnMaanden }} maand</dd></template>
            </dl>
            <p class="veld-uitleg">Facturen en betalen komen in een volgende versie.</p>
          </article>
        </div>
        <div v-if="a.upgrades.length" class="instellingen-groep">
          <span class="kicker kicker--streep">Upgrade</span>
          <div class="instellingen-raster mt-16">
            <article v-for="u in a.upgrades" :key="u.pakket" class="kaart">
              <header class="kaart-kop"><h2 class="kaart-titel">{{ u.label }}</h2></header>
              <p class="kaart-meta">{{ u.wint.length ? `Extra: ${u.wint.join(', ')}.` : 'Meer automatisering en inzicht zodra die functies er zijn.' }}</p>
              <button type="button" class="dd-act dd-act--primair mt-16" :data-test="`upgrade-${u.pakket}`" @click="upgrade(u.pakket, u.label)">Upgrade aanvragen</button>
            </article>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
