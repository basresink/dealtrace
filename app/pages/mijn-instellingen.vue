<script setup lang="ts">
// Mijn instellingen (/mijn-instellingen): je persoonlijke instellingen voor elke rol, in de opzet van
// DealDrive: een kop, de onderdelen als kaarten die naar hun sectie springen, en daaronder de secties
// (Mijn scripts, AI-verbruik, Toestellen en sessies, Telefoon, Meldingen onderweg en Offline).
// Je gegevens en het inloggen staan op Account (/mij); de organisatie stelt de beheerder in op /instellingen.
const { functie } = useMe()
const toast = useToast()
const { data: ai } = await useFetch<any>('/api/assistent/credits', { default: () => null })
const { data: pers } = await useFetch<{ id: string; data: Record<string, any>; versie: number }>('/api/mij/instellingen')

// Offline (P30): de stand van het dagpakket, foto's en opnames alleen via wifi, en "Ververs nu".
const dp = useDagpakket()
const bijl = useBijlagen()
onMounted(async () => { if (!dp.pakket.value) dp.pakket.value = await dp.uitOpslag() })
const pakketStand = computed(() => { const p = dp.pakket.value; return p ? `Klaar voor vandaag · ${p.accounts.length} accounts · ${(p.grootte / 1024 / 1024).toLocaleString('nl-NL', { maximumFractionDigits: 1 })} MB · bijgewerkt ${new Date(p.gemaaktOp).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}` : 'Nog geen dagpakket op deze telefoon.' })
async function ververs() { await dp.laad({ forceer: true }); toast.toon(dp.fout.value ?? 'Dagpakket bijgewerkt.', dp.fout.value ? 'fout' : 'succes') }

const scriptsAan = computed(() => !!functie('belscript.variant')?.beschikbaar)
const onderwegAan = computed(() => !!functie('meldingen.onderweg')?.beschikbaar)
const offlineAan = computed(() => !!functie('onderweg.dagpakket')?.beschikbaar)

/** De onderdelen als kaarten bovenaan; elk springt naar zijn sectie. */
const onderdelen = computed(() => [
  { id: 'scripts', titel: 'Mijn scripts', tekst: 'Je eigen varianten van de belscripts van je team.', icoon: 'FileText', toon: scriptsAan.value },
  { id: 'ai-verbruik', titel: 'Jouw AI-verbruik', tekst: 'Hoeveel credits je deze maand gebruikte, per soort.', icoon: 'Sparkles', toon: !!ai.value },
  { id: 'toestellen', titel: 'Toestellen en sessies', tekst: 'Waar je bent ingelogd, en uitloggen per toestel of overal.', icoon: 'Smartphone', toon: true },
  { id: 'telefoon', titel: 'Telefoon', tekst: 'Handschoen- en zonlichtmodus voor onderweg.', icoon: 'Phone', toon: true },
  { id: 'dagplanning', titel: 'Dagplanning', tekst: 'Laat de Dagplanner je dag elke werkdag zelf indelen.', icoon: 'CalendarClock', toon: !!functie('dagritme.dagstart')?.beschikbaar },
  { id: 'dagritme-mail', titel: 'Je ritme per mail', tekst: 'Weekreview, weekstart en dagstart in je mailbox, op jouw tijd.', icoon: 'Mail', toon: !!functie('dagritme.mail')?.beschikbaar },
  { id: 'onderweg', titel: 'Meldingen onderweg', tekst: 'Push op dit toestel, stille uren, dagstart en rijmodus.', icoon: 'Bell', toon: onderwegAan.value },
  { id: 'offline', titel: 'Offline', tekst: 'Je dagpakket voor onderweg en versturen via wifi.', icoon: 'WifiOff', toon: offlineAan.value },
].filter((o) => o.toon))

