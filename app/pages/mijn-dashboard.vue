<script setup lang="ts">
// Mijn dashboard in de opzet van DealDrive /rapportage: kop met Filters en de periodestrook, het
// pogingendoel met de normen (shared/team), het zwarte cijferblok, activiteiten per dag of week, de reis
// per fase, uitkomsten, prospectdekking, de weektabel en de vergelijking met je team (vanaf Gevorderd,
// zonder namen), en onderaan de afspraken uit je coachingsgesprek en "Wat kan ik deze week beter doen?"
// (Expert). Eén databron: GET /api/resultaten/dashboard. De periode staat in de URL.
import { DASHBOARD_PERIODE_OPTIES, EIGEN_PERIODE_LABEL } from '~~/shared/dashboard'

const toast = useToast()
const route = useRoute()
const router = useRouter()
const { toon: toonUitleg } = useNietAangezet()
const { functie } = useMe()
const query = computed(() => ({ periode: route.query.periode || undefined, van: route.query.van || undefined, tot: route.query.tot || undefined }))
const { data, refresh } = await useFetch<any>('/api/resultaten/dashboard', { query, default: () => null })
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

const SERIES = [
  { sleutel: 'bellen', label: 'Bellen', kleur: 'blauw' },
  { sleutel: 'mail', label: 'Mail', kleur: 'groen' },
  { sleutel: 'bezoek', label: 'Bezoek', kleur: 'geel' },
  { sleutel: 'linkedin', label: 'LinkedIn', kleur: 'paars' },
  { sleutel: 'bericht', label: 'Bericht', kleur: 'inkt' },
] as const
const reisRijen = computed(() => (data.value?.funnel?.fases ?? []).map((f: any) => ({ sleutel: f.faseId, label: f.label, aantal: f.aantal, waarde: f.conversie != null ? `${f.conversie}% door` : null, sub: [f.norm != null ? `norm ${f.norm}%` : null, f.faseId === 'afspraak-gepland' && gemPoging.value ? `gem. poging ${gemPoging.value}` : null].filter(Boolean).join(' · ') || null, kleur: f.hoofdfase === 'Vinden' ? 'inkt' : f.hoofdfase === 'Bewerken' ? 'geel' : 'groen', markeer: f.stok })))
const UIT_KLEUR: Record<string, string> = { afspraak: 'groen', gesproken: 'blauw', later: 'geel', nee: 'rood', geen: 'inkt', voicemail: 'inkt', verzonden: 'paars', fout: 'oranje', overig: 'inkt' }
const uitkomstRijen = computed(() => {
  const tot = (data.value?.uitkomsten ?? []).reduce((s: number, u: any) => s + u.aantal, 0)
  return (data.value?.uitkomsten ?? []).map((u: any) => ({ sleutel: u.sleutel, label: u.label, aantal: u.aantal, waarde: tot ? `${Math.round((u.aantal / tot) * 100)}%` : null, sub: u.sleutel === 'afspraak' && gemPoging.value ? `eerste gem. bij poging ${gemPoging.value}` : null, kleur: UIT_KLEUR[u.sleutel] ?? 'inkt' }))
})
const pogingPunten = computed(() => Object.entries(data.value?.funnel?.pogingen ?? {}).map(([k, n]) => ({ sleutel: k, label: k === 'later' ? '6+' : k, titel: k === 'later' ? 'Na poging 6 of later' : `Bij poging ${k}`, kern: true, totaal: Number(n), delen: { afspraken: Number(n) } })))
const pogingTotaal = computed(() => pogingPunten.value.reduce((s, p) => s + p.totaal, 0))

const reactie = reactive<Record<string, string>>({})
async function reageer(id: string) { try { await $fetch(`/api/coaching/notities/${id}`, { method: 'PUT', body: { reactie: reactie[id] } }); reactie[id] = ''; toast.toon('Reactie verstuurd.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') } }
const zelf = ref<any[] | null>(null)
const bezig = ref(false)
async function zelfanalyse() { bezig.value = true; try { zelf.value = (await $fetch<any>('/api/coaching/zelfanalyse', { method: 'POST' })).punten } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false } }
useHead({ title: 'Mijn dashboard · Dealtrace' })
// Funnel staat niet meer in de zijbalk; je opent hem hier. Weekreview en Weekstart open je via Dagstart.
const funnelAan = computed(() => !!functie('nav.funnel')?.beschikbaar)
const funnelLink = computed(() => `/funnel${data.value?.periode.sleutel === 'kwartaal' ? '?periode=kwartaal' : ''}`)
// Bij welke poging de eerste afspraak kwam (activiteiten en afgeronde taken), voor de blokken hieronder.
const eersteAfspraak = computed(() => data.value?.funnel?.eersteAfspraak ?? null)
const gemPoging = computed(() => (eersteAfspraak.value?.gemiddeld != null ? eersteAfspraak.value.gemiddeld.toLocaleString('nl-NL') : null))
</script>

