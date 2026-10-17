<script setup lang="ts">
// Instellingen (F22): kaarten in de groepen Organisatie, Verkoop, Ritme en regels, Data en AI en
// Koppelingen. Elke kaart zegt wat hij regelt en de stand in één regel ("23 regels, 20 door de motor",
// "Nog niet ingericht") uit GET /api/instellingen/overzicht; de groep Koppelingen telt wat actief is.
// Beheerder ziet alles; salesmanager de onderdelen voor zijn teams.
const { me, functie } = useMe()
// Een kaart van een functie die uit staat, staat er niet (één register: shared/functieRoutes.ts).
const { magNaar } = useFunctie()
if (!functie('nav.instellingen')?.beschikbaar) throw createError({ statusCode: 403, statusMessage: 'Geen toegang tot instellingen' })
const rol = computed(() => me.value?.gebruiker.rol)
const beheerder = computed(() => rol.value === 'beheerder')
const { data: overzicht } = useFetch<{ stand: Record<string, string>; groepen: Record<string, string> }>('/api/instellingen/overzicht', { lazy: true, default: () => ({ stand: {}, groepen: {} }) })

type Kaart = { titel: string; tekst: string; link: string; toon: boolean }
const GROEPEN = computed<{ naam: string; kaarten: Kaart[] }[]>(() => ([
  {
    naam: 'Organisatie',
    kaarten: [
      { titel: 'Organisatie', tekst: 'Naam, land en start van het verkoopjaar.', link: '/instellingen/organisatie', toon: beheerder.value },
      { titel: 'Werkdagen en feestdagen', tekst: 'Welke dagen telt Dealtrace als werkdag.', link: '/instellingen/organisatie#werkdagen', toon: beheerder.value },
      { titel: 'Gebruikers en teams', tekst: 'Toevoegen, niveau, werkplek en team.', link: '/instellingen/gebruikers', toon: true },
      { titel: 'Niveaus en functies', tekst: 'Standaardniveau, "Iedereen ziet alles", welke functie bij welk niveau hoort en wie mag wat.', link: '/instellingen/niveaus', toon: beheerder.value },
      { titel: 'Abonnement', tekst: 'Je pakket in gewone woorden, seats, contract, factuurgegevens en facturen als pdf.', link: '/instellingen/abonnement', toon: beheerder.value },
      { titel: 'Verbruik en AI-credits', tekst: 'De pot van deze maand, verbruik per soort en per gebruiker, plafonds en extra credits.', link: '/instellingen/verbruik', toon: !!functie('credits.verbruikLezen')?.beschikbaar },
      { titel: 'Audit en toegang leverancier', tekst: 'Wie wat wijzigde, met filters en download, en wanneer Dealtrace mag meekijken.', link: '/instellingen/audit', toon: !!functie('instellingen.audit')?.beschikbaar },
    ],
  },
  {
    naam: 'Verkoop',
    kaarten: [
      { titel: 'SalesDNA', tekst: 'Verhaal, belofte, branches, concurrenten, winpunten en terugkomregels.', link: '/instellingen/verkoopverhaal', toon: !!functie('verkoopverhaal.inrichten')?.beschikbaar },
      { titel: 'Prospectreizen', tekst: 'Doelgroepen, de standaardreis en reizen op maat.', link: '/reizen', toon: beheerder.value },
      { titel: 'Belscripts', tekst: 'Belscript Studio: het standaardscript in blokken, templates, een script per prospect en de belmodus.', link: '/belscripts', toon: true },
      { titel: 'Alle belscripts', tekst: 'Overzicht van alle scripts met versies, resultaten en vergelijking.', link: '/instellingen/belscripts', toon: true },
      { titel: 'Mailsjablonen', tekst: 'Sjablonen per kanaal met variabelen, aan of uit.', link: '/instellingen/mailsjablonen', toon: !!functie('instellingen.mailsjablonen')?.beschikbaar },
      { titel: 'Opvolgreeksen', tekst: 'Sjablonen voor opvolgreeksen: stappen per dag, kanaal, instructie voor de Schrijver en stopregels.', link: '/instellingen/opvolgreeksen', toon: !!functie('instellingen.opvolgreeksen')?.beschikbaar },
      { titel: 'Meetingsoorten en uitkomsten', tekst: 'Soorten afspraken met duur, agendapunten en uitkomsten met gevolg.', link: '/instellingen/meetingsoorten', toon: !!functie('instellingen.meetingsoorten')?.beschikbaar },
      { titel: 'Campagnesoorten', tekst: 'Welke campagnesoorten je verkopers kunnen kiezen.', link: '/instellingen/campagnesoorten', toon: !!functie('instellingen.campagnesoorten')?.beschikbaar },
      { titel: 'Normen per fase', tekst: 'Conversie- en doorlooptijdnormen voor de funnel.', link: '/instellingen/funnel-normen', toon: !!functie('instellingen.funnelNormen')?.beschikbaar },
      { titel: 'Terugkomen', tekst: 'Terugkomregels, verliesredenen, afkoeling per kanaal en het hercontactritme daarna, met wat er verschuift.', link: '/instellingen/terugkomen', toon: ['verkoopverhaal.inrichten', 'verkoopverhaal.mappings', 'instellingen.afkoeling', 'ritme.beheer'].some((f) => !!functie(f)?.beschikbaar) },
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
      { titel: 'Privacy en export', tekst: 'Bewaartermijnen, wat er bij de opschoning zou vervallen en alle data van de organisatie als zip.', link: '/instellingen/privacy', toon: beheerder.value },
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
      { titel: 'SalesDNA-koppeling', tekst: 'Je SalesDNA automatisch uit het SalesDNA-platform, met bron per onderdeel.', link: '/instellingen/koppelingen/salesdna', toon: !!functie('koppeling.salesdna')?.beschikbaar },
      { titel: 'Agenda', tekst: 'Microsoft 365 en Google: aanzetten voor de organisatie; ieder koppelt zelf bij Account.', link: '/instellingen/koppelingen/agenda', toon: beheerder.value },
      { titel: 'Mail koppelen', tekst: 'De SMTP van de organisatie, met test en controle op SPF, DKIM en DMARC.', link: '/instellingen/mail', toon: !!functie('koppeling.mail')?.beschikbaar },
      { titel: 'CRM', tekst: 'HubSpot: lezen voor ontdubbelen en klantprofiel, terugschrijven van leads, uitkomsten en de overdracht.', link: '/instellingen/koppelingen/crm', toon: !!functie('koppeling.crm')?.beschikbaar || !!functie('koppeling.crmSync')?.beschikbaar },
      { titel: 'Bronnen', tekst: 'KVK en Datacollectief in de leadgenerator.', link: '/leadgenerator?tab=koppelingen', toon: beheerder.value },
      { titel: 'DealDrive', tekst: 'Overdracht na de eerste afspraak: stand, Test verbinding en mislukte overdrachten.', link: '/instellingen/koppelingen/dealdrive', toon: !!functie('koppelingen.dealdrive')?.beschikbaar },
    ],
  },
] as { naam: string; kaarten: Kaart[] }[]).map((g) => ({ ...g, kaarten: g.kaarten.filter((k) => k.toon && magNaar(k.link)) })).filter((g) => g.kaarten.length))
// Filters op de hub: één groep, wat nog aandacht vraagt (nog niet ingericht of gekoppeld) en zoeken op naam.
const filter = reactive({ groep: '', aandacht: false, zoek: '' })
const aantalFilters = computed(() => (filter.groep ? 1 : 0) + (filter.aandacht ? 1 : 0) + (filter.zoek.trim() ? 1 : 0))
const vraagtAandacht = (k: Kaart) => /^(nog niet|nog geen|niet gekoppeld|uit\b)/i.test(overzicht.value.stand[k.link] ?? '')
const zichtbareGroepen = computed(() => {
  const z = filter.zoek.trim().toLowerCase()
  return GROEPEN.value
    .filter((g) => !filter.groep || g.naam === filter.groep)
    .map((g) => ({ ...g, kaarten: g.kaarten.filter((k) => (!filter.aandacht || vraagtAandacht(k)) && (!z || `${k.titel} ${k.tekst}`.toLowerCase().includes(z))) }))
    .filter((g) => g.kaarten.length)
})
const alleKaarten = computed(() => GROEPEN.value.flatMap((g) => g.kaarten))
const aandachtTal = computed(() => alleKaarten.value.filter(vraagtAandacht).length)
const hubTitel = computed(() => `${alleKaarten.value.length} onderdelen, ${aandachtTal.value ? `${aandachtTal.value} nog niet ingericht` : 'alles ingericht'}`)
function wisFilters() { Object.assign(filter, { groep: '', aandacht: false, zoek: '' }) }
useHead({ title: 'Instellingen · Dealtrace' })
</script>

