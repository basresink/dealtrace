<script setup lang="ts">
// Analyse (P21, F20) in de opzet van de app: tabbladen Funnel, Activiteit, Campagnes, Scripts, Regels en
// agents, Reizen, Bronnen, Regio en Prospectmix. De kop zegt per tabblad wat de cijfers laten zien, vier
// klikbare cijfers tonen in een flyout waaruit ze bestaan, "Wat valt op" noemt de uitschieters (alles uit
// shared/managerOverzicht.ts, met precies de rijen van de server) en daaronder de tabellen met Download
// CSV. Filters (periode, team, persoon) staan in de link.
import { analyseBeeld, kortNaam, KANAAL_LABEL, type AnalyseTabel } from '~~/shared/managerOverzicht'
import type { MfGroep } from '~/components/team/ManagerFilters.vue'
import type { FilterChip } from '~/components/team/FilterChips.vue'
import type { CijferRegel } from '~/components/team/CijferFlyout.vue'

const { functie } = useMe()
const aan = computed(() => !!functie('nav.analyse')?.beschikbaar)
const route = useRoute()
const router = useRouter()
const toast = useToast()
const scherm = useSchermklasse()
const TABS = [['funnel', 'Funnel'], ['activiteit', 'Activiteit'], ['campagnes', 'Campagnes'], ['scripts', 'Scripts'], ['regels', 'Regels en agents'], ['reizen', 'Reizen'], ['bronnen', 'Bronnen'], ['regio', 'Regio'], ['prospectmix', 'Prospectmix']] as const
const tab = computed(() => (TABS.some(([k]) => k === route.query.tab) ? String(route.query.tab) : 'funnel'))
const q = (k: string) => (typeof route.query[k] === 'string' ? (route.query[k] as string) : '')
const filters = computed(() => ({ periode: q('periode') || undefined, team: q('team') || undefined, persoon: q('persoon') || undefined }))
const { data, refresh } = await useFetch<any>(() => `/api/analyse/${tab.value === 'regio' ? 'funnel' : tab.value}`, { query: filters, immediate: aan.value, default: () => ({ tabellen: [] }) })
const { data: team } = await useFetch<any>('/api/coaching', { immediate: aan.value, default: () => ({ teams: [], leden: [] }) })
function zet(p: Record<string, string | undefined>) { const n: Record<string, any> = { ...route.query, ...p }; for (const k of Object.keys(n)) if (!n[k]) delete n[k]; router.replace({ query: n }) }
// Regio woont in de bezoekanalyse; ook een directe link met ?tab=regio gaat erheen.
watch(tab, (t) => { if (t === 'regio') navigateTo('/bezoek-analyse?scope=team') }, { immediate: true })
const csv = (i: number) => `/api/analyse/${tab.value}?${new URLSearchParams({ ...(Object.fromEntries(Object.entries(filters.value).filter(([, v]) => v)) as Record<string, string>), formaat: 'csv', tabel: String(i) }).toString()}`
async function besluit(id: string, b: string) { try { const r = await $fetch<any>(`/api/analyse/voorstellen/${id}`, { method: 'POST', body: { besluit: b } }); toast.toon(b === 'accepteer' ? 'Geaccepteerd. Er staat een conceptversie van de reis klaar.' : b === 'later' ? 'Het voorstel komt over 30 dagen terug.' : 'Voorstel afgewezen.'); if (r.conceptId) navigateTo(`/reizen/${r.conceptId}`); else refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') } }

// ── Filters ─────────────────────────────────────────────────────────────────
const PERIODES = [['week', 'Deze week'], ['maand', 'Deze maand'], ['kwartaal', 'Kwartaal']] as const
const periode = computed(() => q('periode') || 'maand')
const leden = computed(() => (team.value.leden as any[]).filter((l) => !q('team') || l.team?.id === q('team')))
const groepen = computed<MfGroep[]>(() => [
  { id: 'periode', label: 'Periode', opties: PERIODES.map(([k, l]) => ({ k, l })) },
  ...(team.value.teams.length > 1 ? [{ id: 'team', label: 'Team', opties: [{ k: '', l: 'Al mijn teams' }, ...team.value.teams.map((t: any) => ({ k: t.id, l: t.naam }))] }] : []),
  { id: 'persoon', label: 'Persoon', opties: [{ k: '', l: 'Iedereen' }, ...leden.value.map((l) => ({ k: l.id, l: kortNaam(l.naam) }))] },
])
const isAan = (g: string, k: string) => (g === 'periode' ? periode.value === k : q(g) === k)
function zetFilter(g: string, k: string) {
  if (g === 'periode') zet({ periode: k === 'maand' ? undefined : k })
  else if (g === 'team') zet({ team: k || undefined, persoon: undefined })
  else zet({ [g]: k || undefined })
}
const chips = computed<FilterChip[]>(() => [
  ...(q('periode') ? [{ sleutel: 'periode', label: 'Periode', tekst: PERIODES.find(([k]) => k === periode.value)?.[1] ?? periode.value, wis: () => zet({ periode: undefined }) }] : []),
  ...(q('team') ? [{ sleutel: 'team', label: 'Team', tekst: team.value.teams.find((t: any) => t.id === q('team'))?.naam ?? q('team'), wis: () => zet({ team: undefined, persoon: undefined }) }] : []),
  ...(q('persoon') ? [{ sleutel: 'persoon', label: 'Persoon', tekst: kortNaam(team.value.leden.find((l: any) => l.id === q('persoon'))?.naam ?? q('persoon')), wis: () => zet({ persoon: undefined }) }] : []),
])
const wisAlles = () => zet({ periode: undefined, team: undefined, persoon: undefined })
const filtersOpen = ref(false)
const bereikTekst = computed(() => (q('persoon') ? kortNaam(team.value.leden.find((l: any) => l.id === q('persoon'))?.naam ?? '') : q('team') ? team.value.teams.find((t: any) => t.id === q('team'))?.naam : team.value.teams.length > 1 ? 'Al je teams' : team.value.teams[0]?.naam) ?? '')
const kicker = computed(() => ['Analyse', TABS.find(([k]) => k === tab.value)?.[1], PERIODES.find(([k]) => k === periode.value)?.[1], bereikTekst.value].filter(Boolean).join(' · '))

// ── Wat de cijfers zeggen ───────────────────────────────────────────────────
const tabellen = computed<AnalyseTabel[]>(() => data.value.tabellen ?? [])
// Regio leest de funneldata tot de doorverwijzing: dan ook de funnelkop, niet "8 regels in funnel van de prospectreis".
const beeld = computed(() => analyseBeeld(tab.value === 'regio' ? 'funnel' : tab.value, tabellen.value, data.value.melding))
const cijfer = ref<{ kicker: string; titel: string; regels: CijferRegel[] } | null>(null)
function openTegel(t: { titel: string; label: string; regels: { label: string; waarde: string; meta?: string }[] }) { cijfer.value = { kicker: kicker.value, titel: t.titel, regels: t.regels.map((r, i) => ({ id: String(i), ...r })) } }
// Leesbare waarden in de tabel (het kanaal); de CSV houdt de ruwe waarden.
const toon = (k: string, v: unknown) => (k === 'kanaal' && typeof v === 'string' ? KANAAL_LABEL[v] ?? v : v === '' || v == null ? '-' : v)
useHead({ title: 'Analyse · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="nav.analyse" />
    <template v-else>
      <PaginaKop :titel="beeld.titel" :uitleg="beeld.lede" helpartikel="analyse-lezen">
        <template #kicker><span class="kicker kicker--streep" data-test="analyse-kicker">{{ kicker }}</span></template>
        <template #acties>
          <a v-if="tabellen[0]?.rijen.length" class="dd-actie dd-actie--primair" :href="csv(0)" download data-test="analyse-download"><Icoon naam="Download" class="dd-actie-icoon" />Download CSV</a>
          <button type="button" class="dd-actie dd-actie--secundair" :class="{ 'mp-filterknop--aan': filtersOpen || chips.length }" :aria-expanded="filtersOpen" data-test="analyse-filters" @click="filtersOpen = !filtersOpen">
            <Icoon naam="SlidersHorizontal" class="dd-actie-icoon" />Filters<span v-if="chips.length" class="mp-teller">{{ chips.length }}</span>
          </button>
        </template>
      </PaginaKop>

      <ManagerFilters v-if="filtersOpen" test="af" :groepen="groepen" :aan="isAan" :blad="scherm === 'telefoon'" :wisbaar="chips.length > 0" toon="Toon de analyse" @zet="zetFilter" @wis="wisAlles" @sluit="filtersOpen = false" />

      <section class="section section--laatste">
        <div class="container">
          <nav class="tabbalk an-tabs" aria-label="Tabbladen"><button v-for="[k, l] in TABS.filter(([x]) => x !== 'regio' || $magNaar('/bezoek-analyse'))" :key="k" type="button" class="tab" :class="{ 'tab--actief': tab === k }" :aria-current="tab === k ? 'page' : undefined" :data-test="`tab-${k}`" @click="zet({ tab: k === 'funnel' ? undefined : k })">{{ l }}</button></nav>
          <FilterChips v-if="chips.length" test="analyse" :aantal="tabellen[0]?.rijen.length ?? 0" een="regel" meer="regels" :chips="chips" class="mt-16" @wis="wisAlles" />

          <LegeStaat v-if="!beeld.tegels.length && !tabellen.some((t) => t.rijen.length)" class="mt-16" kicker="Nog leeg" titel="Nog niets om te analyseren in deze periode." :tekst="chips.length ? 'Kies een langere periode of iedereen in je teams.' : 'Zodra je team belt, mailt en afspraken maakt, verschijnen hier de cijfers. Kies anders een langere periode.'" data-test="analyse-leeg">
            <button v-if="chips.length" type="button" class="dd-act mt-8" @click="wisAlles">Wis de filters</button>
          </LegeStaat>
          <template v-else>
            <div v-if="beeld.tegels.length" class="stat-grid stat-grid--4 mt-16" data-test="analyse-cijfers">
              <button v-for="t in beeld.tegels" :key="t.sleutel" type="button" class="stat-card" :data-test="`analyse-cijfer-${t.sleutel}`" @click="openTegel(t)">
                <span class="stat-label">{{ t.label }}</span><span class="stat-num tnum" :class="{ 'tekst-rood': t.rood }">{{ t.waarde }}</span><span v-if="t.voet" class="stat-foot">{{ t.voet }}</span>
              </button>
            </div>

            <div v-if="beeld.opvallend.length" class="mp-blok" data-test="analyse-opvallend">
              <header class="mp-blokkop"><h2 class="mp-bloktitel">Wat valt op</h2><span class="meta">Uit dezelfde cijfers als de tabellen hieronder.</span></header>
              <ul class="kaart mp-lijst">
                <li v-for="o in beeld.opvallend" :key="o"><div class="item-rij mp-rij"><span class="item-icoon"><Icoon naam="Lightbulb" /></span><span class="item-body"><span class="item-naam">{{ o }}</span></span></div></li>
              </ul>
            </div>

            <article v-if="tab === 'reizen' && functie('analyse.verbetervoorstel')?.beschikbaar" class="kaart mp-blok" data-test="verbetervoorstellen">
              <header class="kaart-kop"><h2 class="kaart-titel">Verbetervoorstellen van de Coach</h2><Label soort="ai" waarde="agent" tekst="De Coach" /></header>
              <LegeStaat v-if="!data.voorstellen?.length" titel="Geen open voorstellen." tekst="De Coach kijkt elke eerste van de maand naar reisversies met minstens 20 accounts en stelt hoogstens één verbetering per versie voor." />
              <ul v-else class="mp-lijst">
                <li v-for="v in data.voorstellen" :key="v.id">
                  <div class="item-rij mp-rij">
                    <span class="item-icoon"><Icoon naam="Sparkles" /></span>
                    <span class="item-body"><span class="item-naam">{{ v.titel }}</span><span class="item-meta">{{ v.voorstel }}</span><span class="item-meta">{{ (v.onderbouwing?.cijfers ?? []).join(' · ') }}</span><span class="pil-tags"><Label soort="ai" waarde="voorstel" /></span></span>
                    <span class="item-acties"><button type="button" class="dd-act dd-act--primair" @click="besluit(v.id, 'accepteer')">Accepteer</button><button type="button" class="dd-act" @click="besluit(v.id, 'wijs-af')">Wijs af</button><button type="button" class="dd-act" @click="besluit(v.id, 'later')">Later</button></span>
                  </div>
                </li>
              </ul>
            </article>

            <article v-for="(t, i) in tabellen" :key="t.titel" class="kaart mp-blok" :data-test="`analyse-tabel-${i}`">
              <header class="kaart-kop"><h2 class="kaart-titel">{{ t.titel }}</h2><a class="dd-act" :href="csv(i)" download :data-test="`csv-${i}`"><Icoon naam="Download" :grootte="14" /> CSV</a></header>
              <LegeStaat v-if="!t.rijen.length" titel="Nog niets in deze periode." />
              <div v-else class="tabel-schuif">
                <table class="tabel tabel--kaarten an-tabel">
                  <thead><tr><th v-for="k in t.kolommen" :key="k.sleutel" :class="{ tnum: k.getal }">{{ k.label }}</th></tr></thead>
                  <tbody><tr v-for="(r, j) in t.rijen" :key="j"><td v-for="k in t.kolommen" :key="k.sleutel" :class="{ tnum: k.getal, meta: r[k.sleutel] === 'Te weinig om te vergelijken' }" :data-label="k.label">{{ toon(k.sleutel, r[k.sleutel]) }}</td></tr></tbody>
                </table>
              </div>
            </article>
          </template>
        </div>
      </section>
      <CijferFlyout :open="!!cijfer" :kicker="cijfer?.kicker ?? ''" :titel="cijfer?.titel ?? ''" :regels="cijfer?.regels ?? []" @sluit="cijfer = null" />
    </template>
  </div>
</template>

<style scoped>
.mp-filterknop--aan { background: var(--ink); color: var(--yellow); border-color: var(--ink); }
.mp-teller { display: inline-flex; align-items: center; height: 18px; padding: 0 7px; margin-left: 2px; background: var(--yellow); color: var(--ink); font-size: 11px; font-weight: 800; border-radius: 2px; }
.an-tabs { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }
.an-tabs .tab { flex: 0 0 auto; }
.mp-blok { margin-top: 32px; }
.mp-blokkop { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 16px; margin: 0 0 12px; padding-bottom: 8px; border-bottom: 2px solid var(--ink); }
.mp-bloktitel { margin: 0; font-family: var(--font-serif); font-size: 20px; }
.mp-lijst { list-style: none; margin: 0; padding-top: 4px; padding-bottom: 4px; }
.mp-rij { grid-template-columns: 36px minmax(0, 1fr) auto; align-items: center; }
@media (max-width: 599px) { .mp-rij { grid-template-columns: 36px minmax(0, 1fr); } .mp-rij > .item-acties { grid-column: 2; } }
@media (max-width: 719px) { .an-tabs .tab { min-height: var(--touch-target-min); } }
@media (max-width: 767px) {
  .an-tabel td { display: flex; justify-content: space-between; gap: 12px; }
  .an-tabel td::before { content: attr(data-label); font-size: 12px; font-weight: 600; color: var(--muted); }
  .an-tabel td:first-child { font-weight: 700; }
  .an-tabel td:first-child::before { content: none; }
}
</style>
