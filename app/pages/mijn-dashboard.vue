<script setup lang="ts">
// Mijn dashboard in de opzet van DealDrive /rapportage: kop met Filters en de periodestrook, het
// pogingendoel met de normen (shared/team), het zwarte cijferblok, activiteiten per dag of week, de reis
// per fase, uitkomsten, prospectdekking, status prospect (koud tot heet), de weektabel en de vergelijking
// met je team (vanaf Gevorderd, zonder namen). Balken, cellen en getallen in reis, uitkomsten, dekking en
// status openen de prospects of pogingen erachter in een venster (DashboardLijstFlyout, zoals /funnel).
// Eén databron: GET /api/resultaten/dashboard. De periode staat in de URL.
import { DASHBOARD_PERIODE_OPTIES, EIGEN_PERIODE_LABEL, KANAAL_ALLEEN_GEVULD, KANAAL_LABEL } from '~~/shared/dashboard'

const route = useRoute()
const router = useRouter()
const { functie } = useMe()
const query = computed(() => ({ periode: route.query.periode || undefined, van: route.query.van || undefined, tot: route.query.tot || undefined }))
const { data } = await useFetch<any>('/api/resultaten/dashboard', { query, default: () => null })
const filtersOpen = ref(false)
const filterAantal = computed(() => (data.value && data.value.periode.sleutel !== 'maand' ? 1 : 0))
function zet(q: Record<string, string | undefined>) { router.replace({ query: { ...route.query, ...q } }) }
function kiesPeriode(id: string) {
  if (id === 'eigen') { const p = data.value?.periode; zet({ periode: 'eigen', van: (route.query.van as string) || p?.van, tot: (route.query.tot as string) || p?.tot }); return }
  zet({ periode: id === 'maand' ? undefined : id, van: undefined, tot: undefined })
}
const vandaag = computed(() => data.value?.periode?.tot as string | undefined)

const nl = (n: number | null | undefined) => (n == null ? '-' : n.toLocaleString('nl-NL'))
const pctTekst = (m: { procent: number; noemer: number }) => (m.noemer ? `${m.procent}%` : '-')
const t = computed(() => data.value?.tegels)
const KLEUR: Record<string, string> = { inReis: 'groen', nieuw: 'geel', wacht: 'grijs', over: 'blauw' }
const deel = (n: number) => (data.value?.prospects.totaal ? Math.round((n / data.value.prospects.totaal) * 100) : 0)
const kort = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: 'UTC' })

// Activiteiten per dag: WhatsApp en SMS staan los. Bezoek (een afgerond bezoek als contactpoging) en Overig
// (bijvoorbeeld een kaart) staan alleen in de legenda als er in de periode iets in zit.
const ALLE_SERIES = [
  { sleutel: 'bellen', label: KANAAL_LABEL.bellen, kleur: 'blauw' },
  { sleutel: 'mail', label: KANAAL_LABEL.mail, kleur: 'groen' },
  { sleutel: 'linkedin', label: KANAAL_LABEL.linkedin, kleur: 'paars' },
  { sleutel: 'whatsapp', label: KANAAL_LABEL.whatsapp, kleur: 'oranje' },
  { sleutel: 'sms', label: KANAAL_LABEL.sms, kleur: 'inkt' },
  { sleutel: 'bezoek', label: KANAAL_LABEL.bezoek, kleur: 'geel' },
  { sleutel: 'overig', label: KANAAL_LABEL.overig, kleur: 'grijs' },
] as const
const SERIES = computed(() => ALLE_SERIES.filter((s) => !KANAAL_ALLEEN_GEVULD.includes(s.sleutel) || (data.value?.activiteit?.punten ?? []).some((p: any) => p.delen?.[s.sleutel])))
const reisRijen = computed(() => (data.value?.funnel?.fases ?? []).map((f: any) => ({ sleutel: f.faseId, label: f.label, aantal: f.aantal, waarde: f.conversie != null ? `${f.conversie}% door` : null, sub: [f.norm != null ? `norm ${f.norm}%` : null, f.faseId === 'afspraak-gepland' && gemPoging.value ? `gem. poging ${gemPoging.value}` : null].filter(Boolean).join(' · ') || null, kleur: f.hoofdfase === 'Vinden' ? 'inkt' : f.hoofdfase === 'Bewerken' ? 'geel' : 'groen', markeer: f.stok, test: `reis-${f.faseId}` })))
const UIT_KLEUR: Record<string, string> = { afspraak: 'groen', gesproken: 'blauw', later: 'geel', nee: 'rood', geen: 'inkt', voicemail: 'inkt', verzonden: 'paars', fout: 'oranje', overig: 'inkt' }
const uitkomstRijen = computed(() => {
  const tot = (data.value?.uitkomsten ?? []).reduce((s: number, u: any) => s + u.aantal, 0)
  return (data.value?.uitkomsten ?? []).map((u: any) => ({ sleutel: u.sleutel, label: u.label, aantal: u.aantal, waarde: tot ? `${Math.round((u.aantal / tot) * 100)}%` : null, sub: u.sleutel === 'afspraak' && gemPoging.value ? `eerste gem. bij poging ${gemPoging.value}` : null, kleur: UIT_KLEUR[u.sleutel] ?? 'inkt', test: `uitkomst-${u.sleutel}` }))
})

