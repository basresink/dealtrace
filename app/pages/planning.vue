<script setup lang="ts">
// Prospectplanning (F13) in de opzet van DealDrive: kop met werkbalk (Zoeken, Alle prospects) en
// daaronder de tabbladen Jaarplanning (standaard), Hercontactritme (P07) en Terugkomregels. Vanaf
// Gevorderd; het tabblad staat in de URL (?tab=ritme, ?tab=terugkom). Op Jaarplanning staat de weergave
// (Maand, Kwartaal, Jaar) in het filterpaneel onder de knop Filters, in de URL als ?weergave=.
const { functie } = useMe()
const route = useRoute()
const router = useRouter()
const tabs = computed(() => [
  { k: 'jaar', t: 'Jaarplanning', aan: !!functie('planning.jaar')?.beschikbaar },
  { k: 'ritme', t: 'Hercontactritme', aan: !!functie('ritme.lezen')?.beschikbaar },
  { k: 'terugkom', t: 'Terugkomregels', aan: !!functie('terugkomen.lezen')?.beschikbaar },
].filter((t) => t.aan))
const tab = computed(() => tabs.value.find((t) => t.k === route.query.tab)?.k ?? tabs.value[0]?.k)
const KOP: Record<string, { titel: string; uitleg: string; hulp: string }> = {
  jaar: { titel: 'Jaarplanning prospects', uitleg: 'Hoe groter de kans, hoe eerder je erbij wilt zijn: grote prospects vooraan het verkoopjaar, middelgrote in de eerste vijf maanden, kleine doorlopend. Per maand zie je wie aan de beurt is en wie je nog moet spreken.', hulp: 'prospectplanning' },
  ritme: { titel: 'Hercontactritme', uitleg: 'De reeks pogingen tot een afspraak. Na de laatste poging zonder reactie wordt het account geparkeerd.', hulp: 'hercontactritme' },
  terugkom: { titel: 'Terugkomregels', uitleg: 'Wanneer en hoe je terugkomt na een nee of een verlies.', hulp: 'wanneer-we-iemand-terugbellen' },
}
const WEERGAVEN = [{ k: 'maand', t: 'Maand' }, { k: 'kwartaal', t: 'Kwartaal' }, { k: 'jaar', t: 'Jaar' }] as const
const weergave = computed(() => WEERGAVEN.find((w) => w.k === route.query.weergave)?.k ?? 'jaar')
// Met een weergave in de URL staat het paneel bij openen open.
const filtersOpen = ref(WEERGAVEN.some((w) => w.k === route.query.weergave))
const filterAantal = computed(() => Number(weergave.value !== 'jaar'))
function kiesWeergave(k: string) { router.replace({ query: { ...route.query, weergave: k === 'jaar' ? undefined : k } }) }
const kicker = computed(() => `Prospectplanning · ${tabs.value.find((t) => t.k === tab.value)?.t ?? ''}`)
useHead({ title: 'Prospectplanning · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!tabs.length" sleutel="planning.jaar" />
    <template v-else>
      <PaginaKop :kicker="kicker" :titel="KOP[tab!]!.titel" :uitleg="KOP[tab!]!.uitleg" :helpartikel="KOP[tab!]!.hulp">
        <template #acties>
          <button v-if="tab === 'jaar'" type="button" class="dd-actie dd-actie--secundair" :aria-expanded="filtersOpen" data-test="planning-filters-knop" @click="filtersOpen = !filtersOpen"><Icoon naam="Filter" class="dd-actie-icoon" />Filters<span v-if="filterAantal" class="pil-teller" data-test="planning-filter-teller">{{ filterAantal }}</span></button>
          <FunctieLink to="/prospects" class="dd-actie dd-actie--secundair" data-test="alle-prospects">Alle prospects<Icoon naam="ArrowRight" class="dd-actie-icoon" /></FunctieLink>
        </template>
      </PaginaKop>
      <section class="section section--laatste">
        <div class="container">
          <nav class="tabbalk tabbalk--schuif" aria-label="Tabbladen">
            <button v-for="t in tabs" :key="t.k" type="button" class="tab" :class="{ 'tab--actief': tab === t.k }" :aria-current="tab === t.k ? 'page' : undefined" :data-test="`tab-${t.k}`" @click="router.replace({ query: { tab: t.k === tabs[0]!.k ? undefined : t.k, weergave: t.k === 'jaar' ? route.query.weergave : undefined } })">{{ t.t }}</button>
          </nav>
          <div v-if="filtersOpen && tab === 'jaar'" class="filterbalk kaart mt-16" data-test="planning-filters">
            <div class="pl-weergave" role="group" aria-label="Weergave">
              <span class="veld-label">Weergave</span>
              <button v-for="w in WEERGAVEN" :key="w.k" type="button" class="filter-pil" :class="{ 'filter-pil--aan': weergave === w.k }" :aria-pressed="weergave === w.k" :data-test="`weergave-${w.k}`" @click="kiesWeergave(w.k)">{{ w.t }}</button>
            </div>
          </div>
          <div class="mt-16">
            <PlanningJaar v-if="tab === 'jaar'" />
            <PlanningRitme v-else-if="tab === 'ritme'" />
            <PlanningTerugkom v-else-if="tab === 'terugkom'" />
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.pl-weergave { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
</style>
