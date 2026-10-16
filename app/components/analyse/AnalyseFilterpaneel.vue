<script setup lang="ts">
// Filterpaneel van de bezoek- en meetinganalyse (opzet DealDrive): periode (Week, Maand, Kwartaal of
// een eigen Periode met van en tot), het type afspraak, op de meetinganalyse de vorm, en voor de
// salesmanager het bereik (Eigen of Team) en een persoon uit het team. Alles staat in de URL.
import { VENSTERS } from '~~/shared/afspraakAnalyse'

const props = defineProps<{
  venster: { venster: string; van: string; tot: string }
  soorten: { slug: string; naam: string }[]
  soortLabel: string
  bereik: { scope: string; manager: boolean; leden: { id: string; naam: string }[]; persoon: string | null }
  metVorm?: boolean
}>()
const route = useRoute()
const router = useRouter()
const zet = (q: Record<string, string | undefined>) => router.replace({ query: { ...route.query, ...q } })
const soort = computed(() => (typeof route.query.soort === 'string' ? route.query.soort : ''))
const vorm = computed(() => (typeof route.query.vorm === 'string' ? route.query.vorm : ''))
function kiesVenster(id: string) {
  if (id === 'periode') zet({ venster: 'periode', van: props.venster.van, tot: props.venster.tot })
  else zet({ venster: id === 'kwartaal' ? undefined : id, van: undefined, tot: undefined })
}
function zetDatum(k: 'van' | 'tot', v: string) {
  if (!v) return
  let van = k === 'van' ? v : props.venster.van
  let tot = k === 'tot' ? v : props.venster.tot
  // Een begin na het eind schuift het eind mee, zodat je in elke volgorde kunt kiezen.
  if (van > tot) { if (k === 'van') tot = van; else van = tot }
  zet({ venster: 'periode', van, tot })
}
</script>

<template>
  <section class="section section--filter" data-test="af-paneel">
    <div class="container filters">
      <div class="filter-groep" role="group" aria-label="Periode">
        <span class="filter-label">Periode</span>
        <button v-for="v in VENSTERS" :key="v.id" type="button" class="filter-pil" :class="{ 'filter-pil--aan': venster.venster === v.id }" :aria-pressed="venster.venster === v.id" :data-test="`af-venster-${v.id}`" @click="kiesVenster(v.id)">{{ v.label }}</button>
      </div>
      <div v-if="venster.venster === 'periode'" class="filter-groep">
        <label class="datum-veld"><span class="filter-label">Van</span><input type="date" class="invoer invoer--klein af-datum" :value="venster.van" data-test="af-van" @change="zetDatum('van', ($event.target as HTMLInputElement).value)"></label>
        <label class="datum-veld"><span class="filter-label">Tot</span><input type="date" class="invoer invoer--klein af-datum" :value="venster.tot" data-test="af-tot" @change="zetDatum('tot', ($event.target as HTMLInputElement).value)"></label>
      </div>
      <div v-if="metVorm" class="filter-groep" role="group" aria-label="Vorm">
        <span class="filter-label">Vorm</span>
        <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': !vorm }" @click="zet({ vorm: undefined })">Alles</button>
        <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': vorm === 'online' }" data-test="af-vorm-online" @click="zet({ vorm: vorm === 'online' ? undefined : 'online' })">Online</button>
        <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': vorm === 'telefoon' }" data-test="af-vorm-telefoon" @click="zet({ vorm: vorm === 'telefoon' ? undefined : 'telefoon' })">Telefoon</button>
      </div>
      <div v-if="soorten.length" class="filter-groep" role="group" :aria-label="soortLabel">
        <span class="filter-label">{{ soortLabel }}</span>
        <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': !soort }" data-test="af-soort-alles" @click="zet({ soort: undefined })">Alles</button>
        <button v-for="s in soorten" :key="s.slug" type="button" class="filter-pil" :class="{ 'filter-pil--aan': soort === s.slug }" :aria-pressed="soort === s.slug" :data-test="`af-soort-${s.slug}`" @click="zet({ soort: soort === s.slug ? undefined : s.slug })">{{ s.naam }}</button>
      </div>
      <div v-if="bereik.manager" class="filter-groep" role="group" aria-label="Bereik">
        <span class="filter-label">Bereik</span>
        <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': bereik.scope === 'eigen' }" data-test="af-scope-eigen" @click="zet({ scope: undefined, persoon: undefined })">Eigen</button>
        <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': bereik.scope === 'team' && !bereik.persoon }" data-test="af-scope-team" @click="zet({ scope: 'team', persoon: undefined })">Team</button>
        <button v-for="l in bereik.leden" :key="l.id" type="button" class="filter-pil" :class="{ 'filter-pil--aan': bereik.persoon === l.id }" :data-test="`af-persoon-${l.id}`" @click="zet({ scope: 'team', persoon: bereik.persoon === l.id ? undefined : l.id })">{{ l.naam }}</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.af-datum { width: auto; min-height: 36px; }
@media (max-width: 719px) { .af-datum { min-height: 44px; } }
</style>
