<script setup lang="ts">
// Opvolgreeksen (F7, /opvolgreeksen): alle reeksen van de gebruiker (salesmanager ook van zijn team, beheerder ook de
// hele organisatie). Kop "11 reeksen lopen, 2 wachten op jou." met de weekregel, filterpillen per stand (Concept, Open,
// Loopt, Raak, Gestopt) met tellers, reikwijdte, sjabloon en zoeken; links de lijst met wat op jou wacht bovenaan,
// rechts de reeks met de stappen per dag, mandaat C of B, Pauzeer, Stop en Reactie ontvangen. Start reeks kiest een
// prospect en een sjabloon; Sjablonen gaat naar het beheer (salesmanager en beheerder). Filters en de gekozen reeks
// staan in de URL (?stand=&wie=&sjabloon=&q=&reeks=).
import { OVERZICHT_LABEL, OVERZICHT_STANDEN, OVERZICHT_UITLEG, REEKS_KANAAL_LABEL } from '~~/shared/opvolgreeks'

const { functie } = useMe()
const aan = !!functie('nav.opvolgreeksen')?.beschikbaar
const kanBeheren = !!functie('instellingen.opvolgreeksen')?.beschikbaar
const route = useRoute()
const router = useRouter()
const q = (k: string) => (typeof route.query[k] === 'string' ? (route.query[k] as string) : undefined)
const query = computed(() => ({ wie: q('wie'), stand: q('stand'), sjabloon: q('sjabloon'), q: q('q') }))
const { data, refresh } = await useFetch<any>('/api/reeksen', { query, immediate: aan, default: () => null })
function zet(p: Record<string, string | undefined>) {
  const n: Record<string, any> = { ...route.query, ...p }
  for (const k of Object.keys(n)) if (n[k] === undefined || n[k] === '') delete n[k]
  router.replace({ query: n })
}
let zoekTimer: any
function zoek(v: string) { clearTimeout(zoekTimer); zoekTimer = setTimeout(() => zet({ q: v || undefined }), 300) }

