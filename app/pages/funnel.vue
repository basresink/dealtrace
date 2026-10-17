<script setup lang="ts">
// Funnel van de prospectreis (F17) in de opzet van DealDrive /rapportage: kop als zin met het stokpunt,
// Filters met de periodestrook (en vanaf Gevorderd doelgroep, reis en campagne, voor de salesmanager
// persoon of team), het zwarte cijferblok, de conversie per fase gegroepeerd in Vinden, Bewerken en
// Verbinden (met bij welke poging de eerste afspraak kwam), doorlooptijden tegen de norm, uitval per reden,
// pogingen tot afspraak en een tabel met alle
// cijfers. Klik op een fase of reden voor de lijst als schuifvenster. Filters in de URL.
import { EIGEN_PERIODE_LABEL } from '~~/shared/dashboard'

const { functie } = useMe()
const aan = !!functie('funnel.eigen')?.beschikbaar
const { toon: toonUitleg } = useNietAangezet()
const route = useRoute()
const router = useRouter()
const query = computed(() => Object.fromEntries(Object.entries(route.query).filter(([, v]) => typeof v === 'string' && v)))
const { data, error } = await useFetch<any>('/api/funnel', { query, immediate: aan, default: () => ({ fases: [], kop: {}, kan: {}, tegels: null }) })
const { data: ctx } = await useFetch<any>('/api/campagnes/context', { immediate: aan, default: () => ({ doelgroepen: [], verkopers: [] }) })
const { data: reizen } = await useFetch<any>('/api/reizen', { immediate: aan && !!functie('reis.overzicht')?.beschikbaar, default: () => ({ reizen: [] }) })
const { data: campagnes } = await useFetch<any>('/api/campagnes', { query: { eigenaar: 'alle' }, immediate: aan, default: () => ({ campagnes: [] }) })
function zet(k: string, v: string) { router.replace({ query: { ...route.query, [k]: v || undefined } }) }
function zetMeer(q: Record<string, string | undefined>) { router.replace({ query: { ...route.query, ...q } }) }

const filtersOpen = ref(false)
const PERIODES = [{ id: 'maand', label: 'Deze maand' }, { id: 'kwartaal', label: 'Dit kwartaal' }, { id: 'verkoopjaar', label: 'Dit verkoopjaar' }]
const periode = computed(() => (route.query.periode as string) || 'maand')
function kiesPeriode(id: string) {
  if (id === 'eigen') { zetMeer({ periode: 'eigen', van: (route.query.van as string) || data.value?.van, tot: (route.query.tot as string) || data.value?.tot }); return }
  zetMeer({ periode: id === 'maand' ? undefined : id, van: undefined, tot: undefined })
}
const wie = computed(() => (route.query.gebruiker as string) || (route.query.scope === 'team' ? 'team' : ''))
function kiesWie(v: string) { zetMeer({ gebruiker: v && v !== 'team' ? v : undefined, scope: v === 'team' ? 'team' : undefined }) }
const filterAantal = computed(() => ['doelgroep', 'reis', 'campagne', 'reis2'].filter((k) => route.query[k]).length + (periode.value !== 'maand' ? 1 : 0) + (wie.value ? 1 : 0))
function resetFilters() { router.replace({ query: {} }) }
const vandaag = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })

