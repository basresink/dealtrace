<script setup lang="ts">
// Instellingen (F22): kaarten in de groepen Organisatie, Verkoop, Ritme en regels, Data en AI en
// Koppelingen. Elke kaart zegt wat hij regelt en de stand in één regel ("23 regels, 20 door de motor",
// "Nog niet ingericht") uit GET /api/instellingen/overzicht; de groep Koppelingen telt wat actief is.
// Beheerder ziet alles; salesmanager de onderdelen voor zijn teams.
const { me, functie } = useMe()
if (!functie('nav.instellingen')?.beschikbaar) throw createError({ statusCode: 403, statusMessage: 'Geen toegang tot instellingen' })
const rol = computed(() => me.value?.gebruiker.rol)
const beheerder = computed(() => rol.value === 'beheerder')
const { data: overzicht } = useFetch<{ stand: Record<string, string>; groepen: Record<string, string> }>('/api/instellingen/overzicht', { lazy: true, default: () => ({ stand: {}, groepen: {} }) })

type Kaart = { titel: string; tekst: string; link?: string; toon: boolean }
const GROEPEN = computed<{ naam: string; kaarten: Kaart[] }[]>(() => ([
  {
    naam: 'Organisatie',
    kaarten: [
      { titel: 'Organisatie', tekst: 'Naam, land en start van het verkoopjaar.', link: '/instellingen/organisatie', toon: beheerder.value },
      { titel: 'Werkdagen en feestdagen', tekst: 'Welke dagen telt Dealtrace als werkdag.', link: '/instellingen/organisatie#werkdagen', toon: beheerder.value },
      { titel: 'Gebruikers en teams', tekst: 'Toevoegen, niveau, werkplek en team.', link: '/instellingen/gebruikers', toon: true },
      { titel: 'Niveaus en functies', tekst: 'Standaardniveau, "Iedereen ziet alles", welke functie bij welk niveau hoort en wie mag wat.', link: '/instellingen/niveaus', toon: beheerder.value },
      { titel: 'Abonnement', tekst: 'Je pakket in gewone woorden, seats en contract.', link: '/instellingen/abonnement', toon: beheerder.value },
      { titel: 'Verbruik en AI-credits', tekst: 'De pot van deze maand, verbruik per soort en per gebruiker, plafonds en extra credits.', link: '/instellingen/verbruik', toon: !!functie('credits.verbruikLezen')?.beschikbaar },
      { titel: 'Audit en toegang leverancier', tekst: 'Wie wat wijzigde, met filters en download, en wanneer Dealtrace mag meekijken.', link: '/instellingen/audit', toon: !!functie('instellingen.audit')?.beschikbaar },
    ],
  },
  {
    naam: 'Verkoop',
    kaarten: [
      { titel: 'Verkoopverhaal', tekst: 'Verhaal, belofte, branches, concurrenten, winpunten en terugkomregels.', link: '/instellingen/verkoopverhaal', toon: !!functie('verkoopverhaal.inrichten')?.beschikbaar },
      { titel: 'Prospectreizen', tekst: 'Doelgroepen, de standaardreis en reizen op maat.', link: '/reizen', toon: beheerder.value },
      { titel: 'Belscripts', tekst: 'Belscript Studio: het standaardscript in blokken, templates, een script per prospect en de belmodus.', link: '/belscripts', toon: true },
      { titel: 'Alle belscripts', tekst: 'Overzicht van alle scripts met versies, resultaten en vergelijking.', link: '/instellingen/belscripts', toon: true },
      { titel: 'Mailsjablonen', tekst: 'Sjablonen per kanaal met variabelen, aan of uit.', link: '/instellingen/mailsjablonen', toon: !!functie('instellingen.mailsjablonen')?.beschikbaar },
      { titel: 'Opvolgreeksen', tekst: 'Sjablonen voor opvolgreeksen: stappen per dag, kanaal, instructie voor de Schrijver en stopregels.', link: '/instellingen/opvolgreeksen', toon: !!functie('instellingen.opvolgreeksen')?.beschikbaar },
      { titel: 'Meetingsoorten en uitkomsten', tekst: 'Soorten afspraken met duur, agendapunten en uitkomsten met gevolg.', link: '/instellingen/meetingsoorten', toon: !!functie('instellingen.meetingsoorten')?.beschikbaar },
      { titel: 'Campagnesoorten', tekst: 'Welke campagnesoorten je verkopers kunnen kiezen.', link: '/instellingen/campagnesoorten', toon: !!functie('instellingen.campagnesoorten')?.beschikbaar },
      { titel: 'Normen per fase', tekst: 'Conversie- en doorlooptijdnormen voor de funnel.', link: '/instellingen/funnel-normen', toon: !!functie('instellingen.funnelNormen')?.beschikbaar },
      { titel: 'Redenen voor nee en terugkomregels', tekst: 'Vaste redenen, afkoelperiode per kanaal en terugkomregels.', link: '/instellingen/nee-redenen', toon: beheerder.value },
    ],
  },
  {
    naam: 'Ritme en regels',
    kaarten: [
      { titel: 'Accountmatrix en ritmes', tekst: 'Klassen, belmatrix, afspraakmatrix en capaciteit.', link: '/instellingen/ritme', toon: true },
      { titel: 'Hercontactritmes', tekst: 'Na een nee of een afgeronde reis: wanneer en hoe je terugkomt.', link: '/planning?tab=ritme', toon: !!functie('ritme.beheer')?.beschikbaar },
      { titel: 'Regels', tekst: 'Wat de motor zelf klaarzet: de regels uit de starterset en jullie eigen regels.', link: '/instellingen/regels', toon: true },
      { titel: 'Gebieden en regiodagen', tekst: 'Regio\'s op postcode, eigenaren, regiodagen en synoniemen voor plaatsnamen.', link: '/instellingen/gebieden', toon: !!functie('instellingen.gebieden')?.beschikbaar },
    ],
  },
  {
    naam: 'Data en AI',
    kaarten: [
      { titel: 'Eigen velden', tekst: 'Extra velden op prospects en contacten.', link: '/instellingen/eigen-velden', toon: beheerder.value },
      { titel: 'Agents en mandaten', tekst: 'Wat de agents zelf mogen, de Bewaker en de knop Agents pauzeren.', link: '/instellingen/agents', toon: !!functie('agents.lezen')?.beschikbaar || beheerder.value },
      { titel: 'Waarnemer en signaalregels', tekst: 'Per doelgroep de signalen waar de Waarnemer op let: vacatures, nieuws, KvK en websites.', link: '/instellingen/waarnemer', toon: !!functie('agents.lezen')?.beschikbaar },
      { titel: 'Eigen agent-prompts', tekst: 'Per slot een eigen laag boven de prompt van het platform, met Proefdraai.', link: '/instellingen/prompts', toon: !!functie('instellingen.prompts')?.beschikbaar },
      { titel: 'Kanalen en consent', tekst: 'Afkoelperiodes en frequentieplafond per kanaal, mailvoorwaarden, WhatsApp-sjablonen en de bel-me-niet-lijst.', link: '/instellingen/kanalen', toon: !!functie('instellingen.kanalen')?.beschikbaar },
    ],
  },
  {
    naam: 'Koppelingen',
    kaarten: [
      { titel: 'SalesDNA', tekst: 'Het verkoopverhaal automatisch uit SalesDNA, met bron per onderdeel.', link: '/instellingen/koppelingen/salesdna', toon: !!functie('koppeling.salesdna')?.beschikbaar },
      { titel: 'Agenda', tekst: 'Microsoft 365 en Google: aanzetten voor de organisatie; ieder koppelt zelf bij Account.', link: '/instellingen/koppelingen/agenda', toon: beheerder.value },
      { titel: 'Mail koppelen', tekst: 'De SMTP van de organisatie, met test en controle op SPF, DKIM en DMARC.', link: '/instellingen/mail', toon: !!functie('koppeling.mail')?.beschikbaar },
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
          <div class="inst-groepkop"><span class="kicker kicker--streep">{{ g.naam }}</span><span v-if="overzicht.groepen[g.naam]" class="meta" :data-test="`groepstand-${g.naam}`">{{ overzicht.groepen[g.naam] }}</span></div>
          <div class="instellingen-raster mt-16">
            <component :is="k.link ? resolveComponent('NuxtLink') : 'article'" v-for="k in g.kaarten" :key="k.titel" :to="k.link" class="kaart" :class="{ 'kaart--klik': k.link, 'kaart--vlak': !k.link }" :data-test="`kaart-${k.titel}`">
              <header class="kaart-kop"><h2 class="kaart-titel">{{ k.titel }}</h2></header>
              <p class="kaart-meta">{{ k.tekst }}</p>
              <p v-if="k.link && overzicht.stand[k.link]" class="inst-stand" data-test="kaart-stand">{{ overzicht.stand[k.link] }}</p>
              <p v-if="!k.link" class="veld-uitleg">Komt in een volgende versie.</p>
            </component>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.inst-groepkop { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 16px; }
.inst-stand { margin: 8px 0 0; font-size: 13px; font-weight: 600; color: var(--ink); }
</style>
