<script setup lang="ts">
// Coaching (P21) in de opzet van de app: de kop zegt wie op een coachingsgesprek wacht, vier klikbare cijfers
// (gesprek nodig, open afspraken, achter op tempo, taken over tijd) tonen in een flyout wie erachter zit.
// Daaronder de accountmanagers op volgorde van wie het eerst aan de beurt is, met de reden uit de cijfers
// van de laatste twee weken, en de open afspraken uit eerdere gesprekken. Filters (team, stand, werkplek)
// staan in de link. Eén gesprek per accountmanager per twee weken is de norm (hoofdstuk 16).
import { NIVEAU_LABEL } from '~~/shared/types'
import { coachingKop, coachingLede, coachingRedenen, coachingStand, heeftGesprekNodig, kortNaam, sorteerCoaching, type CoachingLid, type CoachingStand } from '~~/shared/managerOverzicht'
import type { MfGroep } from '~/components/team/ManagerFilters.vue'
import type { FilterChip } from '~/components/team/FilterChips.vue'
import type { CijferRegel } from '~/components/team/CijferFlyout.vue'

const { functie } = useMe()
const aan = computed(() => !!functie('nav.coaching')?.beschikbaar)
const route = useRoute()
const router = useRouter()
const scherm = useSchermklasse()
type Lid = CoachingLid & { team: { id: string; naam: string } | null; afspraken: { id: string; tekst: string; termijn: string | null; overTermijn: boolean }[] }
const { data, refresh } = await useFetch<{ leden: Lid[]; teams: { id: string; naam: string }[]; vandaag?: string }>('/api/coaching', { immediate: aan.value, default: () => ({ leden: [], teams: [] }) })

// ── Filters in de link ──────────────────────────────────────────────────────
const q = (k: string) => (typeof route.query[k] === 'string' ? (route.query[k] as string) : '')
function zet(p: Record<string, string | undefined>) { const n: Record<string, any> = { ...route.query, ...p }; for (const k of Object.keys(n)) if (!n[k]) delete n[k]; router.replace({ query: n }) }
const STANDEN: [string, string][] = [['nodig', 'Gesprek nodig'], ['binnenkort', 'Binnenkort'], ['op-ritme', 'Op ritme']]
const standVan = (l: Lid) => { const s = coachingStand(l); return s === 'nooit' || s === 'te-laat' ? 'nodig' : s }
type Stand = { team: string; stand: string; werkplek: string }
const stand = computed<Stand>(() => ({ team: q('team'), stand: q('stand'), werkplek: q('werkplek') }))
const past = (l: Lid, s: Stand) => (!s.team || l.team?.id === s.team) && (!s.stand || standVan(l) === s.stand) && (!s.werkplek || l.werkplek === s.werkplek)
const tel = (w: Partial<Stand>) => data.value.leden.filter((l) => past(l, { ...stand.value, ...w })).length
const werkplekken = computed(() => [...new Set(data.value.leden.map((l) => l.werkplek).filter(Boolean))].sort())
const groepen = computed<MfGroep[]>(() => [
  ...(data.value.teams.length > 1 ? [{ id: 'team', label: 'Team', opties: [{ k: '', l: 'Alle teams', n: tel({ team: '' }) }, ...data.value.teams.map((t) => ({ k: t.id, l: t.naam, n: tel({ team: t.id }) }))] }] : []),
  { id: 'stand', label: 'Stand', opties: [{ k: '', l: 'Alle', n: tel({ stand: '' }) }, ...STANDEN.map(([k, l]) => ({ k, l, n: tel({ stand: k }) }))] },
  ...(werkplekken.value.length > 1 ? [{ id: 'werkplek', label: 'Werkplek', opties: [{ k: '', l: 'Alle', n: tel({ werkplek: '' }) }, ...werkplekken.value.map((w) => ({ k: w, l: w.charAt(0).toUpperCase() + w.slice(1), n: tel({ werkplek: w }) }))] }] : []),
])
const isAan = (g: string, k: string) => (stand.value as Record<string, string>)[g] === k
const zetFilter = (g: string, k: string) => zet({ [g]: k || undefined })
const chips = computed<FilterChip[]>(() => [
  ...(stand.value.team ? [{ sleutel: 'team', label: 'Team', tekst: data.value.teams.find((t) => t.id === stand.value.team)?.naam ?? stand.value.team, wis: () => zet({ team: undefined }) }] : []),
  ...(stand.value.stand ? [{ sleutel: 'stand', label: 'Stand', tekst: STANDEN.find(([k]) => k === stand.value.stand)?.[1] ?? stand.value.stand, wis: () => zet({ stand: undefined }) }] : []),
  ...(stand.value.werkplek ? [{ sleutel: 'werkplek', label: 'Werkplek', tekst: stand.value.werkplek, wis: () => zet({ werkplek: undefined }) }] : []),
])
const wisAlles = () => zet({ team: undefined, stand: undefined, werkplek: undefined })
const filtersOpen = ref(false)