const gekozenId = computed(() => q('reeks') ?? data.value?.lijst?.[0]?.id ?? null)
const detailRef = ref<HTMLElement | null>(null)
function kies(id: string) {
  zet({ reeks: id })
  if (import.meta.client && window.matchMedia('(max-width: 1023px)').matches) nextTick(() => detailRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}
const startOpen = ref(false)
async function gestart(id: string) { startOpen.value = false; zet({ stand: undefined, reeks: id }); await refresh() }

const WIE_LABEL: Record<string, string> = { mij: 'Mijn reeksen', team: 'Mijn team', org: 'Hele organisatie' }
const STAND_PIL: Record<string, string> = { concept: 'pil--leeg', open: 'pil--oranje', loopt: 'pil--blauw', raak: 'pil--groen', gestopt: 'pil--grijs' }
const STAND_ICOON: Record<string, string> = { concept: 'item-icoon--email', open: 'item-icoon--call', raak: 'item-icoon--visit' }
const dag = (iso: string | null) => (iso ? new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' }).format(new Date(iso)).replace(/\./g, '') : '')
function regel(x: any): string {
  if (x.stand === 'raak' || x.stand === 'gestopt') return x.status === 'klaar' ? `${x.naam} · klaar zonder reactie, terug naar het ritme` : `${x.naam} · ${x.viaMail ? 'antwoord in de mailbox' : x.label.replace(/^Gestopt: /, '')}`
  return `${x.naam} · stap ${x.stap} van ${x.van}${x.status === 'gepauzeerd' ? ' · gepauzeerd' : ''}`
}
function volgende(x: any): string | null {
  if (!x.volgende || x.stand === 'raak' || x.stand === 'gestopt') return null
  const k = REEKS_KANAAL_LABEL[x.volgende.kanaal as keyof typeof REEKS_KANAAL_LABEL] ?? x.volgende.kanaal
  if (x.stand === 'concept') return `Concept wacht op je goedkeuring: ${x.volgende.titel}`
  if (x.volgende.open) return `Wacht op jou: ${x.volgende.titel}`
  return x.volgende.kanaal === 'einde' ? `Einde ${dag(x.volgende.geplandOp)}: terug naar het ritme` : `Volgende: ${k} ${dag(x.volgende.geplandOp)}`
}
const filtersActief = computed(() => !!(q('stand') || q('sjabloon') || q('q')))
useHead({ title: 'Opvolgreeksen · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="nav.opvolgreeksen" />
    <template v-else>
      <PaginaKop kicker="Activiteiten · Opvolgreeksen" :titel="data?.kop ?? 'Opvolgreeksen'" :uitleg="data?.week" helpartikel="volgen">
        <template #acties>
          <NuxtLink v-if="kanBeheren" to="/instellingen/opvolgreeksen" class="dd-actie dd-actie--secundair" data-test="or-sjablonen"><Icoon naam="Settings" class="dd-actie-icoon" />Sjablonen</NuxtLink>
          <button type="button" class="dd-actie dd-actie--primair" data-test="or-start" @click="startOpen = true"><Icoon naam="Repeat" class="dd-actie-icoon" />Start reeks</button>
        </template>
      </PaginaKop>

      <section class="section section--laatste">
        <div v-if="data" class="container">
          <div class="filterpaneel" data-test="or-filters">
            <div class="filter-groep" role="group" aria-label="Stand">
              <span class="filter-label">Stand</span>
              <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': !q('stand') }" :aria-pressed="!q('stand')" data-test="or-stand-alle" @click="zet({ stand: undefined })">Alle <span class="pil-teller">{{ data.totaal }}</span></button>
              <button v-for="s in OVERZICHT_STANDEN" :key="s" type="button" class="filter-pil" :class="{ 'filter-pil--aan': q('stand') === s }" :aria-pressed="q('stand') === s" :title="OVERZICHT_UITLEG[s]" :data-test="`or-stand-${s}`" @click="zet({ stand: q('stand') === s ? undefined : s, reeks: undefined })">{{ OVERZICHT_LABEL[s] }} <span class="pil-teller">{{ data.tellers[s] ?? 0 }}</span></button>
            </div>
            <div v-if="data.wieKeuzes.length > 1" class="filter-groep" role="group" aria-label="Wie">
              <span class="filter-label">Wie</span>
              <button v-for="w in data.wieKeuzes" :key="w" type="button" class="filter-pil" :class="{ 'filter-pil--aan': data.wie === w }" :aria-pressed="data.wie === w" :data-test="`or-wie-${w}`" @click="zet({ wie: w === 'mij' ? undefined : w, reeks: undefined })">{{ WIE_LABEL[w] }}</button>
            </div>
            <div class="filter-groep or-velden">
              <label class="sr-only" for="or-sjabloon">Sjabloon</label>
              <select id="or-sjabloon" class="invoer invoer--klein" :value="q('sjabloon') ?? ''" data-test="or-sjabloon" @change="zet({ sjabloon: ($event.target as HTMLSelectElement).value || undefined, reeks: undefined })">
                <option value="">Alle sjablonen</option><option v-for="s in data.sjablonen" :key="s.id" :value="s.id">{{ s.naam }}{{ s.actief ? '' : ' (uit)' }}</option>
              </select>
              <label class="sr-only" for="or-zoek">Zoek op prospect of contact</label>
              <input id="or-zoek" class="invoer invoer--klein" type="search" :value="q('q') ?? ''" placeholder="Zoek op prospect of contact" data-test="or-zoek" @input="zoek(($event.target as HTMLInputElement).value)">
            </div>
          </div>

          <LegeStaat v-if="!data.lijst.length && !filtersActief" class="mt-16" kicker="Nog niets" titel="Nog geen opvolgreeks." tekst="Start een reeks na een uitkomst als stuur informatie, voicemail of gesproken, later: in Rond af, in de belmodus, onder Volgen op de accountkaart of hier met Start reeks. De reeks stopt vanzelf zodra de prospect reageert." data-test="or-leeg">
            <button type="button" class="dd-actie dd-actie--primair" @click="startOpen = true">Start reeks</button>
          </LegeStaat>
          <LegeStaat v-else-if="!data.lijst.length" class="mt-16" titel="Geen reeks die aan deze filters voldoet." tekst="Kies een andere stand of zoek op een andere naam." data-test="or-geen-treffers">
            <button type="button" class="dd-actie dd-actie--secundair" @click="router.replace({ query: data.wie === 'mij' ? {} : { wie: data.wie } })">Toon alles</button>
          </LegeStaat>
          <div v-else class="or-indeling mt-16">
            <ul class="or-lijst" data-test="or-lijst" aria-label="Opvolgreeksen">
              <li v-for="x in data.lijst" :key="x.id">
                <button type="button" class="item-rij or-rij" :class="{ 'or-rij--aan': gekozenId === x.id }" :aria-pressed="gekozenId === x.id" :data-test="`or-rij-${x.id}`" @click="kies(x.id)">
                  <span class="item-icoon" :class="STAND_ICOON[x.stand]" aria-hidden="true"><Icoon :naam="x.stand === 'raak' ? 'CircleCheck' : x.stand === 'gestopt' ? 'Square' : 'Repeat'" :grootte="16" /></span>
                  <span class="item-body">
                    <span class="item-naam">{{ x.account.naam }}</span>
                    <span class="item-meta">{{ regel(x) }}<template v-if="x.contact"> · {{ x.contact.naam }}</template><template v-if="data.wie !== 'mij' && x.eigenaar.naam"> · {{ x.eigenaar.naam.replace(/^Testgebruiker /, '') }}</template></span>
                    <span v-if="volgende(x)" class="item-meta or-volgende">{{ volgende(x) }}</span>
                  </span>
                  <span class="item-acties"><span class="pil" :class="STAND_PIL[x.stand]" :data-test="`or-stand-pil-${x.id}`">{{ OVERZICHT_LABEL[x.stand as keyof typeof OVERZICHT_LABEL] }}</span></span>
                </button>
              </li>
            </ul>
            <aside ref="detailRef" class="or-detail" aria-live="polite">
              <Suspense>
                <ReeksDetail v-if="gekozenId" :key="gekozenId" :reeks-id="gekozenId" @gewijzigd="refresh" />
                <template #fallback><p class="meta">Laden…</p></template>
              </Suspense>
            </aside>
          </div>
        </div>
      </section>
      <StartReeksFlyout :open="startOpen" @sluit="startOpen = false" @gestart="gestart" />
    </template>
  </div>
</template>

<style scoped>
.or-velden { display: flex; flex-wrap: wrap; gap: 8px; }
.or-velden .invoer { min-width: 200px; flex: 1 1 200px; }
.or-indeling { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--kaart-gap); align-items: start; }
@media (min-width: 1024px) { .or-indeling { grid-template-columns: minmax(0, 1fr) minmax(360px, 460px); } }
.or-lijst { margin: 0; padding: 0 16px; list-style: none; background: var(--wit); border: 1px solid var(--border); }
.or-rij { width: 100%; grid-template-columns: 36px minmax(0, 1fr) auto; text-align: left; background: none; border: 0; border-bottom: 1px solid var(--border); font: inherit; color: inherit; cursor: pointer; }
.or-lijst li:last-child .or-rij { border-bottom: 0; }
.or-rij:hover .item-naam { text-decoration: underline; }
.or-rij:focus-visible { outline: 2px solid var(--ink); outline-offset: -2px; }
.or-rij--aan { background: var(--surface); }
.or-rij .item-body { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
.or-volgende { color: var(--ink-soft); }
.or-detail { min-width: 0; padding: 24px; background: var(--wit); border: 1px solid var(--border); }
@media (min-width: 1024px) { .or-detail { position: sticky; top: 16px; max-height: calc(100vh - 32px); overflow-y: auto; } }
@media (max-width: 719px) {
  .or-lijst { padding: 0 12px; }
  .or-detail { padding: 16px; }
  .or-rij { min-height: var(--touch-target-min); }
  .or-velden .invoer { min-width: 0; }
}
</style>