// Het venster achter een balk, cel of getal: blok en sleutel, met de periode van het dashboard.
const lijst = ref<{ blok: string; sleutel: string } | null>(null)
function kies(blok: string, sleutel: string) { lijst.value = { blok, sleutel } }
const lijstPeriode = computed(() => ({ periode: (route.query.periode as string) || undefined, van: (route.query.van as string) || undefined, tot: (route.query.tot as string) || undefined }))
// Bij welke poging de eerste afspraak kwam staat in het venster van de afspraakfases en van de uitkomst Afspraak.
const toonEersteAfspraak = computed(() => !!eersteAfspraak.value && !!lijst.value && ((lijst.value.blok === 'reis' && ['afspraak-gepland', 'afspraak-gehouden'].includes(lijst.value.sleutel)) || (lijst.value.blok === 'uitkomst' && lijst.value.sleutel === 'afspraak')))
useHead({ title: 'Mijn dashboard · Dealtrace' })
// Funnel staat niet meer in de zijbalk; je opent hem hier. Weekreview en Weekstart open je via Dagstart.
const funnelAan = computed(() => !!functie('nav.funnel')?.beschikbaar)
const funnelLink = computed(() => `/funnel${data.value?.periode.sleutel === 'kwartaal' ? '?periode=kwartaal' : ''}`)
// Bij welke poging de eerste afspraak kwam (activiteiten en afgeronde taken): alleen in het venster (testronde 2), niet meer als regel in de blokken.
const eersteAfspraak = computed(() => data.value?.funnel?.eersteAfspraak ?? null)
const gemPoging = computed(() => (eersteAfspraak.value?.gemiddeld != null ? eersteAfspraak.value.gemiddeld.toLocaleString('nl-NL') : null))
</script>

