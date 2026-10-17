<script setup lang="ts">
// Audit (P21) in de opzet van de app: wie veranderde wat in je teams. De kop zegt hoeveel er de laatste
// zeven dagen veranderde en wie het meest; de cijfers per persoon tonen in een flyout wat die persoon
// veranderde en zetten met één klik het filter. Daaronder de gedeelde AuditLijst (filters Wie, Soort en
// Periode in de link, paging en CSV); de filters staan achter de knop Filters. De beheerder heeft één
// auditscherm: /instellingen/audit (alles, ook wat Dealtrace deed); daar gaat hij heen.
import { actieTekst, type AuditRegel } from '~~/shared/audit'
import { nlMoment, plusDagen } from '~~/shared/datum'
import { kortNaam, opsomming, voornaam } from '~~/shared/managerOverzicht'
import type { CijferRegel } from '~/components/team/CijferFlyout.vue'

const { functie } = useMe()
const aan = computed(() => !!functie('nav.audit')?.beschikbaar)
if (functie('instellingen.audit')?.beschikbaar) await navigateTo({ path: '/instellingen/audit', query: useRoute().query }, { replace: true })
const route = useRoute()
const router = useRouter()

// De stand van de laatste zeven dagen (eerste pagina van 50, met `volgende` als er meer zijn).
const week = plusDagen(nlMoment(new Date()).datum, -6)
const { data: stand } = await useFetch<{ regels: AuditRegel[]; volgende: string | null; personen: { id: string; naam: string }[] }>('/api/audit', { query: { van: week }, immediate: aan.value, default: () => ({ regels: [], volgende: null, personen: [] }) })
const aantalTekst = computed(() => (stand.value.volgende ? `Meer dan ${stand.value.regels.length}` : String(stand.value.regels.length)))
const perPersoon = computed(() => {
  const m = new Map<string, AuditRegel[]>()
  for (const r of stand.value.regels) m.set(r.door || 'Onbekend', [...(m.get(r.door || 'Onbekend') ?? []), r])
  return [...m.entries()].map(([naam, regels]) => ({ naam, regels, id: stand.value.personen.find((p) => p.naam === naam)?.id ?? null })).sort((a, b) => b.regels.length - a.regels.length)
})
const titel = computed(() => {
  const n = stand.value.regels.length
  if (!n) return 'De laatste zeven dagen veranderde er niets in je teams.'
  return `${aantalTekst.value} ${n === 1 && !stand.value.volgende ? 'wijziging' : 'wijzigingen'} in je teams in de laatste zeven dagen.`
})
const lede = computed(() => {
  const top = perPersoon.value.slice(0, 3)
  if (!top.length) return 'Wijzigingen van en bij de mensen in je teams: fases, eigenaren, niveaus, regels en wat er werd gearchiveerd.'
  return `Het meest actief${stand.value.volgende ? ` in de laatste ${stand.value.regels.length}` : ''}: ${opsomming(top.map((p) => `${voornaam(p.naam)} (${p.regels.length})`))}. Hieronder de hele lijst met wie, wat en waarom.`
})

const filtersOpen = ref(['persoon', 'soort', 'van', 'tot'].some((k) => route.query[k]))
const filterTeller = computed(() => ['persoon', 'soort', 'van', 'tot'].filter((k) => route.query[k]).length)
const csvUrl = computed(() => `/api/audit?${new URLSearchParams({ ...Object.fromEntries(['persoon', 'soort', 'van', 'tot'].filter((k) => typeof route.query[k] === 'string' && route.query[k]).map((k) => [k, String(route.query[k])])), formaat: 'csv' }).toString()}`)