<template>
  <div>
    <RapportKop v-model:open="filtersOpen" :kicker="`Mijn dashboard · ${data?.periode.label ?? 'Deze maand'}`" titel="Waar sta jij?" subtitel="Jouw pogingen, gesprekken, afspraken en reis over de gekozen periode. Activiteit telt op wat jij deed; prospects en dekking op wat jij in beheer hebt." :filter-aantal="filterAantal" helpartikel="je-cijfers-lezen">
      <template #acties>
        <NuxtLink to="/data-kwaliteit" class="dd-actie dd-actie--secundair" data-test="knop-data" title="Datakwaliteit"><Icoon naam="Database" class="dd-actie-icoon" />Data</NuxtLink>
        <NuxtLink v-if="funnelAan" :to="funnelLink" class="dd-actie dd-actie--secundair" data-test="knop-funnel"><Icoon naam="Filter" class="dd-actie-icoon" />Funnel</NuxtLink>
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
            <header class="md-blok-kop"><h3 class="md-blok-titel">Je reis per fase</h3><NuxtLink :to="`/funnel${data.periode.sleutel === 'kwartaal' ? '?periode=kwartaal' : ''}`" class="md-blok-link">Open funnel →</NuxtLink></header>
            <p class="md-blok-meta">{{ data.funnel.kop.titel }}</p>
            <BalkRijen v-if="data.funnel.aantalAccounts" :rijen="reisRijen" label="Accounts per reisfase" />
            <p v-else class="md-leeg">Nog geen accounts in deze periode.</p>
            <EersteAfspraakPoging v-if="eersteAfspraak" class="md-eap" :data="eersteAfspraak" data-test="reis-eerste-afspraak" />
            <p v-if="data.funnel.kop.stok" class="md-voet">{{ data.funnel.kop.stok }}</p>
          </div>
          <div class="md-blok" data-test="grafiek-uitkomsten">
            <header class="md-blok-kop"><h3 class="md-blok-titel">Waar je pogingen op uitliepen</h3></header>
            <p class="md-blok-meta">{{ data.periode.label }} · {{ data.kpi.pogingen }} pogingen</p>
            <BalkRijen v-if="uitkomstRijen.length" :rijen="uitkomstRijen" label="Uitkomsten van je pogingen" />
            <p v-else class="md-leeg">Nog geen pogingen met een uitkomst.</p>
            <EersteAfspraakPoging v-if="eersteAfspraak" class="md-eap" vorm="regel" :data="eersteAfspraak" data-test="uitkomsten-eerste-afspraak" />
          </div>
        </div>
      </section>

      <section class="section">
        <div class="container md-stapel">
          <div class="md-blok" data-test="grafiek-dekking">
            <header class="md-blok-kop"><h3 class="md-blok-titel">Prospectdekking</h3><span v-if="data.prospects.dekking" class="md-blok-meta">{{ data.prospects.dekking.actief }} actieve prospects · momentopname</span></header>
            <template v-if="data.prospects.dekking">
              <DekkingRaster v-bind="data.prospects.dekking" />
              <p class="md-voet">Laatste contact per actieve prospect (nieuw, gescoord of in reis).<template v-if="data.prospects.dekking.zonderContact"> <strong>{{ data.prospects.dekking.zonderContact }}</strong> {{ data.prospects.dekking.zonderContact === 1 ? 'prospect heeft' : 'prospects hebben' }} nog geen contactmoment: kandidaten voor je volgende belblok.</template></p>
              <p v-if="eersteAfspraak?.accounts" class="md-voet" data-test="dekking-eerste-afspraak">Je eerste afspraak kwam gemiddeld bij poging <strong>{{ gemPoging }}</strong>: {{ eersteAfspraak.verdeling['1'] }} bij poging 1, {{ eersteAfspraak.verdeling['2'] }} bij poging 2, {{ eersteAfspraak.verdeling['3'] }} bij poging 3 en {{ eersteAfspraak.verdeling['4+'] }} bij poging 4 of later.</p>
            </template>
            <button v-else type="button" class="dd-act knop-slot" data-test="dekking-slot" @click="toonUitleg('funnel.filters')"><Icoon naam="Lock" :grootte="14" /> Prospectdekking komt vanaf Gevorderd</button>
          </div>

          <StaafGrafiek v-if="data.funnel?.pogingen" titel="Bij welke poging de eerste afspraak kwam" :meta="`${pogingTotaal} ${pogingTotaal === 1 ? 'afspraak' : 'afspraken'} · norm 4 tot 5 pogingen`" :punten="pogingPunten" :series="[{ sleutel: 'afspraken', label: 'Eerste afspraken', kleur: 'geel' }]" :hoogte="140" leeg="Nog geen eerste afspraken in deze periode." data-test="grafiek-pogingen" />

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
          <p v-if="!data.kan.trend" class="kaart kaart--vlak" data-test="trend-uit"><span class="kicker">Nog niet aangezet</span><br>De weektabel en de vergelijking met je team horen bij Gevorderd.</p>
        </div>
      </section>

      <section class="section section--alt">
        <div class="container md-duo">
          <article class="kaart" data-test="mijn-afspraken">
            <h2 class="kaart-titel">Afspraken uit je coachingsgesprek</h2>
            <p v-if="!data.afspraken.length && !data.punten.length" class="kaart-meta">Nog geen afspraken.</p>
            <ul class="schakel-lijst">
              <li v-for="p in data.punten" :key="p.tekst" class="schakel-rij"><span><strong>Coachingpunt</strong>: {{ p.tekst }}<br><span class="meta">{{ (p.onderbouwing?.cijfers ?? []).join(' · ') }}<template v-if="p.artikelSleutel"> · <NuxtLink :to="`/helpcenter/${p.artikelSleutel}`">artikel</NuxtLink></template></span></span></li>
              <li v-for="a in data.afspraken" :key="a.id" class="schakel-rij md-afspraak"><span>{{ a.tekst }}<br><span class="meta">{{ a.termijn ? `Termijn ${a.termijn}` : '' }} · {{ a.status === 'open' ? 'Open' : a.status === 'gehaald' ? 'Gehaald' : 'Niet gehaald' }}<template v-if="a.reactie"> · Je reageerde: {{ a.reactie.tekst }}</template></span></span>
                <form class="md-reageer" @submit.prevent="reageer(a.id)"><input v-model="reactie[a.id]" class="invoer invoer--klein" placeholder="Hoe gaat het?" :aria-label="`Reactie op ${a.tekst}`"><button type="submit" class="dd-act" :disabled="!reactie[a.id]?.trim()">Reageer</button></form></li>
            </ul>
          </article>

          <article v-if="data.kan.trend || data.kan.zelfanalyse" class="md-ai" data-test="zelfanalyse">
            <span class="md-ai-kicker">Coach · deze week</span>
            <h2 class="md-ai-titel">Wat kan ik deze week beter doen?</h2>
            <template v-if="data.kan.zelfanalyse">
              <p class="md-ai-tekst">De Coach kijkt naar je cijfers van deze periode en geeft hoogstens drie punten, elk met cijfers en een artikel. Kost 20 credits.</p>
              <button type="button" class="dd-actie dd-actie--primair md-ai-knop" :disabled="bezig" data-test="zelfanalyse-knop" @click="zelfanalyse"><Icoon naam="Sparkles" class="dd-actie-icoon" />Vraag de Coach</button>
              <ol v-if="zelf" class="md-ai-lijst">
                <li v-for="(p, i) in zelf" :key="p.tekst" class="md-ai-tip"><span class="md-ai-num tnum">{{ i + 1 }}</span><span>{{ p.tekst }}<br><span class="md-ai-meta">{{ p.onderbouwing.cijfers.join(' · ') }} · <NuxtLink :to="`/helpcenter/${p.artikelSleutel}`">artikel</NuxtLink></span></span></li>
              </ol>
            </template>
            <button v-else type="button" class="dd-act knop-slot md-ai-slot" data-test="zelfanalyse-slot" @click="toonUitleg('resultaten.zelfanalyse')"><Icoon naam="Lock" :grootte="14" /> Vraag de Coach</button>
          </article>
        </div>
      </section>
    </template>
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

