<script setup lang="ts">
// Vandaag (F01). De inhoud volgt in P07 en P32; hier staat de kop en de lege staat.
const { me } = useMe()
const nu = new Date()
const groet = nu.getHours() < 12 ? 'Goedemorgen' : nu.getHours() < 18 ? 'Goedemiddag' : 'Goedenavond'
const voornaam = computed(() => (me.value?.gebruiker.naam ?? '').replace(/^Test(gebruiker|founder)\s+/, '').split(' ')[0])
const datum = new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }).format(nu).toUpperCase()
useHead({ title: 'Vandaag · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop :kicker="`Vandaag · ${datum}`" :titel="`${groet}, ${voornaam}.`" uitleg="Hier begint je werkdag: wat je nu doet, waarom, en wat er voor je klaarstaat." helpartikel="vandaag" />
    <section class="section section--laatste">
      <div class="container">
        <LegeStaat kicker="Vandaag" titel="Je taken, afspraken en belblok verschijnen hier." tekst="Komt in een volgende versie (P07 en P32)." />
      </div>
    </section>
  </div>
</template>