// ── Lijst en cijfers ────────────────────────────────────────────────────────
const zichtbaar = computed(() => sorteerCoaching(data.value.leden.filter((l) => past(l, stand.value))))
const afspraken = computed(() => zichtbaar.value.flatMap((l) => l.afspraken.map((a) => ({ ...a, lid: l }))).sort((a, b) => Number(b.overTermijn) - Number(a.overTermijn) || String(a.termijn ?? '9').localeCompare(String(b.termijn ?? '9'))))
const kicker = computed(() => ['Coaching', `${data.value.leden.length} ${data.value.leden.length === 1 ? 'accountmanager' : 'accountmanagers'}`, data.value.teams.length > 1 ? `${data.value.teams.length} teams` : data.value.teams[0]?.naam].filter(Boolean).join(' · '))
const STAND_LABEL: Record<CoachingStand, { soort: string; waarde: string; tekst: string }> = {
  nooit: { soort: 'urgentie', waarde: 'over-tijd', tekst: 'Gesprek nodig' },
  'te-laat': { soort: 'urgentie', waarde: 'over-tijd', tekst: 'Gesprek nodig' },
  binnenkort: { soort: 'status', waarde: 'wachtend', tekst: 'Binnenkort' },
  'op-ritme': { soort: 'status', waarde: 'afgerond', tekst: 'Op ritme' },
}
const meta = (l: Lid) => [l.team?.naam, NIVEAU_LABEL[l.niveau as 'beginner'], l.werkplek].filter(Boolean).join(' · ')
const reden = (l: Lid) => coachingRedenen(l).join(' · ')
// In de rij staan stand en tempo al als label en de dagen links; de regel noemt alleen de rest.
const rijReden = (l: Lid) => coachingRedenen(l).filter((r) => !/^(Tempo|Nog nooit|Laatste gesprek)/.test(r)).join(' · ')
const datumKort = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: 'UTC' })

const cijfer = ref<{ kicker: string; titel: string; regels: CijferRegel[]; leeg: string } | null>(null)
const lidRegel = (l: Lid, waarde: string, metaTekst?: string, rood = false): CijferRegel => ({ id: l.id, label: kortNaam(l.naam), waarde, meta: metaTekst ?? reden(l), link: `/coaching/${l.id}`, rood })
const tegels = computed(() => {
  const L = zichtbaar.value
  const nodig = L.filter(heeftGesprekNodig)
  const achter = L.filter((l) => l.tempo?.stand === 'achter')
  const taken = L.filter((l) => (l.achterstallig ?? 0) > 0)
  const laat = afspraken.value.filter((a) => a.overTermijn).length
  return [
    { k: 'nodig', label: 'Gesprek nodig', num: nodig.length, voet: `van ${L.length} · norm elke 14 dagen`, rood: nodig.length > 0,
      open: () => ({ kicker: 'Coaching', titel: 'Wie wacht op een gesprek', leeg: 'Iedereen is de afgelopen twee weken gecoacht.', regels: nodig.map((l) => lidRegel(l, l.dagenSindsGesprek == null ? 'nooit' : `${l.dagenSindsGesprek} d`, undefined, true)) }) },
    { k: 'afspraken', label: 'Open afspraken', num: afspraken.value.length, voet: laat ? `${laat} over de termijn` : 'uit eerdere gesprekken', rood: laat > 0,
      open: () => ({ kicker: 'Coaching', titel: 'Open afspraken uit coaching', leeg: 'Er staan geen afspraken open.', regels: afspraken.value.map((a) => ({ id: a.id, label: a.tekst, waarde: a.termijn ? datumKort(a.termijn) : 'geen termijn', meta: kortNaam(a.lid.naam), link: `/coaching/${a.lid.id}`, rood: a.overTermijn })) }) },
    { k: 'tempo', label: 'Achter op tempo', num: achter.length, voet: 'pogingen in de laatste twee weken', rood: false,
      open: () => ({ kicker: 'Laatste twee weken', titel: 'Tempo tegen de norm', leeg: 'Niemand ligt achter.', regels: [...L].filter((l) => l.tempo && l.tempo.stand !== 'geen').sort((a, b) => a.tempo!.procent - b.tempo!.procent).map((l) => lidRegel(l, `${l.tempo!.procent}%`, `${l.pogingen ?? 0} van ${l.tempo!.norm} pogingen · ${l.afsprakenGemaakt ?? 0} afspraken`, l.tempo!.stand === 'achter')) }) },
    { k: 'taken', label: 'Taken over tijd', num: L.reduce((s, l) => s + (l.achterstallig ?? 0), 0), voet: `bij ${taken.length} ${taken.length === 1 ? 'persoon' : 'personen'}`, rood: false,
      open: () => ({ kicker: 'Nu', titel: 'Taken over tijd per persoon', leeg: 'Niemand heeft taken over tijd.', regels: [...taken].sort((a, b) => (b.achterstallig ?? 0) - (a.achterstallig ?? 0)).map((l) => lidRegel(l, String(l.achterstallig), meta(l))) }) },
  ]
})