.md-afspraak { flex-wrap: wrap; gap: 8px; }
.md-reageer { display: flex; gap: 8px; }

.md-ai { display: flex; flex-direction: column; gap: 12px; padding: var(--kaart-padding); background: var(--ink); color: var(--wit); border-radius: var(--radius); }
.md-ai-kicker { font-size: var(--fs-label); font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--yellow); }
.md-ai-titel { margin: 0; font-family: var(--font-serif); font-size: 20px; font-weight: 700; color: var(--wit); }
.md-ai-tekst { margin: 0; font-size: 13px; line-height: 1.5; color: rgba(255, 255, 255, 0.78); }
.md-ai-knop { align-self: flex-start; }
.md-ai-slot { align-self: flex-start; background: var(--wit); }
.md-ai-lijst { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.md-ai-tip { display: flex; gap: 14px; padding: 14px 16px; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.14); border-radius: var(--radius); font-size: 13px; line-height: 1.5; }
.md-ai-tip a { color: var(--yellow); }
.md-ai-num { flex: 0 0 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; background: var(--yellow); color: var(--ink); font-weight: 800; border-radius: 2px; }
.md-ai-meta { font-size: 12px; color: rgba(255, 255, 255, 0.66); }
@media (max-width: 720px) {
  .md-blok { padding: 16px; }
  .md-reageer { width: 100%; }
  .md-reageer .invoer { flex: 1; min-width: 0; }
}
</style>
