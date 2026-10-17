<script setup lang="ts">
// Accountplannen in de opzet van DealDrive (/accountplannen): kop met het aantal actuele plannen, Zoeken en
// "+ Accountplan"; daaronder twee groepen, Actueel en Verlopen en afgerond, met een kaart per plan (soort en
// status als pil, eigenaar, naam, account, geldigheid en de voortgang van het actieplan). Een klik op de kaart
// opent het plan in een venster; "Open accountplan" gaat naar de volledige pagina. Filters (in de URL): status
// (Alle, Actueel, Verlopen, Afgerond) en Alleen mijn plannen. Een nieuw plan opent na aanmaken in het venster.
// Alleen voor Expert.
import { PLAN_FILTERS, filterPlannen, geldigheidLabel, WEERGAVE_LABEL, type PlanFilter } from '~~/shared/accountplannen'
const { functie } = useMe()
const aan = !!functie('nav.accountplannen')?.beschikbaar
const route = useRoute()
const router = useRouter()
const status = computed<PlanFilter>(() => (PLAN_FILTERS.some((f) => f.id === route.query.status) ? route.query.status as PlanFilter : 'alle'))
const alleenMijn = computed(() => route.query.van === 'mij')
const { data, refresh } = await useFetch<any>('/api/accountplannen', { query: computed(() => (alleenMijn.value ? { van: 'mij' } : {})), immediate: aan, default: () => ({ plannen: [], actueel: 0 }) })
const zichtbaar = computed<any[]>(() => filterPlannen<any>(data.value.plannen, status.value))
const actueel = computed(() => zichtbaar.value.filter((p: any) => p.weergave === 'actueel'))
const historie = computed(() => zichtbaar.value.filter((p: any) => p.weergave !== 'actueel'))
const filtersOpen = ref(false)
const filterTeller = computed(() => (status.value !== 'alle' ? 1 : 0) + (alleenMijn.value ? 1 : 0))
const telVoor = (f: PlanFilter) => filterPlannen(data.value.plannen, f).length
function zet(q: Record<string, string | undefined>) { router.replace({ query: { ...route.query, ...q } }) }
const GROEPEN = computed(() => [
  { id: 'actueel', titel: 'Actueel', uitleg: 'Plannen die nu lopen. Hier stuur je op.', leeg: status.value === 'alle' ? 'Geen lopend accountplan.' : 'Geen lopend accountplan binnen dit filter.', items: actueel.value },
  { id: 'historie', titel: 'Verlopen en afgerond', uitleg: 'De geldigheid is voorbij of het plan is afgesloten. Evalueer het en open een nieuwe periode.', leeg: status.value === 'alle' ? 'Nog niets afgerond of verlopen.' : 'Niets verlopen of afgerond binnen dit filter.', items: historie.value },
].filter((g) => status.value === 'alle' || g.items.length || (status.value === 'actueel' ? g.id === 'actueel' : g.id === 'historie')))
// Het venster van een plan staat in de URL (?plan=), zodat terug en vernieuwen werken.
const planId = computed(() => (typeof route.query.plan === 'string' ? route.query.plan : null))
function openPlan(id: string | null) { router.replace({ query: { ...route.query, plan: id ?? undefined } }) }
const nieuwOpen = ref(false)
async function aangemaakt(id: string) { nieuwOpen.value = false; await refresh(); openPlan(id) }
useHead({ title: 'Accountplannen · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="nav.accountplannen" />
    <template v-else>
      <PaginaKop :kicker="`Accountplannen · ${data.actueel} actueel`" titel="Eén plan per topprospect, elke stap aanwijsbaar." uitleg="Een topprospect win je niet met losse acties. Met een plan weet je bij elke stap waarom je hem zet. Plannen voor klanten horen in DealDrive." helpartikel="accountplannen">
        <template #acties>
          <button type="button" class="dd-actie dd-actie--primair" data-test="ap-nieuw" @click="nieuwOpen = true"><Icoon naam="Plus" class="dd-actie-icoon" />Accountplan</button>
          <button type="button" class="dd-actie dd-actie--secundair" :aria-expanded="filtersOpen" data-test="ap-filters" @click="filtersOpen = !filtersOpen">
            <Icoon naam="SlidersHorizontal" class="dd-actie-icoon" />Filters<span v-if="filterTeller" class="pil-teller pil-teller--geel">{{ filterTeller }}</span>
          </button>
        </template>
      </PaginaKop>

      <section v-if="filtersOpen" class="section section--filter" data-test="ap-filterpaneel">
        <div class="container filters">
          <div class="filter-groep" role="radiogroup" aria-label="Status">
            <span class="filter-label">Status</span>
            <button v-for="f in PLAN_FILTERS" :key="f.id" type="button" role="radio" class="filter-pil" :class="{ 'filter-pil--aan': status === f.id }" :aria-checked="status === f.id" :data-test="`ap-filter-${f.id}`" @click="zet({ status: f.id === 'alle' ? undefined : f.id })">{{ f.label }} <span class="tnum">{{ telVoor(f.id) }}</span></button>
          </div>
          <div class="filter-groep">
            <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': alleenMijn }" :aria-pressed="alleenMijn" data-test="ap-filter-mij" @click="zet({ van: alleenMijn ? undefined : 'mij' })">Alleen mijn plannen</button>
          </div>
        </div>
      </section>

      <section class="section section--laatste">
        <div class="container">
          <LegeStaat v-if="!data.plannen.length" kicker="Nog niets" titel="Er is nog geen accountplan." tekst="Begin bij de prospect waar het meest op het spel staat. Eén plan per periode is genoeg. Een plan dat je niet evalueert, is een document en geen sturing." data-test="ap-leeg">
            <button type="button" class="dd-actie dd-actie--zwart" @click="nieuwOpen = true"><Icoon naam="Plus" class="dd-actie-icoon" />Eerste accountplan</button>
          </LegeStaat>
          <template v-else>
            <div v-for="g in GROEPEN" :key="g.id" class="ap-groep" :data-test="`ap-groep-${g.id}`">
              <div class="ap-groep-kop"><h2 class="ap-groep-titel">{{ g.titel }}</h2><span class="ap-groep-aantal tnum">{{ g.items.length }}</span></div>
              <p class="ap-groep-uitleg">{{ g.uitleg }}</p>
              <div v-if="!g.items.length" class="ap-groep-leeg" :data-test="`ap-leeg-${g.id}`">{{ g.leeg }}</div>
              <ul v-else class="ap-lijst" role="list">
                <li v-for="p in g.items" :key="p.id" class="ap-kaart" :class="`ap-kaart--${p.weergave}`" :data-test="`ap-kaart-${p.id}`">
                  <button type="button" class="ap-knop" :aria-label="`${p.titel} openen`" @click="openPlan(p.id)">
                    <span class="ap-kop">
                      <span class="ap-pillen">
                        <Label soort="account" :waarde="p.account.soort === 'klant' ? 'klant' : 'prospect'" />
                        <Label soort="plan" :waarde="p.weergave" :tekst="WEERGAVE_LABEL[p.weergave as 'actueel']" />
                      </span>
                      <span class="ap-eigenaar">{{ p.eigenaar?.naam ?? 'Niet toegewezen' }}</span>
                    </span>
                    <span class="ap-naam">{{ p.titel }}</span>
                    <span class="ap-account">{{ p.account.naam }}</span>
                    <span class="ap-geldig tnum"><strong>Geldig:</strong> {{ geldigheidLabel(p) }}</span>
                    <span class="ap-voortgang">
                      <span class="ap-cijfers">
                        <span class="ap-cijfer"><span class="ap-num tnum">{{ p.acties.totaal }}</span><span class="ap-label">acties</span></span>
                        <span class="ap-cijfer"><span class="ap-num tnum">{{ p.acties.klaar }}</span><span class="ap-label">klaar</span></span>
                        <span class="ap-cijfer"><span class="ap-num tnum">{{ p.acties.percentage }}%</span><span class="ap-label">voortgang</span></span>
                      </span>
                      <span class="ap-balk" aria-hidden="true"><span class="ap-vul" :style="{ width: `${p.acties.percentage}%` }" /></span>
                    </span>
                  </button>
                  <FunctieLink als-tekst :to="`/accountplannen/${p.id}`" class="ap-open" :data-test="`ap-open-${p.id}`">Open accountplan <Icoon naam="ArrowRight" :grootte="14" /></FunctieLink>
                </li>
              </ul>
            </div>
          </template>
        </div>
      </section>

      <AccountplanFlyout :plan-id="planId" @sluit="openPlan(null)" @gewijzigd="refresh" @verwijderd="openPlan(null); refresh()" />
      <AccountplanNieuwFlyout :open="nieuwOpen" @sluit="nieuwOpen = false" @aangemaakt="aangemaakt" />
    </template>
  </div>
</template>

<style scoped>
.ap-groep { margin-bottom: 36px; }
.ap-groep:last-child { margin-bottom: 0; }
.ap-groep-kop { display: flex; align-items: baseline; gap: 10px; }
.ap-groep-titel { margin: 0; font-size: 12px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink); }
.ap-groep-aantal { font-size: 12px; font-weight: 700; color: var(--muted); }
.ap-groep-uitleg { margin: 4px 0 14px; font-size: 13px; color: var(--muted); }
.ap-groep-leeg { padding: 20px; background: var(--wit); border: 1px dashed var(--border-strong); font-size: 13px; color: var(--muted); }
.ap-lijst { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr; gap: var(--kaart-gap); }
@media (min-width: 720px) { .ap-lijst { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.ap-kaart { display: flex; flex-direction: column; min-width: 0; background: var(--wit); border: 1px solid var(--border); border-left: 4px solid var(--border-strong); }
.ap-kaart--actueel { border-left-color: var(--yellow); }
.ap-kaart--verlopen { border-left-color: var(--red); }
.ap-kaart--afgerond { border-left-color: var(--ink); }
.ap-knop { display: flex; flex-direction: column; width: 100%; padding: 16px 18px 8px; color: var(--ink); text-align: left; background: transparent; border: 0; font: inherit; cursor: pointer; }
.ap-knop:hover { background: var(--surface); }
.ap-knop:focus-visible { outline: 2px solid var(--ink); outline-offset: -2px; }
.ap-kop { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 8px; }
.ap-pillen { display: inline-flex; flex-wrap: wrap; gap: 6px; }
.ap-eigenaar { font-size: 11px; font-weight: 600; color: var(--muted); text-align: right; }
.ap-naam { font-family: var(--font-serif); font-size: 18px; font-weight: 700; margin-top: 4px; overflow-wrap: anywhere; }
.ap-account { margin-top: 6px; font-size: 13px; color: var(--ink-soft); }
.ap-geldig { margin-top: 6px; font-size: 12px; color: var(--ink-soft); }
.ap-voortgang { display: block; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border); }
.ap-cijfers { display: flex; gap: 20px; }
.ap-cijfer { display: flex; flex-direction: column; }
.ap-num { font-family: var(--font-serif); font-size: 18px; font-weight: 700; line-height: 1; }
.ap-label { font-size: var(--fs-label); font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
.ap-balk { display: block; margin-top: 8px; height: 6px; background: var(--surface); }
.ap-vul { display: block; height: 100%; background: var(--green); transition: width var(--transition-base); }
.ap-open { display: inline-flex; align-items: center; gap: 4px; align-self: flex-start; min-height: 36px; margin: 0 18px 8px; font-size: 12px; font-weight: 700; color: var(--muted); text-decoration: none; }
.ap-open:hover { color: var(--ink); text-decoration: underline; }
@media (max-width: 719px) {
  .ap-open { min-height: var(--touch-target-min); }
  .ap-knop { padding: 16px 16px 8px; }
}
</style>
