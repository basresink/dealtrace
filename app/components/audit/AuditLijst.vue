<script setup lang="ts">
// De auditlijst voor /audit (salesmanager, zijn teams) en /instellingen/audit (beheerder, alles en wat
// Dealtrace deed). Filters Wie, Soort en Periode staan in de url; Meer laden haalt de volgende 50 met
// een cursor; Download geeft de hele selectie als CSV. Lege staat met een uitweg: filters wissen.
import { AUDIT_PERIODEN, AUDIT_SOORT_LABEL, actieTekst, type AuditRegel } from '~~/shared/audit'
import { nlMoment, plusDagen } from '~~/shared/datum'

const props = defineProps<{ bron: string }>()
const route = useRoute()
const router = useRouter()
const toast = useToast()

const filters = computed(() => {
  const q = route.query
  const uit: Record<string, string> = {}
  for (const k of ['persoon', 'soort', 'van', 'tot']) if (typeof q[k] === 'string' && q[k]) uit[k] = q[k] as string
  return uit
})
const zoekQuery = computed(() => new URLSearchParams(filters.value).toString())
const { data, status } = await useFetch<{ regels: AuditRegel[]; volgende: string | null; soorten: string[]; personen: { id: string; naam: string }[] }>(() => `${props.bron}${zoekQuery.value ? `?${zoekQuery.value}` : ''}`, {
  default: () => ({ regels: [], volgende: null, soorten: [], personen: [] }),
})
// Meer laden voegt pagina's toe; een ander filter begint opnieuw.
const extra = ref<AuditRegel[]>([])
const volgende = ref<string | null>(null)
watch(data, (d) => { extra.value = []; volgende.value = d.volgende }, { immediate: true })
const regels = computed(() => [...data.value.regels, ...extra.value])
const laadt = ref(false)
async function meer() {
  if (!volgende.value) return
  laadt.value = true
  try {
    const p = await $fetch<{ regels: AuditRegel[]; volgende: string | null }>(props.bron, { query: { ...filters.value, voor: volgende.value } })
    extra.value.push(...p.regels)
    volgende.value = p.volgende
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { laadt.value = false }
}

function zet(nieuw: Record<string, string | undefined>) { router.replace({ query: { ...route.query, ...nieuw } }) }
function wis() { router.replace({ query: { ...route.query, persoon: undefined, soort: undefined, van: undefined, tot: undefined } }) }
const vandaag = () => nlMoment(new Date()).datum
const periode = computed(() => {
  if (!filters.value.van && !filters.value.tot) return 'alles'
  if (filters.value.tot) return 'eigen'
  return AUDIT_PERIODEN.find((p) => plusDagen(vandaag(), -p.dagen + 1) === filters.value.van)?.sleutel ?? 'eigen'
})
function kiesPeriode(dagen: number | null) { zet({ van: dagen ? plusDagen(vandaag(), -dagen + 1) : undefined, tot: undefined }) }
const heeftFilter = computed(() => Object.keys(filters.value).length > 0)
const csvUrl = computed(() => `${props.bron}?${new URLSearchParams({ ...filters.value, formaat: 'csv' }).toString()}`)
const tijd = (iso: string) => new Date(iso).toLocaleString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })
const telling = computed(() => `${regels.value.length} ${regels.value.length === 1 ? 'regel' : 'regels'}${volgende.value ? ', er zijn er meer' : ''}`)
</script>

