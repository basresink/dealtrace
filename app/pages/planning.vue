<script setup lang="ts">
// Prospectplanning (F13): tabbladen Jaarplanning (standaard), Hercontactritme (P07) en
// Terugkomregels. Vanaf Gevorderd; het tabblad staat in de URL.
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
  jaar: { titel: 'Wie dit jaar aan de beurt is, per potentie.', uitleg: 'Grote prospects vroeg in het verkoopjaar, middelgrote in de eerste vijf maanden, kleine doorlopend.', hulp: 'prospectplanning' },
  ritme: { titel: 'Hercontactritme', uitleg: 'De reeks pogingen tot een afspraak. Na de laatste poging zonder reactie wordt het account geparkeerd.', hulp: 'hercontactritme' },
  terugkom: { titel: 'Terugkomregels', uitleg: 'Wanneer en hoe je terugkomt na een nee, een verlies of een slapende periode.', hulp: 'wanneer-we-iemand-terugbellen' },
}
useHead({ title: 'Prospectplanning · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!tabs.length" sleutel="planning.jaar" />
    <template v-else>
      <PaginaKop kicker="Prospectplanning" :titel="KOP[tab!]!.titel" :uitleg="KOP[tab!]!.uitleg" :helpartikel="KOP[tab!]!.hulp" />
      <section class="section section--laatste">
        <div class="container">
          <nav class="tabbalk" aria-label="Tabbladen">
            <button v-for="t in tabs" :key="t.k" type="button" class="tab" :class="{ 'tab--actief': tab === t.k }" :aria-current="tab === t.k ? 'page' : undefined" :data-test="`tab-${t.k}`" @click="router.replace({ query: { tab: t.k === tabs[0]!.k ? undefined : t.k } })">{{ t.t }}</button>
          </nav>
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
