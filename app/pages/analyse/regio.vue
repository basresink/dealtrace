<script setup lang="ts">
// Regio-analyse (F18): "Waar laat je potentie liggen?". Cijfers, een tabel per regio met dekking
// (altijd een rij "Zonder regio"), een kaart met punten per status en per regio een lijst: nooit
// bezocht boven, dan langst stil, dan klasse. Op de telefoon een lijst in plaats van de tabel.
const route = useRoute()
const router = useRouter()
const { functie } = useMe()
const aan = computed(() => !!functie('regio.analyse')?.beschikbaar)
const scope = computed(() => (route.query.scope === 'team' ? 'team' : 'eigen'))
const { data } = await useFetch<any>('/api/analyse/regio', { query: computed(() => ({ scope: scope.value })), immediate: aan.value, default: () => null })
const open = ref<string | null | undefined>(undefined)
const lijstVan = (id: string | null) => (data.value?.lijst ?? []).filter((a: any) => a.regioId === id).slice(0, 12)
const klaar = reactive({ open: false, account: null as any })
const plan = reactive({ open: false, account: null as any })
const kleur = (a: any) => (a.soort === 'klant' ? 'blauw' : !a.laatsteBezoek ? 'rood' : Date.parse(a.laatsteBezoek) < Date.now() - 90 * 864e5 ? 'grijs' : 'groen')
useHead({ title: 'Regio-analyse · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="regio.analyse" />
    <template v-else-if="data">
      <PaginaKop kicker="Analyse · Regio" titel="Waar laat je potentie liggen?" uitleg="Per regio: wie je bezocht, wie stil is en wie je nog nooit zag." helpartikel="gebieden-en-regiodagen">
        <template #acties>
          <div v-if="data.manager" class="keuzegroep keuzegroep--klein" role="group" aria-label="Scope">
            <button type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': scope === 'eigen' }" @click="router.replace({ query: { scope: 'eigen' } })">Eigen</button>
            <button type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': scope === 'team' }" @click="router.replace({ query: { scope: 'team' } })">Team</button>
          </div>
        </template>
      </PaginaKop>
      <section class="section">
        <div class="container">
          <div class="stat-raster" data-test="regio-cijfers">
            <div class="kaart"><span class="veld-label">Accounts in beeld</span><p class="title">{{ data.cijfers.inBeeld }}</p></div>
            <div class="kaart"><span class="veld-label">Stil of nooit bezocht</span><p class="title">{{ data.cijfers.stilOfNooit }}</p></div>
            <div class="kaart"><span class="veld-label">Nog niet benaderde prospects</span><p class="title">{{ data.cijfers.nietBenaderd }}</p></div>
            <div class="kaart"><span class="veld-label">Gekwalificeerd, 60 dagen geen contact</span><p class="title">{{ data.cijfers.gekwalificeerdZonderContact }}</p></div>
            <div class="kaart"><span class="veld-label">Bezocht in 90 dagen</span><p class="title">{{ data.cijfers.bezochtProcent }}%</p><p class="meta">doel {{ data.cijfers.doel }}%</p></div>
          </div>
          <div class="ra-tabel mt-24">
            <table class="tabel alleen-groot" data-test="regio-tabel">
              <thead><tr><th>Regio</th><th>Regiodag</th><th>Klanten</th><th>Prospects</th><th>Nog niet benaderd</th><th>Dekking</th><th>Stil</th><th>Nooit</th><th /></tr></thead>
              <tbody>
                <tr v-for="r in data.regios" :key="r.regioId ?? 'geen'">
                  <td>{{ r.naam }}</td><td>{{ r.regiodag ?? '' }}</td><td>{{ r.klanten }}</td><td>{{ r.prospects }}</td><td>{{ r.nietBenaderd }}</td>
                  <td><span class="ra-balk"><span :style="{ width: `${r.dekking}%` }" /></span> {{ r.dekking }}%</td><td>{{ r.stil }}</td><td>{{ r.nooit }}</td>
                  <td><button type="button" class="dd-act" @click="open = open === r.regioId ? undefined : r.regioId">Lijst</button></td>
                </tr>
              </tbody>
            </table>
            <ul class="schakel-lijst kaart alleen-telefoon">
              <li v-for="r in data.regios" :key="r.regioId ?? 'geen'" class="schakel-rij"><button type="button" class="taak-titel" @click="open = open === r.regioId ? undefined : r.regioId"><strong>{{ r.naam }}</strong> <span class="meta">{{ r.dekking }}% bezocht · {{ r.stil }} stil · {{ r.nooit }} nooit</span></button></li>
            </ul>
          </div>
          <div v-if="open !== undefined" class="kaart mt-16" data-test="regio-lijst">
            <h2 class="kop-blok">{{ data.regios.find((r: any) => r.regioId === open)?.naam }}</h2>
            <ul class="schakel-lijst">
              <li v-for="a in lijstVan(open ?? null)" :key="a.id" class="schakel-rij">
                <span><NuxtLink :to="`/accounts/${a.id}`">{{ a.naam }}</NuxtLink> <span class="meta">{{ a.laatsteBezoek ? `laatst ${new Date(a.laatsteBezoek).toLocaleDateString('nl-NL')}` : 'nooit bezocht' }}</span></span>
                <span class="dd-acties"><button type="button" class="dd-act" @click="Object.assign(plan, { open: true, account: { id: a.id, naam: a.naam } })"><Icoon naam="Plus" />Afspraak</button><button v-if="functie('bezoeken.klaarzetten')?.beschikbaar" type="button" class="dd-act" @click="Object.assign(klaar, { open: true, account: { id: a.id, naam: a.naam } })">Klaarzetten voor regiodag</button></span>
              </li>
            </ul>
          </div>
          <h2 class="kop-blok mt-24">Kaart</h2>
          <KaartSchets :punten="[]" :stops="[]" :extra="data.lijst.filter((a: any) => a.punt).map((a: any) => ({ punt: a.punt, kleur: kleur(a), titel: a.naam }))" />
          <p class="meta mt-8">Rood nooit bezocht · grijs langer dan 90 dagen stil · groen bezocht · blauw klant</p>
        </div>
      </section>
      <PlanAfspraakFlyout :open="plan.open" :account="plan.account" :voorstel="{ vorm: 'bezoek' }" @sluit="plan.open = false" @gepland="plan.open = false" />
      <KlaarzetFlyout :open="klaar.open" :account="klaar.account" @sluit="klaar.open = false" />
    </template>
  </div>
</template>