// ── Plan een gesprek ────────────────────────────────────────────────────────
const plan = ref<{ voorkeur: string | null } | null>(null)
const planLeden = computed(() => sorteerCoaching(data.value.leden).map((l) => ({ id: l.id, naam: l.naam, reden: reden(l) })))
useHead({ title: 'Coaching · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="nav.coaching" />
    <template v-else>
      <PaginaKop :titel="coachingKop(data.leden)" :uitleg="coachingLede(data.leden)" helpartikel="coachingsgesprek">
        <template #kicker><span class="kicker kicker--streep" data-test="coaching-kicker">{{ kicker }}</span></template>
        <template v-if="data.leden.length" #acties>
          <button type="button" class="dd-actie dd-actie--primair" data-test="coaching-plan" @click="plan = { voorkeur: zichtbaar.find(heeftGesprekNodig)?.id ?? null }"><Icoon naam="CalendarCheck" class="dd-actie-icoon" />Plan gesprek</button>
          <button type="button" class="dd-actie dd-actie--secundair" :class="{ 'mp-filterknop--aan': filtersOpen || chips.length }" :aria-expanded="filtersOpen" data-test="coaching-filters" @click="filtersOpen = !filtersOpen">
            <Icoon naam="SlidersHorizontal" class="dd-actie-icoon" />Filters<span v-if="chips.length" class="mp-teller">{{ chips.length }}</span>
          </button>
        </template>
      </PaginaKop>

      <ManagerFilters v-if="filtersOpen" test="cf" :groepen="groepen" :aan="isAan" :blad="scherm === 'telefoon'" :wisbaar="chips.length > 0" :toon="`Toon ${zichtbaar.length} ${zichtbaar.length === 1 ? 'accountmanager' : 'accountmanagers'}`" @zet="zetFilter" @wis="wisAlles" @sluit="filtersOpen = false" />

      <section class="section section--laatste">
        <div class="container">
          <LegeStaat v-if="!data.leden.length" kicker="Nog geen team" titel="Je bent nog geen eigenaar van een team." tekst="Coaching gaat over de accountmanagers in je eigen teams. Vraag je beheerder om je als salesmanager aan een team te koppelen." data-test="coaching-leeg" />
          <template v-else>
            <div class="stat-grid stat-grid--4" data-test="coaching-cijfers">
              <button v-for="t in tegels" :key="t.k" type="button" class="stat-card" :data-test="`coaching-cijfer-${t.k}`" @click="cijfer = t.open()">
                <span class="stat-label">{{ t.label }}</span><span class="stat-num tnum" :class="{ 'tekst-rood': t.rood }">{{ t.num }}</span><span class="stat-foot">{{ t.voet }}</span>
              </button>
            </div>

            <div class="mp-blok">
              <FilterChips test="coaching" :aantal="zichtbaar.length" een="accountmanager" meer="accountmanagers" :chips="chips" @wis="wisAlles" />
              <header class="mp-blokkop"><h2 class="mp-bloktitel">Wie spreek je als eerste?</h2><span class="meta">Op volgorde: nooit gesproken, te lang geleden, dan wie het verst achter ligt.</span></header>
              <LegeStaat v-if="!zichtbaar.length" titel="Niemand past bij deze filters." tekst="Kies een ander team of een andere stand.">
                <button type="button" class="dd-act mt-8" @click="wisAlles">Wis de filters</button>
              </LegeStaat>
              <ul v-else class="kaart mp-lijst" data-test="coaching-lijst">
                <li v-for="l in zichtbaar" :key="l.id" :data-test="`coaching-rij-${l.id}`">
                  <div class="item-rij">
                    <span class="item-tijd" :class="{ 'item-tijd--rood': heeftGesprekNodig(l) }">{{ l.dagenSindsGesprek == null ? 'Nooit' : `${l.dagenSindsGesprek} d` }}<small>{{ l.dagenSindsGesprek == null ? 'gesproken' : 'geleden' }}</small></span>
                    <span class="item-icoon" :class="{ 'item-icoon--urgent': heeftGesprekNodig(l) }"><Icoon naam="User" /></span>
                    <span class="item-body">
                      <FunctieLink :to="`/coaching/${l.id}`" als-tekst class="item-naam mp-naam">{{ kortNaam(l.naam) }}</FunctieLink>
                      <span class="item-meta">{{ meta(l) }}</span>
                      <span v-if="rijReden(l)" class="item-meta" data-test="coaching-reden">{{ rijReden(l) }}</span>
                      <span class="pil-tags">
                        <Label :soort="STAND_LABEL[coachingStand(l)].soort" :waarde="STAND_LABEL[coachingStand(l)].waarde" :tekst="STAND_LABEL[coachingStand(l)].tekst" />
                        <Label v-if="l.tempo && l.tempo.stand !== 'geen'" soort="tempo" :waarde="l.tempo.stand === 'achter' ? 'achter' : 'op'" :tekst="`Tempo ${l.tempo.procent}%`" />
                        <span v-if="l.openAfspraken" class="pil">{{ l.openAfspraken }} open {{ l.openAfspraken === 1 ? 'afspraak' : 'afspraken' }}</span>
                      </span>
                    </span>
                    <span class="item-acties">
                      <button type="button" class="dd-act" :data-test="`coaching-plan-${l.id}`" @click="plan = { voorkeur: l.id }"><Icoon naam="CalendarCheck" :grootte="14" />Plan</button>
                      <FunctieLink :to="`/coaching/${l.id}`" class="dd-act" :data-test="`coaching-open-${l.id}`">Coachingkaart</FunctieLink>
                    </span>
                  </div>
                </li>
              </ul>
            </div>

            <div class="mp-blok" data-test="coaching-afspraken">
              <header class="mp-blokkop"><h2 class="mp-bloktitel">Open afspraken uit coaching</h2><span class="meta">Wat je in eerdere gesprekken afsprak en nog niet is afgevinkt.</span></header>
              <LegeStaat v-if="!afspraken.length" titel="Er staan geen afspraken open." tekst="Leg in het volgende gesprek een afspraak vast met doel, gedrag en termijn. De accountmanager ziet hem in Mijn resultaten." />
              <ul v-else class="kaart mp-lijst">
                <li v-for="a in afspraken" :key="a.id" :data-test="`coaching-afspraak-${a.id}`">
                  <div class="item-rij">
                    <span class="item-tijd" :class="{ 'item-tijd--rood': a.overTermijn }">{{ a.termijn ? datumKort(a.termijn) : 'Geen' }}<small>termijn</small></span>
                    <span class="item-icoon"><Icoon naam="ClipboardCheck" /></span>
                    <span class="item-body">
                      <span class="item-naam">{{ a.tekst }}</span>
                      <span class="item-meta">{{ kortNaam(a.lid.naam) }}<template v-if="a.lid.team"> · {{ a.lid.team.naam }}</template></span>
                      <span v-if="a.overTermijn" class="pil-tags"><Label soort="urgentie" waarde="over-tijd" /></span>
                    </span>
                    <span class="item-acties"><FunctieLink :to="`/coaching/${a.lid.id}`" class="dd-act">Bekijk</FunctieLink></span>
                  </div>
                </li>
              </ul>
            </div>
          </template>
        </div>
      </section>

      <CijferFlyout :open="!!cijfer" :kicker="cijfer?.kicker ?? ''" :titel="cijfer?.titel ?? ''" :regels="cijfer?.regels ?? []" :leeg="cijfer?.leeg" @sluit="cijfer = null" />
      <PlanCoachingFlyout :open="!!plan" :leden="planLeden" :voorkeur="plan?.voorkeur" @sluit="plan = null" @gepland="plan = null; refresh()" />
    </template>
  </div>
</template>

<style scoped>
.mp-filterknop--aan { background: var(--ink); color: var(--yellow); border-color: var(--ink); }
.mp-teller { display: inline-flex; align-items: center; height: 18px; padding: 0 7px; margin-left: 2px; background: var(--yellow); color: var(--ink); font-size: 11px; font-weight: 800; border-radius: 2px; }
.mp-blok { margin-top: 32px; }
.mp-blokkop { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 16px; margin: 16px 0 12px; padding-bottom: 8px; border-bottom: 2px solid var(--ink); }
.mp-bloktitel { margin: 0; font-family: var(--font-serif); font-size: 20px; }
.mp-lijst { list-style: none; margin: 0; padding-top: 4px; padding-bottom: 4px; }
.mp-naam { text-decoration: none; }
.mp-naam:hover { color: var(--yellow-dark); }
</style>
