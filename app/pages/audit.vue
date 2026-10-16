<script setup lang="ts">
// Audit (P21): wie veranderde wat, met filters op persoon, soort en periode. Op de telefoon staan de filters in een schuifvenster.
const { functie } = useMe()
const aan = computed(() => !!functie('nav.audit')?.beschikbaar)
const route = useRoute()
const router = useRouter()
const query = computed(() => Object.fromEntries(Object.entries(route.query).filter(([k, v]) => ['persoon', 'soort', 'van', 'tot'].includes(k) && v)))
const { data } = await useFetch<any>('/api/audit', { query, immediate: aan.value, default: () => ({ regels: [], soorten: [] }) })
const { data: team } = await useFetch<any>('/api/coaching', { immediate: aan.value, default: () => ({ leden: [] }) })
function zet(k: string, v: string) { router.replace({ query: { ...route.query, [k]: v || undefined } }) }
const filtersOpen = ref(false)
const SOORT: Record<string, string> = { fase: 'Fase', eigenaar: 'Eigenaar', niveau: 'Niveau', regels: 'Regels', scripts: 'Scripts', reizen: 'Reizen', verwijderingen: 'Verwijderingen', leverancier: 'Leverancier' }
const tijd = (iso: string) => new Date(iso).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })
useHead({ title: 'Audit · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="nav.audit" />
    <template v-else>
      <PaginaKop kicker="Audit" titel="Wie veranderde wat" helpartikel="audit">
        <template #acties><button type="button" class="dd-actie dd-actie--secundair alleen-telefoon" @click="filtersOpen = true"><Icoon naam="Filter" class="dd-actie-icoon" />Filters</button></template>
      </PaginaKop>
      <section class="section">
        <div class="container">
          <div class="cp-filters" :class="{ 'au-filters--open': filtersOpen }" data-test="audit-filters">
            <label class="veld"><span class="veld-label">Persoon</span><select class="invoer" :value="route.query.persoon ?? ''" @change="zet('persoon', ($event.target as HTMLSelectElement).value)"><option value="">Iedereen</option><option v-for="l in team.leden" :key="l.id" :value="l.id">{{ l.naam.replace(/^Testgebruiker /, '') }}</option></select></label>
            <label class="veld"><span class="veld-label">Soort</span><select class="invoer" :value="route.query.soort ?? ''" @change="zet('soort', ($event.target as HTMLSelectElement).value)"><option value="">Alles</option><option v-for="s in data.soorten" :key="s" :value="s">{{ SOORT[s] ?? s }}</option></select></label>
            <label class="veld"><span class="veld-label">Van</span><input type="date" class="invoer" :value="route.query.van" @change="zet('van', ($event.target as HTMLInputElement).value)"></label>
            <label class="veld"><span class="veld-label">Tot</span><input type="date" class="invoer" :value="route.query.tot" @change="zet('tot', ($event.target as HTMLInputElement).value)"></label>
            <button type="button" class="dd-act alleen-telefoon" @click="filtersOpen = false">Toon</button>
          </div>
          <LegeStaat v-if="!data.regels.length" class="mt-16" titel="Niets gevonden." tekst="Pas de filters aan." />
          <ul v-else class="schakel-lijst kaart mt-16" data-test="audit-lijst">
            <li v-for="r in data.regels" :key="r.id" class="schakel-rij"><span><strong>{{ r.door }}</strong> · {{ r.actie }}<template v-if="r.objectId"> · {{ r.object }} {{ r.objectId }}</template><template v-if="r.reden"><br><span class="meta">Reden: {{ r.reden }}</span></template></span><span class="meta">{{ tijd(r.op) }}</span></li>
          </ul>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
@media (max-width: 767px) {
  .cp-filters { display: none; }
  .au-filters--open { display: grid; position: fixed; left: 0; right: 0; bottom: 0; z-index: 60; background: var(--bg); padding: 16px; border-top: 1px solid var(--border); }
}
</style>