<template>
  <div>
    <RapportKop v-model:open="filtersOpen" :kicker="`Mijn dashboard · ${data?.periode.label ?? 'Deze maand'}`" titel="Waar sta jij?" subtitel="Jouw pogingen, gesprekken, afspraken en reis over de gekozen periode. Activiteit telt op wat jij deed; prospects en dekking op wat jij in beheer hebt." :filter-aantal="filterAantal" helpartikel="je-cijfers-lezen">
      <template #acties>
        <FunctieLink to="/data-kwaliteit" class="dd-actie dd-actie--secundair" data-test="knop-data" title="Datakwaliteit"><Icoon naam="Database" class="dd-actie-icoon" />Data</FunctieLink>
        <FunctieLink v-if="funnelAan" :to="funnelLink" class="dd-actie dd-actie--secundair" data-test="knop-funnel"><Icoon naam="Filter" class="dd-actie-icoon" />Funnel</FunctieLink>
      </template>
    </RapportKop>
    <RapportPeriode v-if="filtersOpen && data" :opties="DASHBOARD_PERIODE_OPTIES" :waarde="data.periode.sleutel" :van="data.periode.van" :tot="data.periode.tot" :vandaag="vandaag" :eigen-label="EIGEN_PERIODE_LABEL" :reset="data.periode.sleutel !== 'maand'" @kies="kiesPeriode" @datum="(van, tot) => zet({ periode: 'eigen', van, tot })" @reset="kiesPeriode('maand')" />

    <template v-if="data">
      <section class="section">
        <div class="container">
          <DoelBlok :kicker="`Pogingendoel · jij · ${data.periode.label}`" titel="Waar sta je tegenover je doel?" :doel="data.doel" :normen="data.normen" />
        </div>
      </section>

      <section class="section" data-test="mijn-cijfers">
        <div class="container">
          <RapportCijfers :kicker="`Jouw resultaten · ${data.periode.label}`" :titel="data.titel" :duiding="data.duiding" :link="data.kan.funnel ? { naar: '/funnel', tekst: 'Funnel →' } : null">
            <RapportTegel breed label="Prospects" :waarde="nl(data.prospects.totaal)" :hint="data.prospects.dekking ? `Prospectdekking ${data.prospects.dekking.procent}%: ${data.prospects.dekking.recent} van ${data.prospects.dekking.actief} actieve prospects gesproken in 30 dagen` : null" data-test="tegel-prospects">
              <span class="md-balk" role="img" :aria-label="data.prospects.delen.map((d: any) => `${d.aantal} ${d.label}`).join(', ')">
                <span v-for="d in data.prospects.delen" :key="d.sleutel" class="md-vul" :class="`md-vul--${KLEUR[d.sleutel]}`" :style="{ width: `${deel(d.aantal)}%` }" />
              </span>
              <span class="md-legenda"><span v-for="d in data.prospects.delen" :key="d.sleutel"><span class="md-stip" :class="`md-vul--${KLEUR[d.sleutel]}`" />{{ d.aantal }} {{ d.label }}</span></span>
            </RapportTegel>
            <RapportTegel label="Pogingen" :waarde="nl(t.pogingen.aantal)" :hint="`${nl(t.pogingen.perDag)} per werkdag${t.pogingen.team != null ? ` · team ${nl(t.pogingen.team)}` : ''}`" :delta="t.pogingen.delta" data-test="tegel-pogingen" />
            <RapportTegel label="Gesprekken" :waarde="nl(t.gesprekken.aantal)" :hint="t.gesprekken.team != null ? `team gemiddeld ${nl(t.gesprekken.team)}` : 'echt gesproken, zonder voicemail'" :delta="t.gesprekken.delta" data-test="tegel-gesprekken" />
            <RapportTegel label="Afspraken gemaakt" :waarde="nl(t.afspraken.aantal)" :hint="t.afspraken.team != null ? `team gemiddeld ${nl(t.afspraken.team)}` : `uit ${t.gesprekken.aantal} gesprekken`" :delta="t.afspraken.delta" data-test="tegel-afspraken" />
            <RapportTegel label="Gesprek naar afspraak" :waarde="pctTekst(t.conversie)" :hint="`norm 15%${t.conversie.team != null ? ` · team ${t.conversie.team}%` : ''}`" data-test="tegel-conversie" />
            <RapportTegel label="Bereik" :waarde="nl(t.bereik.accounts)" hint="accounts benaderd" :delta="t.bereik.delta" data-test="tegel-bereik" />
            <RapportTegel label="Pogingen per account" :waarde="nl(t.bereik.pogingenPerAccount)" hint="norm 4 tot 5 voor je stopt" data-test="tegel-per-account" />
            <RapportTegel label="Beslisser bereikt" :waarde="pctTekst(t.beslisser)" :hint="`norm 20%${t.beslisser.team != null ? ` · team ${t.beslisser.team}%` : ''}`" data-test="tegel-beslisser" />
            <RapportTegel label="Afspraken gehouden" :waarde="nl(t.gehouden.aantal)" hint="afgerond met verslag of uitkomst" :delta="t.gehouden.delta" data-test="tegel-gehouden" />
            <RapportTegel label="Overdrachten" :waarde="nl(t.overdrachten.aantal)" hint="naar DealDrive, CRM of collega" :delta="t.overdrachten.delta" data-test="tegel-overdrachten" />
            <RapportTegel label="Belblokken" :waarde="`${t.belblokken.gehouden} / ${t.belblokken.gepland}`" hint="gehouden van gepland" data-test="tegel-belblokken" />
            <RapportTegel label="Inzichten" :waarde="nl(t.inzichten.aantal)" :hint="`${t.inzichten.open} nog niet behandeld`" :delta="t.inzichten.delta" data-test="tegel-inzichten" />
            <RapportTegel label="Afgeronde taken" :waarde="nl(t.taken.klaar)" :hint="`${t.taken.open} open · ${t.taken.verlopen} verlopen`" :delta="t.taken.delta" data-test="tegel-taken" />
            <RapportTegel label="Taken op de dag" :waarde="t.takenOpDag.noemer ? `${Math.round(t.takenOpDag.waarde * 100)}%` : '-'" :hint="`van ${t.takenOpDag.noemer} taken met een datum`" data-test="tegel-op-dag" />
            <RapportTegel label="Tempo" :waarde="data.tempo.stand === 'geen' ? '-' : `${data.tempo.procent}%`" :hint="data.tempo.stand === 'op schema' ? 'op schema tegen de norm' : data.tempo.stand === 'achter' ? 'achter op de norm' : 'geen werkdagen'" data-test="tegel-tempo" />
          </RapportCijfers>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <StaafGrafiek :titel="`Activiteiten per ${data.activiteit.per}`" :meta="`${data.periode.label} · ${data.activiteit.totaal} ${data.activiteit.totaal === 1 ? 'poging' : 'pogingen'}`" :punten="data.activiteit.punten" :series="[...SERIES]" leeg="Nog geen contactpogingen in deze periode." data-test="grafiek-activiteit" />
        </div>
      </section>

      <section class="section section--alt">
        <div class="container md-duo">
          <div v-if="data.kan.funnel && data.funnel" class="md-blok" data-test="grafiek-reis">
            <header class="md-blok-kop"><h3 class="md-blok-titel">Je reis per fase</h3><FunctieLink :to="`/funnel${data.periode.sleutel === 'kwartaal' ? '?periode=kwartaal' : ''}`" class="md-blok-link">Open funnel →</FunctieLink></header>
            <p class="md-blok-meta">{{ data.funnel.kop.titel }}</p>
            <BalkRijen v-if="data.funnel.aantalAccounts" :rijen="reisRijen" klikbaar label="Accounts per reisfase" @kies="(r) => kies('reis', r.sleutel)" />
            <p v-else class="md-leeg">Nog geen accounts in deze periode.</p>
            <p v-if="data.funnel.kop.stok" class="md-voet">{{ data.funnel.kop.stok }}</p>
          </div>
          <div class="md-blok" data-test="grafiek-uitkomsten">
            <header class="md-blok-kop"><h3 class="md-blok-titel">Waar je pogingen op uitliepen</h3></header>
            <p class="md-blok-meta">{{ data.periode.label }} · {{ data.kpi.pogingen }} pogingen</p>
            <BalkRijen v-if="uitkomstRijen.length" :rijen="uitkomstRijen" klikbaar label="Uitkomsten van je pogingen" @kies="(r) => kies('uitkomst', r.sleutel)" />
            <p v-else class="md-leeg">Nog geen pogingen met een uitkomst.</p>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="container md-stapel">
          <div class="md-blok" data-test="grafiek-dekking">
            <header class="md-blok-kop"><h3 class="md-blok-titel">Prospectdekking</h3><span v-if="data.prospects.dekking" class="md-blok-meta">{{ data.prospects.dekking.actief }} actieve prospects · momentopname</span></header>
            <template v-if="data.prospects.dekking">
              <DekkingRaster v-bind="data.prospects.dekking" klikbaar @kies="(s) => kies('dekking', s)" />
              <p class="md-voet">Laatste contact per actieve prospect (nieuw, gescoord of in reis).<template v-if="data.prospects.dekking.zonderContact"> <strong>{{ data.prospects.dekking.zonderContact }}</strong> {{ data.prospects.dekking.zonderContact === 1 ? 'prospect heeft' : 'prospects hebben' }} nog geen contactmoment: kandidaten voor je volgende belblok.</template></p>
            </template>
          </div>

          <div v-if="data.statusProspects" class="md-blok" data-test="grafiek-status">
            <header class="md-blok-kop"><h3 class="md-blok-titel">Status prospect</h3><span class="md-blok-meta">{{ data.statusProspects.totaal }} prospects · momentopname</span></header>
            <StatusKolommen v-bind="data.statusProspects" @kies="(s) => kies('status', s)" />
            <p class="md-voet">De status kies je zelf in Info op de accountkaart: koud, lauw, warm of heet. Klik op een kolom voor de prospects.</p>
          </div>

          <div v-if="data.weken" class="md-blok" data-test="mijn-trend">
            <header class="md-blok-kop"><h3 class="md-blok-titel">Per week</h3><span class="md-blok-meta">{{ data.periode.label }}</span></header>
            <div class="md-tabelvak">
              <table class="md-tabel">
                <thead><tr><th scope="col">Week</th><th scope="col" class="md-r">Pogingen</th><th scope="col" class="md-r">Gesprekken</th><th scope="col" class="md-r">Beslisser</th><th scope="col" class="md-r">Afspraken</th><th scope="col" class="md-r">Gesprek naar afspraak</th></tr></thead>
                <tbody>
                  <tr v-for="w in data.weken" :key="w.van"><th scope="row">{{ kort(w.van) }} t/m {{ kort(w.tot) }}</th><td class="md-r tnum">{{ w.pogingen }}</td><td class="md-r tnum">{{ w.gesprekken }}</td><td class="md-r tnum">{{ w.beslisser }}</td><td class="md-r tnum">{{ w.afspraken }}</td><td class="md-r tnum">{{ w.conversie.noemer ? `${Math.round(w.conversie.waarde * 100)}%` : '-' }}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div v-if="data.team" class="md-blok" data-test="mijn-team">
            <header class="md-blok-kop"><h3 class="md-blok-titel">Jij tegenover je team</h3><span class="md-blok-meta">gemiddelde van {{ data.team.personen }} {{ data.team.personen === 1 ? 'persoon' : 'personen' }}, zonder namen</span></header>
            <div class="md-tabelvak">
              <table class="md-tabel">
                <thead><tr><th scope="col">Cijfer</th><th scope="col" class="md-r">Jij</th><th scope="col" class="md-r">Team gemiddeld</th></tr></thead>
                <tbody>
                  <tr><th scope="row">Pogingen</th><td class="md-r tnum">{{ data.kpi.pogingen }}</td><td class="md-r tnum">{{ nl(data.team.pogingen) }}</td></tr>
                  <tr><th scope="row">Gesprekken</th><td class="md-r tnum">{{ data.kpi.gesprekken }}</td><td class="md-r tnum">{{ nl(data.team.gesprekken) }}</td></tr>
                  <tr><th scope="row">Afspraken</th><td class="md-r tnum">{{ data.kpi.afspraken }}</td><td class="md-r tnum">{{ nl(data.team.afspraken) }}</td></tr>
                  <tr><th scope="row">Gesprek naar afspraak</th><td class="md-r tnum">{{ pctTekst(t.conversie) }}</td><td class="md-r tnum">{{ Math.round(data.team.gesprekNaarAfspraak * 100) }}%</td></tr>
                  <tr><th scope="row">Beslisser bereikt</th><td class="md-r tnum">{{ pctTekst(t.beslisser) }}</td><td class="md-r tnum">{{ Math.round(data.team.beslisserBereikt * 100) }}%</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

    </template>
    <DashboardLijstFlyout :keuze="lijst" :periode="lijstPeriode" @sluit="lijst = null">
      <template v-if="toonEersteAfspraak" #boven><EersteAfspraakPoging :data="eersteAfspraak" vorm="regel" data-test="lijst-eerste-afspraak" /></template>
    </DashboardLijstFlyout>
  </div>
