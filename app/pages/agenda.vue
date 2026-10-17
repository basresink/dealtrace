<script setup lang="ts">
// Agenda (F09) in de opzet van DealDrive: de kop vat de dag samen, rechts zoeken, AI, hulp, "+ Afspraak"
// en daarnaast Weekstart en Weekreview (je weekritme). Daaronder de navigatie met het weeknummer en Filters; in het filterpaneel staat
// ook de weergave (Werkweek, Week, Maand; in de URL). Dan het weekrooster (AgendaRooster) of de maand (AgendaMaand).
// Afspraken in de kleur van de meetingsoort, belblokken en taken op hun tijd, bezet uit de
// gekoppelde agenda gearceerd, conflicten met een rode rand en "Gepland door" bij afspraken die een
// collega voor je plande. Klik op een lege tijd plant een afspraak op dat moment.
import { plusDagen } from '~~/shared/datum'
const route = useRoute()
const router = useRouter()
const toast = useToast()
const klasse = useSchermklasse()
const { functie } = useMe()
const weekstartAan = !!functie('dagritme.weekstart')?.beschikbaar
const weekreviewAan = !!functie('dagritme.weekreview')?.beschikbaar
const vandaag = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })
type Weergave = 'werkweek' | 'week' | 'maand' | 'dag'
// "Wie is er aan de beurt?" staat sinds de nieuwe zijbalk op /meetings; oude links gaan daarheen.
if (route.query.weergave === 'meetings') await navigateTo('/meetings', { replace: true })
// 'dag' is geen keuze in het filterpaneel, maar oude links (Vandaag, Taken, Bezoeken) gebruiken hem nog.
const weergave = computed<Weergave>(() => (['werkweek', 'week', 'maand', 'dag'].includes(String(route.query.weergave)) ? route.query.weergave as Weergave : 'werkweek'))
const OPTIES = [
  { id: 'werkweek', label: 'Werkweek', icoon: 'CalendarRange' },
  { id: 'week', label: 'Week', icoon: 'Calendar' },
  { id: 'maand', label: 'Maand', icoon: 'LayoutGrid' },
] as const
const telefoon = computed(() => klasse.value === 'telefoon')
const datum = computed(() => (typeof route.query.datum === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(route.query.datum) ? route.query.datum : vandaag))
const gebruiker = computed(() => (typeof route.query.gebruiker === 'string' ? route.query.gebruiker : ''))
const filterSoort = ref('')
const filterVorm = ref('')
const zet = (q: Record<string, string | undefined>) => router.replace({ query: { ...route.query, ...q } })
const wd = (d: string) => (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7
const maandag = computed(() => plusDagen(datum.value, -wd(datum.value)))
/** Eén dag op de telefoon en bij ?weergave=dag; anders ma tot en met vr of de hele week. */
const eenDag = computed(() => weergave.value === 'dag' || telefoon.value)
const dagen = computed(() => {
  if (eenDag.value) return [datum.value]
  return Array.from({ length: weergave.value === 'week' ? 7 : 5 }, (_, i) => plusDagen(maandag.value, i))
})
const maandDagen = computed(() => {
  const eerste = `${datum.value.slice(0, 8)}01`
  const start = plusDagen(eerste, -wd(eerste))
  return Array.from({ length: 42 }, (_, i) => plusDagen(start, i))
})
const periode = computed(() => (weergave.value === 'maand'
  ? { van: maandDagen.value[0]!, tot: plusDagen(maandDagen.value[0]!, 42) }
  : { van: maandag.value, tot: plusDagen(maandag.value, 7) }))
const leeg = () => ({ afspraken: [], belblokken: [], taken: [], bezet: [], conflicten: [], gebruikers: [], meetingsoorten: [], vandaagAantal: 0, titel: '', kan: {} })
const { data, refresh } = await useFetch<any>('/api/agenda', { query: computed(() => ({ van: periode.value.van, tot: periode.value.tot, gebruiker: gebruiker.value || undefined })), default: leeg })
const afspraken = computed(() => data.value.afspraken.filter((a: any) => (!filterSoort.value || a.soort.slug === filterSoort.value) && (!filterVorm.value || a.vorm === filterVorm.value)))
const dagVan = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })

