<script setup lang="ts">
// Instellingen (F22): kaarten in vier groepen. Wat nog niet gebouwd is, zegt dat.
// Beheerder ziet alles; salesmanager alleen Gebruikers (zijn teams).
const { me, functie } = useMe()
if (!functie('nav.instellingen')?.beschikbaar) throw createError({ statusCode: 403, statusMessage: 'Geen toegang tot instellingen' })
const rol = computed(() => me.value?.gebruiker.rol)
const beheerder = computed(() => rol.value === 'beheerder')

type Kaart = { titel: string; tekst: string; link?: string; toon: boolean }
const GROEPEN = computed<{ naam: string; kaarten: Kaart[] }[]>(() => ([
  {
    naam: 'Organisatie',
    kaarten: [
      { titel: 'Organisatie', tekst: 'Naam, land en start van het verkoopjaar.', link: '/instellingen/organisatie', toon: beheerder.value },
      { titel: 'Werkdagen en feestdagen', tekst: 'Welke dagen telt Dealtrace als werkdag.', link: '/instellingen/organisatie#werkdagen', toon: beheerder.value },
      { titel: 'Abonnement', tekst: 'Je pakket in gewone woorden, seats en contract.', link: '/instellingen/abonnement', toon: beheerder.value },
      { titel: 'Audit en toegang leverancier', tekst: 'Wie wat wijzigde, en wanneer Dealtrace mag meekijken.', link: '/instellingen/audit', toon: beheerder.value },
    ],
  },
  {
    naam: 'Mensen',
    kaarten: [
      { titel: 'Gebruikers en teams', tekst: 'Toevoegen, niveau, werkplek en team.', link: '/instellingen/gebruikers', toon: true },
      { titel: 'Niveaus', tekst: 'Standaardniveau en "Iedereen ziet alles".', link: '/instellingen/niveaus', toon: beheerder.value },
    ],
  },
  {
    naam: 'Werkwijze',
    kaarten: [
      { titel: 'Belscripts', tekst: 'Templates voor binnendienst en buitendienst.', toon: beheerder.value },
      { titel: 'Eigen velden', tekst: 'Extra velden op prospects en contacten.', link: '/instellingen/eigen-velden', toon: beheerder.value },
      { titel: 'Prospectreizen', tekst: 'Standaardreis en reizen op maat.', toon: beheerder.value },
    ],
  },
  {
    naam: 'Koppelingen',
    kaarten: [
      { titel: 'Agenda en mail', tekst: 'Microsoft 365 en Google.', toon: beheerder.value },
      { titel: 'Bronnen', tekst: 'KVK, Datacollectief en CRM.', toon: beheerder.value },
      { titel: 'DealDrive', tekst: 'Overdracht na de eerste afspraak.', toon: beheerder.value },
    ],
  },
] as { naam: string; kaarten: Kaart[] }[]).map((g) => ({ ...g, kaarten: g.kaarten.filter((k) => k.toon) })).filter((g) => g.kaarten.length))
useHead({ title: 'Instellingen · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Instellingen" titel="Instellingen" uitleg="Hoe Dealtrace voor je organisatie werkt." helpartikel="instellingen" />
    <section class="section section--laatste">
      <div class="container">
        <p class="alleen-groot-melding kaart kaart--geel">Beter op een groot scherm. Instellingen werken ook hier, maar zijn ruimer op een laptop.</p>
        <div v-for="g in GROEPEN" :key="g.naam" class="instellingen-groep">
          <span class="kicker kicker--streep">{{ g.naam }}</span>
          <div class="instellingen-raster mt-16">
            <component :is="k.link ? resolveComponent('NuxtLink') : 'article'" v-for="k in g.kaarten" :key="k.titel" :to="k.link" class="kaart" :class="{ 'kaart--klik': k.link, 'kaart--vlak': !k.link }" :data-test="`kaart-${k.titel}`">
              <header class="kaart-kop"><h2 class="kaart-titel">{{ k.titel }}</h2></header>
              <p class="kaart-meta">{{ k.tekst }}</p>
              <p v-if="!k.link" class="veld-uitleg">Komt in een volgende versie.</p>
            </component>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
