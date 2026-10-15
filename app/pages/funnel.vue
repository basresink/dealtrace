<script setup lang="ts">
// Funnel van de prospectreis (F17): kop als zin met het stokpunt, de fases gegroepeerd in Vinden,
// Bewerken en Verbinden, uitval met reden en pogingen tot afspraak (Gevorderd), en de lijst achter een
// fase of reden. Filters in de URL; standaard deze maand en "mijn". Op de telefoon verticaal.
const { functie } = useMe()
const aan = !!functie('funnel.eigen')?.beschikbaar
const { toon: toonUitleg } = useNietAangezet()
const route = useRoute()
const router = useRouter()
const query = computed(() => Object.fromEntries(Object.entries(route.query).filter(([, v]) => typeof v === 'string' && v)))
const { data, error } = await useFetch<any>('/api/funnel', { query, immediate: aan, default: () => ({ fases: [], kop: {}, kan: {} }) })
const { data: ctx } = await useFetch<any>('/api/campagnes/context', { immediate: aan, default: () => ({ doelgroepen: [], verkopers: [] }) })
const { data: reizen } = await useFetch<any>('/api/reizen', { immediate: aan && !!functie('reis.overzicht')?.beschikbaar, default: () => ({ reizen: [] }) })
const { data: campagnes } = await useFetch<any>('/api/campagnes', { query: { eigenaar: 'alle' }, immediate: aan, default: () => ({ campagnes: [] }) })
function zet(k: string, v: string) { router.replace({ query: { ...route.query, [k]: v || undefined } }) }
const GROEPEN = ['Vinden', 'Bewerken', 'Verbinden'] as const
const max = computed(() => Math.max(1, ...data.value.fases.map((f: any) => f.aantal)))
// Lijst achter een fase of reden, als schuifvenster.
const lijst = ref<{ fase: string; reden: string | null; titel: string } | null>(null)
const { data: accounts, execute: laadLijst, pending: laadt } = useFetch<any>('/api/funnel/accounts', { query: computed(() => ({ ...query.value, fase: lijst.value?.fase, reden: lijst.value?.reden ?? undefined })), immediate: false, watch: false, default: () => ({ accounts: [] }) })
function open(f: any, reden: string | null = null) { lijst.value = { fase: f.faseId, reden, titel: reden ? `${f.label}: ${reden}` : f.label }; laadLijst() }
const nieuweTaak = ref<{ id: string; naam: string } | null>(null)
const csv = computed(() => `/api/funnel/export?${new URLSearchParams(query.value as Record<string, string>).toString()}`)
const dag = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' }) : 'onbekend')
const pogingMax = computed(() => Math.max(1, ...Object.values(data.value.pogingen ?? {}).map(Number)))
const geweigerd = computed(() => (error.value as any)?.data?.data?.reden === 'niveau')
useHead({ title: 'Funnel · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="funnel.eigen" />
    <template v-else>
      <PaginaKop :kicker="`Funnel · ${data.periode ?? 'Deze maand'}`" :titel="data.kop?.titel ?? 'Funnel'" helpartikel="funnel">
        <template #acties>
          <a v-if="data.kan?.export" :href="csv" class="dd-actie dd-actie--secundair" data-test="funnel-csv"><Icoon naam="Download" class="dd-actie-icoon" />Download CSV</a>
        </template>
      </PaginaKop>
      <section class="section">
        <div class="container">
          <button v-if="data.stok" type="button" class="kaart kaart--geel fn-stok" data-test="stokpunt" @click="open(data.fases.find((f: any) => f.faseId === data.stok.faseId))">{{ data.kop.stok }}</button>
          <div class="cp-filters fn-filters" data-test="funnel-filters">
            <label class="veld"><span class="veld-label">Periode</span>
              <select class="invoer" :value="route.query.periode ?? 'maand'" data-test="filter-periode" @change="zet('periode', ($event.target as HTMLSelectElement).value === 'maand' ? '' : ($event.target as HTMLSelectElement).value)">
                <option value="maand">Deze maand</option><option value="kwartaal">Dit kwartaal</option><option value="verkoopjaar">Dit verkoopjaar</option><option value="eigen">Eigen periode</option></select></label>
            <template v-if="route.query.periode === 'eigen'">
              <label class="veld"><span class="veld-label">Van</span><input type="date" class="invoer" :value="route.query.van" @change="zet('van', ($event.target as HTMLInputElement).value)"></label>
              <label class="veld"><span class="veld-label">Tot</span><input type="date" class="invoer" :value="route.query.tot" @change="zet('tot', ($event.target as HTMLInputElement).value)"></label>
            </template>
            <template v-if="data.kan?.filters">
              <label class="veld"><span class="veld-label">Doelgroep</span><select class="invoer" :value="route.query.doelgroep ?? ''" @change="zet('doelgroep', ($event.target as HTMLSelectElement).value)"><option value="">Alle</option><option v-for="d in ctx.doelgroepen" :key="d.id" :value="d.id">{{ d.naam }}</option></select></label>
              <label class="veld"><span class="veld-label">Reis</span><select class="invoer" :value="route.query.reis ?? ''" @change="zet('reis', ($event.target as HTMLSelectElement).value)"><option value="">Alle</option><option v-for="r in reizen.reizen" :key="r.id" :value="r.id">{{ r.naam }}</option></select></label>
              <label class="veld"><span class="veld-label">Campagne</span><select class="invoer" :value="route.query.campagne ?? ''" data-test="filter-campagne" @change="zet('campagne', ($event.target as HTMLSelectElement).value)"><option value="">Alle</option><option v-for="c in campagnes.campagnes" :key="c.id" :value="c.id">{{ c.naam }}</option></select></label>
            </template>
            <button v-else type="button" class="dd-act knop-slot fn-slot" data-test="filters-slot" @click="toonUitleg('funnel.filters')"><Icoon naam="Lock" :grootte="14" /> Doelgroep, reis en campagne</button>
            <label v-if="data.kan?.vergelijken" class="veld alleen-groot"><span class="veld-label">Vergelijk met reis</span><select class="invoer" :value="route.query.reis2 ?? ''" @change="zet('reis2', ($event.target as HTMLSelectElement).value)"><option value="">Geen</option><option v-for="r in reizen.reizen" :key="r.id" :value="r.id">{{ r.naam }}</option></select></label>
            <label v-if="data.kan?.team" class="veld"><span class="veld-label">Persoon of team</span>
              <select class="invoer" :value="route.query.gebruiker ?? (route.query.scope === 'team' ? 'team' : '')" data-test="filter-team" @change="(e) => { const v = (e.target as HTMLSelectElement).value; router.replace({ query: { ...route.query, gebruiker: v && v !== 'team' ? v : undefined, scope: v === 'team' ? 'team' : undefined } }) }">
                <option value="">Mijn</option><option value="team">Mijn teams</option><option v-for="v in ctx.verkopers" :key="v.id" :value="v.id">{{ v.naam }}</option></select></label>
          </div>
          <p v-if="geweigerd" class="kaart kaart--geel">Deze filters komen vanaf Gevorderd.</p>
          <LegeStaat v-if="!data.aantalAccounts" titel="Nog geen accounts in deze periode." tekst="Kies een langere periode of haal leads binnen via de Leadgenerator." />
          <template v-else>
            <p v-if="data.vergelijk?.teWeinig" class="kaart kaart--geel">Te weinig accounts om te vergelijken.</p>
            <div class="fn-bord" :class="{ 'fn-bord--twee': data.vergelijk && !data.vergelijk.teWeinig }">
              <div v-for="(f2, n) in (data.vergelijk && !data.vergelijk.teWeinig ? [data, data.vergelijk] : [data])" :key="n" class="fn-funnel" data-test="funnel">
                <div v-for="g in GROEPEN" :key="g" class="fn-groep">
                  <h2 class="fn-groep-kop">{{ g }}</h2>
                  <button v-for="f in f2.fases.filter((x: any) => x.hoofdfase === g)" :key="f.faseId" type="button" class="fn-fase" :class="{ 'fn-fase--stok': f.stok }" :data-test="`fase-${f.faseId}`" @click="open(f)">
                    <span class="fn-fase-kop"><span class="fn-fase-naam">{{ f.label }}</span><strong class="fn-fase-aantal">{{ f.aantal }}</strong></span>
                    <span class="fn-balk"><span :style="{ width: `${Math.round((f.aantal / max) * 100)}%` }" /></span>
                    <span v-if="f.conversie !== undefined" class="fn-fase-cijfers">
                      <span v-if="f.conversie !== null">{{ f.conversie }}% door<template v-if="f.norm?.conversie"> (norm {{ f.norm.conversie }})</template></span>
                      <span v-if="f.doorlooptijd !== null">{{ f.doorlooptijd.toLocaleString('nl-NL') }} dagen</span>
                      <span v-if="f.extra">{{ f.extra }}</span>
                    </span>
                    <span v-if="f.uitval?.length" class="fn-uitval" data-test="uitval">
                      <span v-for="u in f.uitval" :key="u.reden" class="fn-reden" role="link" tabindex="0" @click.stop="open(f, u.reden)" @keydown.enter.stop="open(f, u.reden)">{{ u.reden }} {{ u.aantal }}</span>
                    </span>
                  </button>
                </div>
              </div>
            </div>
            <div v-if="data.pogingen" class="kaart mt-16" data-test="pogingen">
              <h2 class="fo-blok-titel">Pogingen tot afspraak</h2>
              <div class="fn-staafjes">
                <div v-for="(n, k) in data.pogingen" :key="k" class="fn-staaf"><span class="fn-staaf-balk" :style="{ height: `${Math.round((Number(n) / pogingMax) * 100)}%` }" /><strong>{{ n }}</strong><span class="rij-sub">{{ k === 'later' ? 'later' : `poging ${k}` }}</span></div>
              </div>
            </div>
          </template>
        </div>
      </section>
    </template>
    <Teleport to="body">
      <div v-if="lijst" class="fo-overlay" @click.self="lijst = null">
        <aside class="fo-panel fo-panel--schuif" role="dialog" aria-modal="true" aria-labelledby="fn-lijst-titel" data-test="funnel-lijst">
          <header class="fo-head"><div class="fo-head-tekst"><span class="fo-kicker">Funnel</span><h2 id="fn-lijst-titel" class="fo-titel">{{ lijst.titel }}</h2></div>
            <button type="button" class="fo-sluit" aria-label="Sluiten" @click="lijst = null"><Icoon naam="X" /></button></header>
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
        </aside>
      </div>
    </Teleport>
    <NieuweTaakFlyout :open="!!nieuweTaak" :account="nieuweTaak" @sluit="nieuweTaak = null" @gemaakt="nieuweTaak = null" />
  </div>
</template>