const tijd = (iso: string) => new Date(iso).toLocaleString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })
const venster = ref<{ titel: string; regels: CijferRegel[] } | null>(null)
function openPersoon(p: { naam: string; regels: AuditRegel[]; id: string | null }) {
  const regels: CijferRegel[] = p.regels.map((r) => ({ id: r.id, label: actieTekst(r.actie), meta: [tijd(r.op), r.reden].filter(Boolean).join(' · ') }))
  if (p.id) regels.unshift({ id: 'filter', label: `Toon alleen ${voornaam(p.naam)} in de lijst`, meta: 'Zet het filter Wie en de periode op 7 dagen', klik: () => { venster.value = null; filtersOpen.value = true; router.replace({ query: { ...route.query, persoon: p.id!, van: week, tot: undefined } }) } })
  venster.value = { titel: `${kortNaam(p.naam)}: ${p.regels.length} ${p.regels.length === 1 ? 'wijziging' : 'wijzigingen'}${stand.value.volgende ? ` in de laatste ${stand.value.regels.length}` : ''}`, regels }
}
useHead({ title: 'Audit · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="nav.audit" />
    <template v-else>
      <PaginaKop :titel="titel" :uitleg="lede" helpartikel="audit">
        <template #kicker><span class="kicker kicker--streep" data-test="audit-kicker">Audit · Je teams · Laatste 7 dagen</span></template>
        <template #acties>
          <a class="dd-actie dd-actie--primair" :href="csvUrl" download data-test="audit-kop-download"><Icoon naam="Download" class="dd-actie-icoon" />Download CSV</a>
          <button type="button" class="dd-actie dd-actie--secundair" :class="{ 'mp-filterknop--aan': filtersOpen || filterTeller }" :aria-expanded="filtersOpen" data-test="audit-filters-knop" @click="filtersOpen = !filtersOpen">
            <Icoon naam="SlidersHorizontal" class="dd-actie-icoon" />Filters<span v-if="filterTeller" class="mp-teller">{{ filterTeller }}</span>
          </button>
        </template>
      </PaginaKop>
      <section class="section section--laatste">
        <div class="container">
          <div v-if="perPersoon.length" class="stat-grid stat-grid--4" data-test="audit-cijfers">
            <button v-for="p in perPersoon.slice(0, 4)" :key="p.naam" type="button" class="stat-card" :data-test="`audit-cijfer-${p.id ?? 'onbekend'}`" @click="openPersoon(p)">
              <span class="stat-label">{{ kortNaam(p.naam) }}</span><span class="stat-num tnum">{{ p.regels.length }}</span><span class="stat-foot">{{ stand.volgende ? `van de laatste ${stand.regels.length}` : 'deze week' }} · laatst {{ p.regels[0] ? actieTekst(p.regels[0].actie).toLowerCase() : '' }}</span>
            </button>
          </div>
          <div class="mp-blok au-pagina" :class="{ 'au-pagina--filters': filtersOpen }">
            <header class="mp-blokkop"><h2 class="mp-bloktitel">Alle wijzigingen</h2><span class="meta">Nieuwste eerst, 50 per keer.</span></header>
            <AuditLijst bron="/api/audit" :verborgen-filters="!filtersOpen" />
          </div>
        </div>
      </section>
      <CijferFlyout :open="!!venster" kicker="Audit · Laatste 7 dagen" :titel="venster?.titel ?? ''" :regels="venster?.regels ?? []" @sluit="venster = null" />
    </template>
  </div>
</template>

<style scoped>
.mp-filterknop--aan { background: var(--ink); color: var(--yellow); border-color: var(--ink); }
.mp-teller { display: inline-flex; align-items: center; height: 18px; padding: 0 7px; margin-left: 2px; background: var(--yellow); color: var(--ink); font-size: 11px; font-weight: 800; border-radius: 2px; }
.mp-blok { margin-top: 32px; }
.stat-grid + .mp-blok { margin-top: 32px; }
.mp-blok:first-child { margin-top: 0; }
.mp-blokkop { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 16px; margin: 0 0 12px; padding-bottom: 8px; border-bottom: 2px solid var(--ink); }
.mp-bloktitel { margin: 0; font-family: var(--font-serif); font-size: 20px; }
.au-pagina--filters :deep(.au-filters) { padding: 16px 18px; background: var(--wit); border: 1px solid var(--border); border-radius: var(--radius); }
</style>