useHead({ title: 'Mijn instellingen · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Voorkeuren · Mijn instellingen" titel="Jouw toestellen, jouw werkwijze." uitleg="Alles wat alleen voor jou geldt: je scripts, je AI-verbruik, je toestellen en hoe Dealtrace zich onderweg gedraagt. Instellingen voor de hele organisatie beheert je beheerder." helpartikel="mijn-instellingen" />

    <section class="section section--alt">
      <div class="container">
        <span class="mi-kicker">Jouw onderdelen</span>
        <p class="mi-tekst">Elk onderdeel hieronder gaat alleen over jou. Je naam, je foto en het inloggen staan op <NuxtLink to="/mij" class="tekst-link">Account</NuxtLink>.</p>
        <nav class="mi-raster" aria-label="Onderdelen van Mijn instellingen" data-test="mi-onderdelen">
          <NuxtLink v-for="o in onderdelen" :key="o.id" :to="{ hash: `#${o.id}` }" class="mi-kaart" :data-test="`mi-naar-${o.id}`">
            <span class="mi-kaart-kop"><Icoon :naam="o.icoon" :grootte="18" /><span class="mi-kaart-titel">{{ o.titel }}</span></span>
            <span class="mi-kaart-tekst">{{ o.tekst }}</span>
            <span class="mi-kaart-cta">Openen <Icoon naam="ArrowRight" :grootte="14" /></span>
          </NuxtLink>
          <NuxtLink to="/mij" class="mi-kaart" data-test="mi-naar-account">
            <span class="mi-kaart-kop"><Icoon naam="CircleUser" :grootte="18" /><span class="mi-kaart-titel">Account</span></span>
            <span class="mi-kaart-tekst">Naam, functie, telefoon, foto, inloggen en tweestapsverificatie.</span>
            <span class="mi-kaart-cta">Openen <Icoon naam="ArrowRight" :grootte="14" /></span>
          </NuxtLink>
        </nav>
      </div>
    </section>

    <section class="section section--laatste">
      <div class="container">
        <div class="mi-secties">
          <article v-if="scriptsAan" id="scripts" class="kaart mi-sectie" data-test="mijn-scripts-kaart">
            <header class="kaart-kop"><h2 class="kaart-titel">Mijn scripts</h2></header>
            <p class="kaart-meta">Je eigen varianten van de belscripts van je team.</p>
            <div class="reis-knoppen mt-16"><NuxtLink to="/instellingen/mijn-scripts" class="dd-act">Naar mijn scripts</NuxtLink><NuxtLink to="/belscripts" class="dd-act" data-test="mijn-scripts-studio">Open Belscript Studio</NuxtLink></div>
          </article>
          <article v-if="ai" id="ai-verbruik" class="kaart mi-sectie" data-test="mijn-ai-verbruik">
            <header class="kaart-kop"><h2 class="kaart-titel">Jouw AI-verbruik deze maand</h2></header>
            <p class="kaart-meta">{{ ai.eigen.plafond != null ? `${ai.eigen.verbruikt} van ${ai.eigen.plafond} credits` : `${ai.eigen.verbruikt} credits` }} · de organisatie heeft er nog {{ ai.over }} over.</p>
            <ul v-if="ai.eigen.perSoort.length" class="schakel-lijst"><li v-for="s in ai.eigen.perSoort" :key="s.soort" class="schakel-rij"><span>{{ s.soort }}</span><span class="meta tnum">{{ s.handelingen }} keer · {{ s.credits }} credits</span></li></ul>
          </article>
          <MijnToestellen />
          <OnderwegMeldingen :pers="pers ?? null" />
          <div id="dagplanning" class="mi-sectie"><DagplanningVoorkeur /></div>
          <div id="dagritme-mail" class="mi-sectie"><DagritmeMailVoorkeuren /></div>
          <article v-if="offlineAan" id="offline" class="kaart mi-sectie" data-test="mijn-offline">
            <header class="kaart-kop"><h2 class="kaart-titel">Offline</h2></header>
            <p class="kaart-meta" data-test="dagpakket-stand">{{ pakketStand }}</p>
            <p class="schakel-rij"><span>Foto's en opnames alleen via wifi versturen</span><Schakelaar :aan="bijl.alleenWifi.value" label="Foto's en opnames alleen via wifi versturen" @wissel="bijl.zetAlleenWifi($event)" /></p>
            <p v-if="bijl.wachtend.value" class="meta">{{ bijl.wachtend.value }} bijlagen wachten op verzending.</p>
            <button type="button" class="dd-act mt-8" :disabled="dp.bezig.value" data-test="dagpakket-ververs" @click="ververs"><Icoon naam="RefreshCw" />Ververs nu</button>
          </article>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.mi-kicker { display: block; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink); }
.mi-tekst { margin: 4px 0 16px; font-size: 13px; color: var(--ink-soft); max-width: 620px; }
.mi-raster { display: grid; grid-template-columns: 1fr; gap: 16px; }
@media (min-width: 640px) { .mi-raster { grid-template-columns: 1fr 1fr; } }
@media (min-width: 1000px) { .mi-raster { grid-template-columns: 1fr 1fr 1fr; } }
.mi-kaart { display: flex; flex-direction: column; gap: 6px; min-height: 44px; padding: 16px; background: var(--wit, #fff); border: 1px solid var(--border); border-left: 3px solid var(--yellow); color: var(--ink); text-decoration: none; transition: border-color var(--transition-fast); }
.mi-kaart:hover, .mi-kaart:focus-visible { border-color: var(--ink); border-left-color: var(--yellow); }
.mi-kaart-kop { display: flex; align-items: center; gap: 8px; }
.mi-kaart-titel { font-family: 'Source Serif 4', Georgia, serif; font-size: 17px; font-weight: 700; }
.mi-kaart-tekst { font-size: 13px; line-height: 1.55; color: var(--ink-soft); }
.mi-kaart-cta { display: inline-flex; align-items: center; gap: 4px; align-self: flex-start; margin-top: 4px; padding-bottom: 1px; border-bottom: 2px solid var(--yellow); font-size: 12px; font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase; }
.mi-secties { display: grid; grid-template-columns: 1fr; gap: var(--kaart-gap, 16px); align-items: start; }
@media (min-width: 1000px) { .mi-secties { grid-template-columns: 1fr 1fr; } }
.mi-secties :deep(.mi-sectie) { scroll-margin-top: 24px; min-width: 0; }
</style>