<template>
  <div>
    <InstellingenKop hub :groep="beheerder ? 'Beheer' : 'Je teams'" :titel="hubTitel" uitleg="Hoe Dealtrace voor je organisatie werkt. Elke kaart zegt wat hij regelt en hoe het er nu voor staat." helpartikel="instellingen" :filters="aantalFilters" @reset="wisFilters">
      <template #filters>
        <div class="ifp-groep"><label class="filter-label" for="hub-zoek">Zoeken</label><input id="hub-zoek" v-model="filter.zoek" type="search" class="invoer ifp-zoek" placeholder="Bijvoorbeeld mail of regio" data-test="hub-zoek"></div>
        <div class="ifp-groep" role="group" aria-label="Groep"><span class="filter-label">Groep</span>
          <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': !filter.groep }" :aria-pressed="!filter.groep" @click="filter.groep = ''">Alle</button>
          <button v-for="g in GROEPEN" :key="g.naam" type="button" class="filter-pil" :class="{ 'filter-pil--aan': filter.groep === g.naam }" :aria-pressed="filter.groep === g.naam" @click="filter.groep = g.naam">{{ g.naam }}<span class="pil-teller tnum">{{ g.kaarten.length }}</span></button>
        </div>
        <div class="ifp-groep" role="group" aria-label="Stand"><span class="filter-label">Stand</span>
          <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': filter.aandacht }" :aria-pressed="filter.aandacht" data-test="hub-aandacht" @click="filter.aandacht = !filter.aandacht">Nog niet ingericht<span class="pil-teller tnum">{{ aandachtTal }}</span></button>
        </div>
      </template>
    </InstellingenKop>
    <section class="section section--laatste">
      <div class="container">
        <p class="alleen-groot-melding kaart kaart--geel">Beter op een groot scherm. Instellingen werken ook hier, maar zijn ruimer op een laptop.</p>
        <LegeStaat v-if="!zichtbareGroepen.length" kicker="Niets gevonden" titel="Geen instellingen in dit filter." tekst="Kies een andere groep of zoek op een ander woord.">
          <button type="button" class="dd-act mt-16" @click="wisFilters">Wis filters</button>
        </LegeStaat>
        <div v-for="g in zichtbareGroepen" :key="g.naam" class="instellingen-groep">
          <div class="inst-groepkop"><span class="kicker kicker--streep">{{ g.naam }}</span><span v-if="overzicht.groepen[g.naam]" class="meta" :data-test="`groepstand-${g.naam}`">{{ overzicht.groepen[g.naam] }}</span></div>
          <div class="instellingen-raster mt-16">
            <FunctieLink v-for="k in g.kaarten" :key="k.titel" :to="k.link" class="kaart kaart--klik" :data-test="`kaart-${k.titel}`">
              <header class="kaart-kop"><h2 class="kaart-titel">{{ k.titel }}</h2></header>
              <p class="kaart-meta">{{ k.tekst }}</p>
              <p v-if="overzicht.stand[k.link]" class="inst-stand" data-test="kaart-stand">{{ overzicht.stand[k.link] }}</p>
            </FunctieLink>
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
