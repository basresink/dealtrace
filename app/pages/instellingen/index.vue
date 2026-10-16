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
      { titel: 'Regels', tekst: 'Wat de motor zelf klaarzet: 23 regels uit de starterset en jullie eigen regels.', link: '/instellingen/regels', toon: true },
      { titel: 'Accountmatrix en ritmes', tekst: 'Klassen, belmatrix, afspraakmatrix en capaciteit.', link: '/instellingen/ritme', toon: true },
      { titel: 'Verkoopverhaal', tekst: 'Verhaal, belofte, branches, concurrenten, winpunten en terugkomregels.', link: '/instellingen/verkoopverhaal', toon: !!functie('verkoopverhaal.inrichten')?.beschikbaar },
      { titel: 'Gebieden en regiodagen', tekst: 'Regio\'s op postcode, eigenaren, regiodagen en synoniemen voor plaatsnamen.', link: '/instellingen/gebieden', toon: !!functie('instellingen.gebieden')?.beschikbaar },
      { titel: 'Mail koppelen', tekst: 'De SMTP van de organisatie, met test en controle op SPF, DKIM en DMARC.', link: '/instellingen/mail', toon: !!functie('koppeling.mail')?.beschikbaar },
      { titel: 'Mailsjablonen', tekst: 'Sjablonen per kanaal met variabelen.', link: '/instellingen/mailsjablonen', toon: !!functie('instellingen.mailsjablonen')?.beschikbaar },
      { titel: 'Normen per fase', tekst: 'Conversie- en doorlooptijdnormen voor de funnel.', link: '/instellingen/funnel-normen', toon: !!functie('instellingen.funnelNormen')?.beschikbaar },
      { titel: 'Campagnesoorten', tekst: 'Welke campagnesoorten je verkopers kunnen kiezen.', link: '/instellingen/campagnesoorten', toon: !!functie('instellingen.campagnesoorten')?.beschikbaar },
      { titel: 'Meetingsoorten en uitkomsten', tekst: 'Soorten afspraken met duur, agendapunten en uitkomsten met gevolg.', link: '/instellingen/meetingsoorten', toon: !!functie('instellingen.meetingsoorten')?.beschikbaar },
      { titel: 'Belscripts', tekst: 'Standaardscripts voor het belpaneel, met versies en resultaten.', link: '/instellingen/belscripts', toon: true },
      { titel: 'Eigen velden', tekst: 'Extra velden op prospects en contacten.', link: '/instellingen/eigen-velden', toon: beheerder.value },
      { titel: 'Prospectreizen', tekst: 'Doelgroepen, de standaardreis en reizen op maat.', link: '/reizen', toon: beheerder.value },
      { titel: 'Redenen voor nee en terugkomregels', tekst: 'Vaste redenen, afkoelperiode per kanaal en terugkomregels.', link: '/instellingen/nee-redenen', toon: beheerder.value },
    ],
  },
  {
    naam: 'Data en AI',
    kaarten: [
      { titel: 'Verbruik en AI-credits', tekst: 'De pot van deze maand, verbruik per soort en per gebruiker, plafonds en extra credits.', link: '/instellingen/verbruik', toon: !!functie('credits.verbruikLezen')?.beschikbaar },
      { titel: 'Agents en mandaten', tekst: 'Wat de agents zelf mogen, de Bewaker en de knop Agents pauzeren.', link: '/instellingen/agents', toon: !!functie('agents.lezen')?.beschikbaar || beheerder.value },
      { titel: 'Waarnemer en signaalregels', tekst: 'Per doelgroep de signalen waar de Waarnemer op let: vacatures, nieuws, KvK en websites.', link: '/instellingen/waarnemer', toon: !!functie('agents.lezen')?.beschikbaar },
    ],
  },
  {
    naam: 'Koppelingen',
    kaarten: [
      { titel: 'SalesDNA', tekst: 'Het verkoopverhaal automatisch uit SalesDNA, met bron per onderdeel.', link: '/instellingen/koppelingen/salesdna', toon: !!functie('koppeling.salesdna')?.beschikbaar },
      { titel: 'Agenda', tekst: 'Microsoft 365 en Google: aanzetten voor de organisatie; ieder koppelt zelf in Mijn instellingen.', link: '/mij#agenda', toon: beheerder.value },
      { titel: 'CRM', tekst: 'HubSpot: lezen voor ontdubbelen en klantprofiel, terugschrijven van leads, uitkomsten en de overdracht.', link: '/instellingen/koppelingen/crm', toon: !!functie('koppeling.crm')?.beschikbaar || !!functie('koppeling.crmSync')?.beschikbaar },
      { titel: 'Bronnen', tekst: 'KVK en Datacollectief in de leadgenerator.', link: '/leadgenerator?tab=koppelingen', toon: beheerder.value },
      { titel: 'DealDrive', tekst: 'Overdracht na de eerste afspraak: stand, Test verbinding en mislukte overdrachten.', link: '/instellingen/koppelingen/dealdrive', toon: !!functie('koppelingen.dealdrive')?.beschikbaar },
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