const GROEPEN = ['Vinden', 'Bewerken', 'Verbinden'] as const
const GROEP_KLEUR: Record<string, 'inkt' | 'geel' | 'groen'> = { Vinden: 'inkt', Bewerken: 'geel', Verbinden: 'groen' }
const max = computed(() => Math.max(1, ...data.value.fases.map((f: any) => f.aantal), ...(data.value.vergelijk?.fases ?? []).map((f: any) => f.aantal)))
const rijenVoor = (fases: any[], g: string) => fases.filter((x: any) => x.hoofdfase === g).map((f: any) => ({ sleutel: f.faseId, label: f.label, aantal: f.aantal, test: `fase-${f.faseId}`, kleur: GROEP_KLEUR[g], markeer: f.stok, waarde: f.conversie != null ? `${f.conversie}% door` : f.conversie === null ? 'eindfase' : null, sub: f.norm?.conversie != null ? `norm ${f.norm.conversie}%` : f.extra ?? null }))
const heeftDetails = computed(() => data.value.fases.some((f: any) => f.conversie !== undefined))
const hoofdTelling = computed(() => GROEPEN.map((g) => ({ g, n: data.value.fases.filter((f: any) => f.hoofdfase === g).reduce((s: number, f: any) => Math.max(s, f.aantal), 0) })))
const groepPct = (n: number) => { const som = hoofdTelling.value.reduce((s, h) => s + h.n, 0); return som ? Math.round((n / som) * 100) : 0 }
const doorloopRijen = computed(() => data.value.fases.filter((f: any) => f.doorlooptijd != null || f.norm?.doorlooptijd != null).map((f: any) => {
  const norm = f.norm?.doorlooptijd ?? null
  const top = Math.max(1, ...data.value.fases.map((x: any) => Math.max(x.doorlooptijd ?? 0, x.norm?.doorlooptijd ?? 0)))
  return { sleutel: f.faseId, label: f.label, aantal: f.doorlooptijd ?? 0, waarde: f.doorlooptijd != null ? `${f.doorlooptijd.toLocaleString('nl-NL')} dagen` : 'nog niemand door', sub: norm != null ? `norm ${norm} dagen` : null, kleur: (norm != null && f.doorlooptijd != null && f.doorlooptijd > norm ? 'rood' : 'groen') as 'rood' | 'groen', lijn: norm != null ? Math.round((norm / top) * 100) : null }
}))
const doorloopMax = computed(() => Math.max(1, ...data.value.fases.map((x: any) => Math.max(x.doorlooptijd ?? 0, x.norm?.doorlooptijd ?? 0))))
const uitvalRijen = computed(() => (data.value.uitvalTotaal ?? []).map((u: any) => ({ sleutel: u.reden, label: u.reden, aantal: u.aantal, waarde: data.value.tegels?.uitval ? `${Math.round((u.aantal / data.value.tegels.uitval) * 100)}%` : null, sub: u.fase ? `meest bij ${u.fase}` : null, kleur: 'rood' as const })))
const pogingPunten = computed(() => Object.entries(data.value.pogingen ?? {}).map(([k, n]) => ({ sleutel: k, label: k === 'later' ? '6+' : k, titel: k === 'later' ? 'Na poging 6 of later' : `Bij poging ${k}`, kern: true, totaal: Number(n), delen: { afspraken: Number(n) } })))
const pogingTotaal = computed(() => pogingPunten.value.reduce((s, p) => s + p.totaal, 0))

