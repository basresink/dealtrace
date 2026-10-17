<script setup lang="ts">
import { FACTUUR_STATUS } from '~~/shared/facturatie'

const euro = (c: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(c / 100)
// Abonnement (F23, spiegel voor de beheerder): pakket in gewone woorden, seats, contract,
// "Upgrade aanvragen", factuurgegevens en de facturen met pdf. Betalen in de app komt met de echte Stripe-koppeling.
const { functie } = useMe()
if (!functie('instellingen.abonnement')?.beschikbaar) throw createError({ statusCode: 403, statusMessage: 'Alleen de beheerder' })
const toast = useToast()
const { data: a } = await useFetch<any>('/api/instellingen/abonnement')
const datum = (t?: string) => (t ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(t)) : '')
const STATUS: Record<string, string> = { proef: 'Proefperiode', actief: 'Actief', opgezegd: 'Opgezegd' }
const FACTUUR_STAND = { open: 'factuur-open', betaald: 'betaald', achterstallig: 'achterstallig', geannuleerd: 'geannuleerd' } as const as Record<string, 'factuur-open' | 'betaald' | 'achterstallig' | 'geannuleerd'>
async function upgrade(pakket: string, label: string) {
  try { await $fetch('/api/instellingen/abonnement/upgrade', { method: 'POST', body: { pakket } }); toast.toon(`Upgrade naar ${label} aangevraagd. Dealtrace neemt contact met je op.`) } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const titel = computed(() => (a.value ? `Pakket ${a.value.label}${a.value.seats ? `, ${a.value.gebruikers} van ${a.value.seats} seats in gebruik` : ''}` : 'Abonnement'))
// Filter op de facturen: status (open, betaald, achterstallig).
const factuurStatus = ref('')
const facturen = computed(() => (a.value?.facturen ?? []).filter((f: any) => !factuurStatus.value || f.status === factuurStatus.value))
const telStatus = (k: string) => (a.value?.facturen ?? []).filter((f: any) => f.status === k).length
useHead({ title: 'Abonnement · Instellingen · Dealtrace' })
</script>

<template>
  <div>
    <InstellingenKop groep="Organisatie" :titel="titel" uitleg="Abonnement: je pakket, seats, contract, factuurgegevens en facturen." helpartikel="abonnement-verbruik-ai-credits" :filters="a?.facturen?.length ? (factuurStatus ? 1 : 0) : null" @reset="factuurStatus = ''">
      <template #acties>
        <FunctieLink to="/instellingen/gebruikers" class="dd-actie dd-actie--secundair" data-test="abonnement-gebruikers"><Icoon naam="Users" class="dd-actie-icoon" />Gebruikers beheren</FunctieLink>
      </template>
      <template #filters>
        <div class="ifp-groep" role="group" aria-label="Status van de factuur"><span class="filter-label">Facturen</span>
          <button v-for="[k, l] in [['', 'Alle'], ['open', 'Open'], ['achterstallig', 'Achterstallig'], ['betaald', 'Betaald']]" :key="k" type="button" class="filter-pil" :class="{ 'filter-pil--aan': factuurStatus === k }" :aria-pressed="factuurStatus === k" @click="factuurStatus = k!">{{ l }}<span v-if="k" class="pil-teller tnum">{{ telStatus(k!) }}</span></button>
        </div>
      </template>
    </InstellingenKop>
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
              <dt>Status</dt><dd><Label v-if="a.contract.status === 'proef' || a.contract.status === 'opgezegd'" soort="contract" :waarde="a.contract.status" /><template v-else>{{ STATUS[a.contract.status] ?? 'Actief' }}</template></dd>
              <template v-if="a.contract.proefTot"><dt>Proef tot</dt><dd>{{ datum(a.contract.proefTot) }}</dd></template>
              <template v-if="a.contract.start"><dt>Start</dt><dd>{{ datum(a.contract.start) }}</dd></template>
              <template v-if="a.contract.looptijdMaanden"><dt>Looptijd</dt><dd>{{ a.contract.looptijdMaanden }} maanden</dd></template>
              <template v-if="a.contract.opzegtermijnMaanden"><dt>Opzegtermijn</dt><dd>{{ a.contract.opzegtermijnMaanden }} maand</dd></template>
            </dl>
            <p v-if="a.aiCreditsPerMaand" class="veld-uitleg">AI-credits: {{ a.aiCreditsPerMaand }} per gebruiker per maand, samen in één pot.</p>
          </article>
        </div>
        <div class="abonnement-raster mt-16">
          <FactuurgegevensKaart :gegevens="a.factuurgegevens" @bewaard="a.factuurgegevens = $event" />
          <article class="kaart" data-test="facturen">
            <header class="kaart-kop"><h2 class="kaart-titel">Facturen</h2><InstellingLabel v-if="a.aiGepauzeerd" stand="achterstallig" tekst="AI gepauzeerd" /></header>
            <p v-if="a.aiGepauzeerd" class="kaart-meta">Er staat een factuur open. AI-functies staan stil tot hij betaald is; de rest van Dealtrace werkt gewoon.</p>
            <LegeStaat v-if="!a.facturen.length" titel="Nog geen facturen" tekst="Je eerste factuur komt aan het eind van de eerste maand. Hij staat dan hier, met een pdf om te downloaden." />
            <LegeStaat v-else-if="!facturen.length" titel="Geen facturen met deze status." tekst="Kies een andere status in Filters." />
            <ul v-else class="schakel-lijst" data-test="facturen-lijst">
              <li v-for="f in facturen" :key="f.id" class="schakel-rij" :data-test="`factuur-${f.nummer}`">
                <span class="factuur-tekst"><span class="tnum">{{ f.nummer }} · {{ euro(f.bedragCent) }}</span><span class="veld-uitleg">{{ datum(f.op) }}{{ f.status !== 'betaald' && f.vervaltOp ? `, te betalen voor ${datum(f.vervaltOp)}` : '' }}</span></span>
                <span class="dd-acties"><InstellingLabel :stand="FACTUUR_STAND[f.status] ?? 'factuur-open'" :tekst="FACTUUR_STATUS[f.status] ?? f.status" /><a :href="f.pdf" download class="dd-act" :aria-label="`Pdf van factuur ${f.nummer} downloaden`" data-test="factuur-pdf"><Icoon naam="Download" :grootte="16" /> Pdf</a></span>
              </li>
            </ul>
            <p v-if="a.facturen.some((f: any) => f.status !== 'betaald' && f.status !== 'geannuleerd')" class="veld-uitleg mt-16">Betalen gaat via de betaallink in de mail van Dealtrace.</p>
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

<style scoped>
.abonnement-raster { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr)); gap: var(--kaart-gap); align-items: start; }
.factuur-tekst { display: flex; flex-direction: column; min-width: 0; }
</style>