<template>
  <div class="au">
    <div class="filters au-filters" data-test="audit-filters">
      <div class="filter-groep">
        <label class="au-veld"><span class="filter-label">Wie</span>
          <select class="invoer invoer--klein" data-test="audit-wie" :value="filters.persoon ?? ''" @change="zet({ persoon: ($event.target as HTMLSelectElement).value || undefined })">
            <option value="">Iedereen</option><option v-for="p in data.personen" :key="p.id" :value="p.id">{{ p.naam }}</option>
          </select>
        </label>
        <label class="au-veld"><span class="filter-label">Soort</span>
          <select class="invoer invoer--klein" data-test="audit-soort" :value="filters.soort ?? ''" @change="zet({ soort: ($event.target as HTMLSelectElement).value || undefined })">
            <option value="">Alles</option><option v-for="s in data.soorten" :key="s" :value="s">{{ AUDIT_SOORT_LABEL[s] ?? s }}</option>
          </select>
        </label>
      </div>
      <div class="filter-groep" data-test="audit-periode">
        <span class="filter-label">Periode</span>
        <button v-for="p in AUDIT_PERIODEN" :key="p.sleutel" type="button" class="filter-pil" :class="{ 'filter-pil--aan': periode === p.sleutel }" :aria-pressed="periode === p.sleutel" :data-test="`audit-periode-${p.sleutel}`" @click="kiesPeriode(p.dagen)">{{ p.label }}</button>
        <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': periode === 'alles' }" :aria-pressed="periode === 'alles'" data-test="audit-periode-alles" @click="kiesPeriode(null)">Alles</button>
        <label class="au-veld au-datum"><span class="filter-label">Van</span><input type="date" class="invoer invoer--klein" data-test="audit-van" :value="filters.van ?? ''" @change="zet({ van: ($event.target as HTMLInputElement).value || undefined })"></label>
        <label class="au-veld au-datum"><span class="filter-label">Tot en met</span><input type="date" class="invoer invoer--klein" data-test="audit-tot" :value="filters.tot ?? ''" @change="zet({ tot: ($event.target as HTMLInputElement).value || undefined })"></label>
      </div>
    </div>

    <div class="au-balk mt-16">
      <span class="meta" aria-live="polite" data-test="audit-telling">{{ status === 'pending' ? 'Laden…' : telling }}</span>
      <div class="dd-acties">
        <button v-if="heeftFilter" type="button" class="dd-act" data-test="audit-wis" @click="wis">Wis filters</button>
        <a v-if="regels.length" class="dd-act" :href="csvUrl" download data-test="audit-download"><Icoon naam="Download" :grootte="14" />Download CSV</a>
      </div>
    </div>

    <LegeStaat v-if="!regels.length && status !== 'pending'" class="mt-16" data-test="audit-leeg" :titel="heeftFilter ? 'Niets gevonden met deze filters.' : 'Nog geen auditregels.'" :tekst="heeftFilter ? 'Kies een langere periode of een andere soort.' : 'Elke wijziging in de inrichting en bij je prospects komt hier te staan, met wie het deed en wanneer.'">
      <button v-if="heeftFilter" type="button" class="dd-actie dd-actie--secundair mt-16" @click="wis">Wis filters</button>
    </LegeStaat>
    <div v-else-if="regels.length" class="tabel-wrap mt-16">
      <table class="tabel tabel--kaarten" data-test="audit-tabel">
        <thead><tr><th>Wanneer</th><th>Wie</th><th>Wat</th><th>Reden</th></tr></thead>
        <tbody>
          <tr v-for="r in regels" :key="r.id" data-test="audit-regel" :data-actie="r.actie">
            <td class="tnum meta">{{ tijd(r.op) }}</td>
            <td><strong>{{ r.door || 'Onbekend' }}</strong> <span v-if="r.leverancier" class="pil">Dealtrace</span></td>
            <td>{{ actieTekst(r.actie) }}<span v-if="r.objectId" class="meta au-object"> · {{ r.object }} {{ r.objectId }}</span></td>
            <td>{{ r.reden ?? '' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="volgende" class="mt-16 au-meer">
      <button type="button" class="dd-actie dd-actie--secundair" :disabled="laadt" data-test="audit-meer" @click="meer">{{ laadt ? 'Laden…' : 'Meer laden' }}</button>
    </div>
  </div>
</template>

<style scoped>
.au-filters { display: flex; flex-wrap: wrap; gap: 12px 24px; }
.au-veld { display: inline-flex; align-items: center; gap: 8px; }
.au-balk { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
.au-object { word-break: break-all; }
.au-meer { display: flex; justify-content: center; }
@media (max-width: 719px) {
  .au-veld { width: 100%; justify-content: space-between; }
  .au-veld .invoer { flex: 1; min-height: 44px; max-width: 70%; }
  .au-filters .filter-pil { min-height: 44px; }
}
</style>