// Lijst achter een fase of reden, als schuifvenster.
const lijst = ref<{ fase: string; reden: string | null; titel: string } | null>(null)
const { data: accounts, execute: laadLijst, pending: laadt } = useFetch<any>('/api/funnel/accounts', { query: computed(() => ({ ...query.value, fase: lijst.value?.fase, reden: lijst.value?.reden ?? undefined })), immediate: false, watch: false, default: () => ({ accounts: [] }) })
function open(f: any, reden: string | null = null) { if (!f) return; lijst.value = { fase: f.faseId, reden, titel: reden ? `${f.label}: ${reden}` : f.label }; laadLijst() }
const openFase = (id: string, reden: string | null = null) => open(data.value.fases.find((f: any) => f.faseId === id), reden)
function openReden(reden: string) { const f = data.value.fases.find((x: any) => (x.uitval ?? []).some((u: any) => u.reden === reden)); open(f, reden) }
const nieuweTaak = ref<{ id: string; naam: string } | null>(null)
const csv = computed(() => `/api/funnel/export?${new URLSearchParams(query.value as Record<string, string>).toString()}`)
const dag = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' }) : 'onbekend')
const geweigerd = computed(() => (error.value as any)?.data?.data?.reden === 'niveau')
const periodeLabel = computed(() => { const p = String(data.value.periode ?? 'DEZE MAAND').toLowerCase(); return p.charAt(0).toUpperCase() + p.slice(1) })
const stokTegel = computed(() => (data.value.stok ? { waarde: `${data.value.stok.conversie}%`, hint: `${data.value.fases.find((f: any) => f.faseId === data.value.stok.faseId)?.label} naar volgende fase, norm ${data.value.stok.norm}%` } : null))
useHead({ title: 'Funnel · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="funnel.eigen" />
    <template v-else>
      <RapportKop v-model:open="filtersOpen" :kicker="`Funnel · ${periodeLabel}`" :titel="data.kop?.titel ?? 'Funnel'" :subtitel="data.kop?.stok ?? 'Elke fase van de prospectreis: wie er binnenkwam, wie doorstroomde en waar het stokt.'" :filter-aantal="filterAantal" helpartikel="funnel">
        <template #acties>
          <a v-if="data.kan?.export" :href="csv" class="dd-actie dd-actie--secundair" data-test="funnel-csv"><Icoon naam="Download" class="dd-actie-icoon" />Download CSV</a>
        </template>
      </RapportKop>
      <RapportPeriode v-if="filtersOpen" :opties="PERIODES" :waarde="periode" :van="(route.query.van as string) ?? data.van" :tot="(route.query.tot as string) ?? data.tot" :vandaag="vandaag" :eigen-label="EIGEN_PERIODE_LABEL" :reset="filterAantal > 0" data-test="funnel-filters" @kies="kiesPeriode" @datum="(van, tot) => zetMeer({ periode: 'eigen', van, tot })" @reset="resetFilters">
        <div v-if="data.kan?.team" class="filter-groep" role="group" aria-label="Persoon of team">
          <span class="filter-label">Wie</span>
          <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': !wie }" data-test="wie-mijn" @click="kiesWie('')">Mijn</button>
          <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': wie === 'team' }" data-test="wie-team" @click="kiesWie('team')">Mijn teams</button>
          <button v-for="v in ctx.verkopers" :key="v.id" type="button" class="filter-pil" :class="{ 'filter-pil--aan': wie === v.id }" :data-test="`wie-${v.id}`" @click="kiesWie(wie === v.id ? '' : v.id)">{{ v.naam }}</button>
        </div>
        <div v-if="data.kan?.filters" class="filter-groep fr-keuzes">
          <label class="fr-keuze"><span class="filter-label">Doelgroep</span><select class="invoer" :value="route.query.doelgroep ?? ''" @change="zet('doelgroep', ($event.target as HTMLSelectElement).value)"><option value="">Alle</option><option v-for="d in ctx.doelgroepen" :key="d.id" :value="d.id">{{ d.naam }}</option></select></label>
          <label class="fr-keuze"><span class="filter-label">Reis</span><select class="invoer" :value="route.query.reis ?? ''" @change="zet('reis', ($event.target as HTMLSelectElement).value)"><option value="">Alle</option><option v-for="r in reizen.reizen" :key="r.id" :value="r.id">{{ r.naam }}</option></select></label>
          <label class="fr-keuze"><span class="filter-label">Campagne</span><select class="invoer" :value="route.query.campagne ?? ''" data-test="filter-campagne" @change="zet('campagne', ($event.target as HTMLSelectElement).value)"><option value="">Alle</option><option v-for="c in campagnes.campagnes" :key="c.id" :value="c.id">{{ c.naam }}</option></select></label>
          <label v-if="data.kan?.vergelijken" class="fr-keuze alleen-groot"><span class="filter-label">Vergelijk met reis</span><select class="invoer" :value="route.query.reis2 ?? ''" @change="zet('reis2', ($event.target as HTMLSelectElement).value)"><option value="">Geen</option><option v-for="r in reizen.reizen" :key="r.id" :value="r.id">{{ r.naam }}</option></select></label>
        </div>
        <div v-else class="filter-groep">
          <button type="button" class="dd-act knop-slot" data-test="filters-slot" @click="toonUitleg('funnel.filters')"><Icoon naam="Lock" :grootte="14" /> Doelgroep, reis en campagne</button>
        </div>
      </RapportPeriode>

      <section class="section">
        <div class="container fr-stapel">
          <p v-if="geweigerd" class="kaart kaart--geel">Deze filters komen vanaf Gevorderd.</p>
          <LegeStaat v-if="!data.aantalAccounts" titel="Nog geen accounts in deze periode." tekst="Kies een langere periode of haal leads binnen via de Leadgenerator." />
          <template v-else>
            <RapportCijfers :kicker="`Prospectreis · ${periodeLabel}`" :titel="data.tegels?.naarAfspraak != null ? `${data.tegels.naarAfspraak}% van je instroom kwam tot een eerste afspraak.` : data.kop.titel" :duiding="data.kop.stok ?? 'Geen fase zit onder de norm. Meer instroom is nu de hefboom.'" data-test="funnel-tegels">
              <RapportTegel breed label="Instroom" :waarde="data.aantalAccounts" :hint="`${data.aantalAccounts === 1 ? 'account' : 'accounts'} die in deze periode een fase bereikten`" data-test="funnel-tegel-instroom">
                <span class="fr-split" role="img" :aria-label="hoofdTelling.map((h) => `${h.n} in ${h.g}`).join(', ')">
                  <span v-for="h in hoofdTelling" :key="h.g" class="fr-split-vul" :class="`fr-split-vul--${GROEP_KLEUR[h.g]}`" :style="{ width: `${groepPct(h.n)}%` }" />
                </span>
                <span class="fr-split-legenda"><span v-for="h in hoofdTelling" :key="h.g"><span class="fr-stip" :class="`fr-split-vul--${GROEP_KLEUR[h.g]}`" />{{ h.g }} {{ h.n }}</span></span>
              </RapportTegel>
              <RapportTegel label="Eerste afspraak" :waarde="data.tegels.gepland" :hint="data.tegels.naarAfspraak != null ? `${data.tegels.naarAfspraak}% van de instroom` : null" data-test="funnel-tegel-afspraak" />
              <RapportTegel label="Afspraak gehouden" :waarde="data.tegels.gehouden" :hint="data.tegels.gehoudenVanGepland != null ? `${data.tegels.gehoudenVanGepland}% van gepland` : 'nog niets gepland'" data-test="funnel-tegel-gehouden" />
              <RapportTegel label="Overgedragen" :waarde="data.tegels.overgedragen" :hint="data.tegels.naarOverdracht != null ? `${data.tegels.naarOverdracht}% van de instroom` : null" data-test="funnel-tegel-over" />
              <RapportTegel label="Uitgevallen" :waarde="data.tegels.uitval" :hint="data.tegels.topReden ? `vooral ${data.tegels.topReden.reden} (${data.tegels.topReden.aantal})` : 'geen uitval'" data-test="funnel-tegel-uitval" />
              <RapportTegel label="Tot eerste afspraak" :waarde="data.tegels.doorlooptijdTotAfspraak != null ? `${data.tegels.doorlooptijdTotAfspraak.toLocaleString('nl-NL')} d` : '-'" hint="som van de gemiddelde doorlooptijden" data-test="funnel-tegel-doorloop" />
              <RapportTegel label="Stokpunt" :waarde="stokTegel?.waarde ?? 'Geen'" :hint="stokTegel?.hint ?? 'alles op of boven de norm'" data-test="funnel-tegel-stok" />
            </RapportCijfers>

            <button v-if="data.stok" type="button" class="kaart kaart--geel fr-stok" data-test="stokpunt" @click="openFase(data.stok.faseId)"><Icoon naam="TriangleAlert" :grootte="16" /> {{ data.kop.stok }} <span class="fr-stok-cta">Bekijk de accounts →</span></button>
            <p v-if="data.vergelijk?.teWeinig" class="kaart kaart--geel">Te weinig accounts om te vergelijken.</p>

            <div class="fr-bord" :class="{ 'fr-bord--twee': data.vergelijk && !data.vergelijk.teWeinig }">
              <div v-for="(f2, n) in (data.vergelijk && !data.vergelijk.teWeinig ? [data, data.vergelijk] : [data])" :key="n" class="chart-block fr-funnel" data-test="funnel">
                <header class="chart-head">
                  <h2 class="chart-title">{{ n === 0 ? 'Conversie per reisfase' : 'Vergeleken reis' }}</h2>
                  <span class="chart-meta">{{ f2.aantalAccounts }} accounts · aantal en doorstroom</span>
                </header>
                <div v-for="g in GROEPEN" :key="g" class="fr-groep">
                  <h3 class="fr-groep-kop">{{ g }}</h3>
                  <BalkRijen :rijen="rijenVoor(f2.fases, g)" :max="max" klikbaar :label="`Fases in ${g}`" @kies="(r) => openFase(r.sleutel)" />
                </div>
                <EersteAfspraakPoging v-if="n === 0 && data.eersteAfspraak" class="fr-eap" :data="data.eersteAfspraak" data-test="funnel-eerste-afspraak" />
              </div>
            </div>

            <div v-if="heeftDetails" class="fr-duo">
              <div class="chart-block" data-test="doorlooptijden">
                <header class="chart-head"><h2 class="chart-title">Doorlooptijd per fase</h2><span class="chart-meta">gemiddeld in dagen · streep is de norm</span></header>
                <BalkRijen :rijen="doorloopRijen" :max="doorloopMax" eenheid="dagen" label="Doorlooptijd per fase" />
              </div>
              <div class="chart-block" data-test="uitval">
                <header class="chart-head"><h2 class="chart-title">Uitval per reden</h2><span class="chart-meta">{{ data.tegels.uitval }} uitgevallen</span></header>
                <BalkRijen v-if="uitvalRijen.length" :rijen="uitvalRijen" klikbaar label="Uitval per reden" @kies="(r) => openReden(r.sleutel)" />
                <p v-else class="fr-leeg">Geen uitval in deze periode.</p>
              </div>
            </div>

            <StaafGrafiek v-if="data.pogingen" titel="Pogingen tot afspraak" :meta="`${pogingTotaal} eerste ${pogingTotaal === 1 ? 'afspraak' : 'afspraken'}${data.eersteAfspraak?.gemiddeld != null ? ` · gemiddeld bij poging ${data.eersteAfspraak.gemiddeld.toLocaleString('nl-NL')}` : ''} · norm 4 tot 5 pogingen`" :punten="pogingPunten" :series="[{ sleutel: 'afspraken', label: 'Eerste afspraken', kleur: 'geel' }]" :hoogte="140" leeg="Nog geen eerste afspraken in deze periode." data-test="pogingen" />

            <div class="chart-block" data-test="funnel-tabel">
              <header class="chart-head"><h2 class="chart-title">Alle fases in cijfers</h2><span class="chart-meta">{{ periodeLabel }}</span></header>
              <div class="fr-tabelvak">
                <table class="fr-tabel">
                  <thead><tr><th scope="col">Fase</th><th scope="col" class="fr-r">Binnen</th><th scope="col" class="fr-r">Door</th><th scope="col" class="fr-r">Uit</th><th scope="col" class="fr-r">Nog in fase</th><template v-if="heeftDetails"><th scope="col" class="fr-r">Conversie</th><th scope="col" class="fr-r">Norm</th><th scope="col" class="fr-r">Dagen</th><th scope="col">Uitval</th></template></tr></thead>
                  <tbody>
                    <tr v-for="f in data.fases" :key="f.faseId" :class="{ 'fr-tabel-stok': f.stok }">
                      <th scope="row"><button type="button" class="fr-tabel-knop" :disabled="!f.aantal" @click="open(f)">{{ f.label }}</button></th>
                      <td class="fr-r tnum">{{ f.aantal }}</td><td class="fr-r tnum">{{ f.doorgestroomd }}</td><td class="fr-r tnum">{{ f.uitgevallen }}</td><td class="fr-r tnum">{{ f.aanwezig }}</td>
                      <template v-if="heeftDetails">
                        <td class="fr-r tnum">{{ f.conversie != null ? `${f.conversie}%` : '-' }}</td><td class="fr-r tnum">{{ f.norm?.conversie != null ? `${f.norm.conversie}%` : '-' }}</td><td class="fr-r tnum">{{ f.doorlooptijd != null ? f.doorlooptijd.toLocaleString('nl-NL') : '-' }}</td>
                        <td><span class="fr-redenen"><button v-for="u in f.uitval ?? []" :key="u.reden" type="button" class="pil fr-reden" @click="open(f, u.reden)">{{ u.reden }} {{ u.aantal }}</button></span></td>
                      </template>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </template>
        </div>
      </section>
    </template>
    <FlyoutShell v-if="lijst" open titel-id="fn-lijst-titel" data-test="funnel-lijst" @sluit="lijst = null">
        <template #kop><span class="fo-kicker">Funnel</span><h2 id="fn-lijst-titel" class="fo-titel">{{ lijst.titel }}</h2></template>
          <div class="fo-body">
            <p v-if="laadt" class="rij-sub">Laden…</p>
            <p v-else-if="!accounts.accounts.length" class="rij-sub">Geen accounts.</p>
            <div v-for="a in accounts.accounts" :key="a.id" class="rij rij--compact">
              <div class="rij-info"><NuxtLink :to="`/accounts/${a.id}`" class="rij-titel">{{ a.naam }}</NuxtLink>
                <div class="rij-sub">Fase sinds {{ dag(a.faseSinds) }} · laatste poging {{ dag(a.laatstePoging) }}<template v-if="a.volgendeStap"> · {{ a.volgendeStap }}</template><template v-if="a.reden"> · {{ a.reden }}</template></div></div>
              <button type="button" class="dd-act" @click="nieuweTaak = { id: a.id, naam: a.naam }; lijst = null">Maak taak</button>
              <NuxtLink :to="`/accounts/${a.id}`" class="dd-act">Open account</NuxtLink>
            </div>
          </div>
      </FlyoutShell>
    <NieuweTaakFlyout :open="!!nieuweTaak" :account="nieuweTaak" @sluit="nieuweTaak = null" @gemaakt="nieuweTaak = null" />
  </div>
</template>

<style scoped>
.fr-stapel { display: flex; flex-direction: column; gap: 16px; }
.fr-keuzes { gap: 12px; }
.fr-keuze { display: inline-flex; align-items: center; gap: 8px; }
.fr-keuze .invoer { min-height: var(--touch-target-min); width: auto; max-width: 220px; }

.fr-split { display: flex; height: 8px; margin-top: 6px; overflow: hidden; background: rgba(255, 255, 255, 0.10); border-radius: 2px; }
.fr-split-vul { height: 100%; }
.fr-split-vul--inkt { background: var(--muted-light, var(--muted)); }
.fr-split-vul--geel { background: var(--yellow); }
.fr-split-vul--groen { background: var(--green); }
.fr-split-legenda { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 11px; font-weight: 600; color: rgba(255, 255, 255, 0.78); }
.fr-stip { display: inline-block; width: 8px; height: 8px; margin-right: 4px; border-radius: 2px; vertical-align: middle; }

.fr-stok { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; width: 100%; text-align: left; font: inherit; font-weight: 700; cursor: pointer; min-height: var(--touch-target-min); }
.fr-stok-cta { margin-left: auto; font-size: 12px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }

.chart-block { background: var(--wit); border: 1px solid var(--border); padding: var(--kaart-padding); border-radius: var(--radius); min-width: 0; }
.chart-head { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.chart-title { margin: 0; font-family: var(--font-serif); font-size: 18px; font-weight: 700; color: var(--ink); }
.chart-meta { font-size: 12px; color: var(--muted); }

.fr-bord { display: grid; grid-template-columns: 1fr; gap: 16px; }
@media (min-width: 1000px) { .fr-bord--twee { grid-template-columns: 1fr 1fr; } }
.fr-groep + .fr-groep { margin-top: 18px; }
.fr-eap { margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border); }
.fr-groep-kop { margin: 0 0 10px; font-size: var(--fs-label); font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.fr-duo { display: grid; grid-template-columns: 1fr; gap: 16px; }
@media (min-width: 900px) { .fr-duo { grid-template-columns: 1fr 1fr; gap: 24px; } }
.fr-leeg { margin: 0; font-size: 13px; color: var(--muted); }

.fr-tabelvak { overflow-x: auto; }
.fr-tabel { width: 100%; border-collapse: collapse; font-size: 13px; }
.fr-tabel th, .fr-tabel td { padding: 8px; border-bottom: 1px solid var(--border); text-align: left; white-space: nowrap; vertical-align: middle; }
.fr-tabel thead th { font-size: var(--fs-label); font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.fr-tabel-stok { background: color-mix(in srgb, var(--yellow) 18%, var(--wit)); }
.fr-tabel-knop { min-height: 36px; padding: 0; background: none; border: 0; font: inherit; font-weight: 700; color: var(--ink); text-align: left; cursor: pointer; border-bottom: 1px dashed var(--border-strong); }
.fr-tabel-knop:disabled { cursor: default; color: var(--muted); border-bottom: 0; }
.fr-r { text-align: right !important; }
.fr-redenen { display: flex; flex-wrap: wrap; gap: 4px; min-width: 220px; max-width: 360px; white-space: normal; }
.fr-reden { cursor: pointer; border: 0; font: inherit; white-space: normal; text-align: left; max-width: 100%; }
@media (max-width: 720px) {
  .fr-tabel-knop, .fr-reden { min-height: var(--touch-target-min); }
  .chart-block { padding: 16px; }
  .fr-keuzes { width: 100%; min-width: 0; }
  .fr-keuze { width: 100%; min-width: 0; justify-content: space-between; }
  .fr-keuze .invoer { flex: 1; max-width: none; min-width: 0; }
  .fr-stok-cta { margin-left: 0; }
}
</style>