// Kop: de dag samengevat, zoals in DealDrive (geannuleerde afspraken tellen niet mee).
const titel = computed(() => {
  const n = data.value.vandaagAantal ?? 0
  return n === 0 ? 'Geen afspraken vandaag.' : n === 1 ? '1 afspraak vandaag.' : `${n} afspraken vandaag.`
})

// Navigatie: per dag op de telefoon, per week in het rooster, per maand in de maand.
function verschuif(stap: number) {
  const d = datum.value
  if (weergave.value === 'maand') zet({ datum: new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1 + stap, 1)).toISOString().slice(0, 10) })
  else zet({ datum: plusDagen(d, eenDag.value ? stap : 7 * stap) })
}
function isoWeek(d: string) {
  const doel = new Date(`${d}T12:00:00Z`)
  doel.setUTCDate(doel.getUTCDate() + 3 - ((doel.getUTCDay() + 6) % 7))
  const jan4 = new Date(Date.UTC(doel.getUTCFullYear(), 0, 4))
  jan4.setUTCDate(jan4.getUTCDate() + 3 - ((jan4.getUTCDay() + 6) % 7))
  return 1 + Math.round((doel.getTime() - jan4.getTime()) / (7 * 864e5))
}
const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('nl-NL', { ...o, timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`)).replace(/\./g, '')
const navLabel = computed(() => {
  if (weergave.value === 'maand') { const m = fmt(datum.value, { month: 'long', year: 'numeric' }); return m[0]!.toUpperCase() + m.slice(1) }
  const week = `Week ${isoWeek(datum.value)}`
  if (eenDag.value) return `${week} · ${fmt(datum.value, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`
  const eerste = dagen.value[0]!; const laatste = dagen.value.at(-1)!
  const van = eerste.slice(5, 7) === laatste.slice(5, 7) ? String(Number(eerste.slice(8))) : fmt(eerste, { day: 'numeric', month: 'short' })
  return `${week} · ${van} t/m ${fmt(laatste, { day: 'numeric', month: 'short', year: 'numeric' })}`
})
// Werkweek toont ma tot en met vr; wat in het weekend staat, mag niet stil verdwijnen.
const weekendAantal = computed(() => {
  if (weergave.value !== 'werkweek' || eenDag.value) return 0
  const weekend = new Set([plusDagen(maandag.value, 5), plusDagen(maandag.value, 6)])
  return afspraken.value.filter((a: any) => weekend.has(dagVan(a.start))).length
})

// De weergave (werkweek, week, maand, dag) staat in het filterpaneel, in de URL.
function kies(w: Weergave) { zet({ weergave: w === 'werkweek' ? undefined : w }) }

// Flyouts
const planOpen = ref(false)
const planVoorstel = ref<{ datum?: string; start?: string } | null>(null)
function plan(voorstel: { datum: string; start: string } | null = null) { planVoorstel.value = voorstel; planOpen.value = true }
const afspraakId = computed(() => (typeof route.query.afspraak === 'string' ? route.query.afspraak : null))
async function gepland(id: string) { planOpen.value = false; await refresh(); zet({ afspraak: id }) }
const taakId = ref<string | null>(null)
const filtersOpen = ref(false)
const filterAantal = computed(() => Number(!!filterSoort.value) + Number(!!filterVorm.value) + Number(!!gebruiker.value))
const vormLabel: Record<string, string> = { bezoek: 'Bezoek', online: 'Online', telefoon: 'Telefoon' }
useHead({ title: 'Agenda · Dealtrace' })
if (import.meta.client && route.query.melding === 'gekoppeld') toast.toon('Agenda gekoppeld.')
</script>

<template>
  <div>
    <PaginaKop kicker="Planning · Agenda" :titel="titel" helpartikel="agenda">
      <template #acties>
        <button v-if="$aan('agenda.basis')" type="button" class="dd-actie dd-actie--zwart" data-test="plan-afspraak-knop" @click="plan()"><Icoon naam="Plus" class="dd-actie-icoon" />Afspraak</button>
        <FunctieLink v-if="weekstartAan" to="/weekstart" class="dd-actie dd-actie--secundair" data-test="agenda-weekstart"><Icoon naam="CalendarRange" class="dd-actie-icoon" />Weekstart</FunctieLink>
        <FunctieLink v-if="weekreviewAan" to="/weekreview" class="dd-actie dd-actie--secundair" data-test="agenda-weekreview"><Icoon naam="NotebookPen" class="dd-actie-icoon" />Weekreview</FunctieLink>
      </template>
    </PaginaKop>
    <section class="section section--laatste ag-sectie">
      <div class="container">
        <div class="ag-navrij">
          <div class="ag-nav">
            <button type="button" class="ag-navknop" :aria-label="weergave === 'maand' ? 'Vorige maand' : eenDag ? 'Vorige dag' : 'Vorige week'" data-test="agenda-vorige" @click="verschuif(-1)">←</button>
            <button type="button" class="ag-navknop" data-test="agenda-vandaag" @click="zet({ datum: undefined })">Vandaag</button>
            <button type="button" class="ag-navknop" :aria-label="weergave === 'maand' ? 'Volgende maand' : eenDag ? 'Volgende dag' : 'Volgende week'" data-test="agenda-volgende" @click="verschuif(1)">→</button>
          </div>
          <h2 class="ag-periode" data-test="agenda-periode">{{ navLabel }}</h2>
          <button type="button" class="dd-act ag-filterknop" :class="{ 'ag-filterknop--aan': filterAantal }" :aria-expanded="filtersOpen" data-test="agenda-filters" @click="filtersOpen = !filtersOpen"><Icoon naam="SlidersHorizontal" />Filters<span v-if="filterAantal" class="ag-teller">{{ filterAantal }}</span></button>
        </div>
        <div v-if="filtersOpen" class="formulier-raster ag-filters" data-test="agenda-filterpaneel">
          <div class="veld ag-weergave"><span class="veld-label">Weergave</span>
            <div class="ag-weergave-pillen" role="group" aria-label="Weergave">
              <button v-for="o in OPTIES" :key="o.id" type="button" class="filter-pil" :class="{ 'filter-pil--aan': weergave === o.id }" :aria-pressed="weergave === o.id" :data-test="`weergave-${o.id}`" @click="kies(o.id)"><Icoon :naam="o.icoon" :grootte="14" />{{ o.label }}</button>
            </div>
          </div>
          <label v-if="data.gebruikers.length > 1" class="veld"><span class="veld-label">Gebruiker</span><select class="invoer" :value="gebruiker" data-test="filter-gebruiker" @change="zet({ gebruiker: ($event.target as HTMLSelectElement).value || undefined })"><option value="">Mijn agenda</option><option v-for="u in data.gebruikers" :key="u.id" :value="u.id">{{ u.naam.replace(/^Testgebruiker /, '') }}</option></select></label>
          <label class="veld"><span class="veld-label">Meetingsoort</span><select v-model="filterSoort" class="invoer" data-test="filter-soort"><option value="">Alle</option><option v-for="m in data.meetingsoorten" :key="m.id" :value="m.slug">{{ m.naam }}</option></select></label>
          <label class="veld"><span class="veld-label">Vorm</span><select v-model="filterVorm" class="invoer" data-test="filter-vorm"><option value="">Alle</option><option v-for="(l, k) in vormLabel" :key="k" :value="k">{{ l }}</option></select></label>
        </div>
        <p v-if="weekendAantal" class="ag-weekend" data-test="agenda-weekend">{{ weekendAantal }} {{ weekendAantal === 1 ? 'afspraak' : 'afspraken' }} in het weekend. <button type="button" class="ag-weekend-knop" @click="kies('week')">Toon de hele week</button></p>
        <p v-if="(filterSoort || filterVorm) && !afspraken.length" class="meta ag-leeg" data-test="agenda-leeg">Geen afspraken met dit filter. <button type="button" class="tekst-link" @click="filterSoort = ''; filterVorm = ''">Toon alles</button></p>

        <AgendaMaand
          v-if="weergave === 'maand'" :dagen="maandDagen" :maand="datum.slice(0, 7)" :vandaag="vandaag" :afspraken="afspraken" :belblokken="data.belblokken" :taken="data.taken" :telefoon="telefoon"
          @afspraak="zet({ afspraak: $event })" @dag="zet({ weergave: telefoon ? 'dag' : 'week', datum: $event })"
        />
        <AgendaRooster
          v-else :dagen="dagen" :vandaag="vandaag" :afspraken="afspraken" :belblokken="data.belblokken" :taken="data.taken" :bezet="data.bezet" :conflicten="data.conflicten"
          :toon-eigenaar="gebruiker.includes(',')" :telefoon="telefoon"
          @afspraak="zet({ afspraak: $event })" @taak="taakId = $event" @plan="plan($event)"
        />
        <div class="ag-legenda" aria-label="Legenda">
          <span class="ag-legenda-item"><span class="ag-vlak ag-vlak--afspraak" />Afspraak (kleur van de meetingsoort)</span>
          <span class="ag-legenda-item"><span class="ag-vlak ag-vlak--belblok" />Belblok</span>
          <span class="ag-legenda-item"><span class="ag-vlak ag-vlak--taak" />Taak</span>
          <span class="ag-legenda-item"><span class="ag-vlak ag-vlak--bezet" />Bezet in je <NuxtLink v-if="data.kan?.koppeling" to="/mij" class="tekst-link">gekoppelde agenda</NuxtLink><template v-else>gekoppelde agenda</template></span>
          <span v-if="weergave !== 'maand'" class="ag-legenda-item ag-legenda-tip">Klik op een lege tijd om een afspraak te plannen.</span>
        </div>
      </div>
    </section>
    <PlanAfspraakFlyout :open="planOpen" :voorstel="planVoorstel" @sluit="planOpen = false" @gepland="gepland" />
    <AfspraakFlyout :open="!!afspraakId" :afspraak-id="afspraakId" @sluit="zet({ afspraak: undefined })" @gewijzigd="refresh()" />
    <TaakFlyout :open="!!taakId" :taak-id="taakId" @sluit="taakId = null" @klaar="taakId = null; refresh()" @gewijzigd="refresh()" />
  </div>
</template>

<style scoped>
.ag-sectie { padding-top: 16px; }
.ag-navrij { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 12px; }
.ag-nav { display: inline-flex; gap: 6px; }
.ag-navknop { min-width: var(--touch-target-min); min-height: var(--touch-target-min); padding: 6px 12px; border: 1px solid var(--border-strong); border-radius: var(--radius); background: transparent; color: var(--ink); font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.ag-navknop:hover { border-color: var(--ink); }
.ag-periode { margin: 0; font-family: var(--font-serif); font-size: 18px; font-weight: 700; }
.ag-filterknop { margin-left: auto; }
.ag-filterknop--aan { border-color: var(--ink); }
.ag-teller { padding: 0 6px; font-size: var(--fs-label); background: var(--yellow); border-radius: var(--radius); }
.ag-filters { margin-bottom: 12px; }
.ag-weergave { grid-column: 1 / -1; }
.ag-weergave-pillen { display: flex; flex-wrap: wrap; gap: 8px; }
.ag-weekend { margin: 0 0 10px; padding: 8px 12px; background: var(--surface); border-left: 3px solid var(--yellow); font-size: 12px; color: var(--ink-soft); }
.ag-weekend-knop { padding: 0; border: 0; background: none; font: inherit; font-weight: 700; color: var(--ink); text-decoration: underline; cursor: pointer; }
.ag-leeg { margin: 0 0 10px; }
.ag-legenda { display: flex; flex-wrap: wrap; gap: 8px 16px; margin-top: 10px; font-size: var(--fs-label); color: var(--muted); }
.ag-legenda-item { display: inline-flex; align-items: center; gap: 6px; }
.ag-legenda-tip { margin-left: auto; }
.ag-vlak { width: 12px; height: 12px; border: 1px solid var(--border-strong); border-radius: var(--radius); }
.ag-vlak--afspraak { background: color-mix(in srgb, var(--yellow) 22%, var(--wit)); border-left: 3px solid var(--yellow-dark); }
.ag-vlak--belblok { background: var(--yellow); border-left: 3px solid var(--ink); }
.ag-vlak--taak { background: var(--wit); border-style: dashed; border-left: 3px solid var(--blue); }
.ag-vlak--bezet { background: repeating-linear-gradient(-45deg, var(--surface), var(--surface) 3px, var(--border) 3px, var(--border) 4px); }
@media (max-width: 719px) {
  .ag-periode { order: 3; width: 100%; font-size: 16px; }
  .ag-legenda-tip { margin-left: 0; }
}
</style>
