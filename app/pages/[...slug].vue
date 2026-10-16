<script setup lang="ts">
// Alle zijbalkpagina's die een latere prompt bouwt. Staat de functie niet aan
// voor je niveau, dan de kop "Nog niet aangezet" met uitleg; nooit een foutpagina (6.1).
import { FUNCTIES } from '~~/shared/functies'
const route = useRoute()
const { functie: meFunctie } = useMe()
const pad = computed(() => `/${([] as string[]).concat(route.params.slug as string[]).join('/')}`)
const f = computed(() => FUNCTIES.find((x) => x.zijbalk && (pad.value === x.zijbalk.route || pad.value.startsWith(`${x.zijbalk.route}/`))))
const stand = computed(() => (f.value ? meFunctie(f.value.sleutel) : undefined))
const titel = computed(() => f.value?.naam ?? ((pad.value.startsWith('/helpcenter') || pad.value.startsWith('/help/')) ? 'Helpcenter' : pad.value === '/roadmap' ? 'Roadmap' : 'Pagina'))
useHead({ title: () => `${titel.value} · Dealtrace` })
</script>

<template>
  <div>
    <NietAangezetKop v-if="f && stand && !stand.beschikbaar && stand.reden === 'niveau'" :sleutel="f.sleutel" />
    <section v-else-if="f && stand && !stand.beschikbaar" class="section">
      <div class="container container--smal">
        <span class="kicker kicker--streep">Geen toegang</span>
        <h1 class="title title--groot">{{ f.naam }}</h1>
        <p class="subtitle subtitle--groot">{{ stand.reden === 'pakket' ? 'Dit onderdeel zit niet in het abonnement van je organisatie.' : 'Deze pagina is voor een andere rol.' }}</p>
      </div>
    </section>
    <template v-else>
      <PaginaKop :kicker="titel" :titel="titel" :uitleg="f?.uitleg.watHetDoet" :helpartikel="f?.helpartikel" />
      <section class="section section--laatste">
        <div class="container">
          <LegeStaat :kicker="titel" titel="Komt in een volgende versie." tekst="Deze pagina wordt gebouwd in een latere bouwprompt (zie docs/prompts/README.md)." />
        </div>
      </section>
    </template>
  </div>
</template>