</template>

<style scoped>
.md-balk { display: flex; height: 8px; margin-top: 6px; overflow: hidden; background: rgba(255, 255, 255, 0.10); border-radius: 2px; }
.md-vul { height: 100%; }
.md-vul--groen { background: var(--green); }
.md-vul--geel { background: var(--yellow); }
.md-vul--grijs { background: var(--muted-light, var(--muted)); }
.md-vul--blauw { background: var(--blue); }
.md-legenda { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 11px; font-weight: 600; color: rgba(255, 255, 255, 0.78); }
.md-stip { display: inline-block; width: 8px; height: 8px; margin-right: 4px; border-radius: 2px; vertical-align: middle; }

.md-duo { display: grid; grid-template-columns: 1fr; gap: 16px; }
@media (min-width: 900px) { .md-duo { grid-template-columns: 1.2fr 1fr; gap: 24px; } }
.md-stapel { display: flex; flex-direction: column; gap: 16px; }
.md-blok { background: var(--wit); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--kaart-padding); min-width: 0; }
.md-blok-kop { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
.md-blok-titel { margin: 0; font-family: var(--font-serif); font-size: 18px; font-weight: 700; color: var(--ink); }
.md-blok-link { display: inline-flex; align-items: center; min-height: var(--touch-target-min); font-size: 12px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink); text-decoration: none; border-bottom: 2px solid var(--yellow); }
.md-blok-meta { margin: 0 0 16px; font-size: 12px; color: var(--muted); }
.md-blok-kop .md-blok-meta { margin: 0; }
.md-leeg { margin: 0; font-size: 13px; color: var(--muted); }
.md-voet { margin: 14px 0 0; font-size: 12px; line-height: 1.55; color: var(--muted); }
.md-voet strong { color: var(--ink); }
.md-eap { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--border); }

.md-tabelvak { overflow-x: auto; }
.md-tabel { width: 100%; border-collapse: collapse; font-size: 13px; }
.md-tabel th, .md-tabel td { padding: 10px 8px; border-bottom: 1px solid var(--border); text-align: left; white-space: nowrap; }
.md-tabel thead th { font-size: var(--fs-label); font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.md-tabel tbody th { font-weight: 600; color: var(--ink); }
.md-r { text-align: right !important; }


@media (max-width: 720px) {
  .md-blok { padding: 16px; }
}
</style>
