<script setup lang="ts">
// Kennisbank in de opzet van DealDrive (/kennisbank): de documenten van de organisatie (cases, offertes,
// presentaties, productinfo, contracten, prijslijsten) met zoeken op woord, een strook met het type en tellers,
// achter Filters je eigen uploads en wel of geen koppeling, en een raster van kaarten (3 per rij, 2 op een
// tablet, 1 op de telefoon). "+ Document" opent de upload met koppeling aan klanten en contacten; een kaart
// opent het venster met de datavelden, de preview en de AI-vragen. Filters en het open document staan in de URL
// (zoek, type, eigen, koppeling, document). Vanaf Gevorderd.
import { DOCUMENT_TYPES, TYPE_ICOON, TYPE_LABEL, TYPE_MEERVOUD, grootteLabel, type DocumentType } from '~~/shared/kennisbank'

const { functie } = useMe()
const aan = !!functie('nav.kennisbank')?.beschikbaar
const route = useRoute()
const router = useRouter()
const q = (k: string) => (typeof route.query[k] === 'string' ? (route.query[k] as string) : '')
const query = computed(() => ({ zoek: q('zoek') || undefined, type: q('type') || undefined, eigen: q('eigen') || undefined, koppeling: q('koppeling') || undefined }))
const { data, refresh } = await useFetch<any>('/api/documenten', { query, immediate: aan, default: () => ({ documenten: [], totaal: 0, alle: 0, totaalOrg: 0, tellers: {} }) })

function zet(p: Record<string, string | undefined>) {
  const n: Record<string, any> = { ...route.query, ...p }
  for (const k of Object.keys(n)) if (!n[k]) delete n[k]
  router.replace({ query: n })
}
const zoekTekst = ref(q('zoek'))
let wacht: ReturnType<typeof setTimeout> | undefined
watch(zoekTekst, (z) => { clearTimeout(wacht); wacht = setTimeout(() => zet({ zoek: z.trim().length >= 2 ? z.trim() : undefined }), 250) })
watch(() => route.query.zoek, (z) => { if (typeof z === 'string' && z && z !== zoekTekst.value.trim()) zoekTekst.value = z })

const filtersOpen = ref(false)
const actieveFilters = computed(() => (q('eigen') ? 1 : 0) + (q('koppeling') ? 1 : 0))
function resetFilters() { zoekTekst.value = ''; zet({ zoek: undefined, type: undefined, eigen: undefined, koppeling: undefined }) }
const typePillen = computed(() => DOCUMENT_TYPES.filter((t) => (data.value.tellers?.[t] ?? 0) > 0 || q('type') === t))

const documentId = computed(() => q('document') || null)
function open(id: string | null) { zet({ document: id ?? undefined }) }
const uploadOpen = ref(false)
function geupload(id: string) { uploadOpen.value = false; refresh(); open(id) }

const KLEUR: Record<DocumentType, string> = { offerte: 'geel', case: 'groen', presentatie: 'rood', productinfo: 'blauw', contract: 'inkt', prijslijst: 'oranje', overig: 'grijs' }
const datum = (d: string) => {
  const dt = new Date(d)
  const dagen = Math.floor((Date.now() - dt.getTime()) / 864e5)
  if (dagen < 1 && new Date().toDateString() === dt.toDateString()) return 'vandaag'
  if (dagen < 2) return 'gisteren'
  const anderJaar = dt.getFullYear() !== new Date().getFullYear()
  return new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', ...(anderJaar ? { year: 'numeric' } : {}), timeZone: 'Europe/Amsterdam' }).format(dt).replace('.', '')
}
useHead({ title: 'Kennisbank · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="nav.kennisbank" />
    <template v-else>
      <PaginaKop :kicker="`Kennisbank · ${data.totaalOrg} ${data.totaalOrg === 1 ? 'document' : 'documenten'}`" titel="Wat heb je nodig?" uitleg="Cases, offertes, presentaties, productinfo en contracten van je organisatie. Zoek op woord; een vraag over de inhoud stel je op het document zelf." helpartikel="kennisbank">
        <template #acties>
          <button type="button" class="dd-actie dd-actie--primair" data-test="kb-nieuw" @click="uploadOpen = true"><Icoon naam="Plus" class="dd-actie-icoon" />Document</button>
        </template>
      </PaginaKop>

      <section class="kb-werkbalk-sectie">
        <div class="container">
          <div class="kb-werkbalk">
            <label class="zoekveld kb-zoek"><span class="sr-only">Zoek in de kennisbank</span><Icoon naam="Search" :grootte="18" class="kb-zoek-icoon" /><input v-model="zoekTekst" type="search" class="zoekinvoer" placeholder="Zoek in naam, beschrijving, inhoud of klant (minstens 2 tekens)" data-test="kb-zoek"></label>
            <button type="button" class="dd-actie dd-actie--secundair" :class="{ 'kb-filters--aan': filtersOpen || actieveFilters }" :aria-expanded="filtersOpen" data-test="kb-filters" @click="filtersOpen = !filtersOpen">
              <Icoon naam="SlidersHorizontal" class="dd-actie-icoon" />Filters<span v-if="actieveFilters" class="kb-teller">{{ actieveFilters }}</span><Icoon naam="ChevronDown" :grootte="14" class="kb-pijl" :class="{ 'kb-pijl--open': filtersOpen }" />
            </button>
          </div>
          <div class="kb-groep" role="group" aria-label="Type" data-test="kb-filter-type"><span class="filter-label">Type</span>
            <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': !q('type') }" :aria-pressed="!q('type')" data-test="kb-type-alle" @click="zet({ type: undefined })">Alles<span class="pil-teller tnum">{{ data.alle }}</span></button>
            <button v-for="t in typePillen" :key="t" type="button" class="filter-pil" :class="{ 'filter-pil--aan': q('type') === t }" :aria-pressed="q('type') === t" :data-test="`kb-type-${t}`" @click="zet({ type: t })">{{ TYPE_MEERVOUD[t] }}<span class="pil-teller tnum">{{ data.tellers?.[t] ?? 0 }}</span></button>
          </div>
          <div v-if="filtersOpen" class="kb-paneel" data-test="kb-filterpaneel">
            <div class="kb-groep" role="group" aria-label="Van wie"><span class="filter-label">Van wie</span>
              <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': !q('eigen') }" :aria-pressed="!q('eigen')" @click="zet({ eigen: undefined })">Iedereen</button>
              <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': q('eigen') === '1' }" :aria-pressed="q('eigen') === '1'" data-test="kb-eigen" @click="zet({ eigen: '1' })">Mijn uploads</button>
            </div>
            <div class="kb-groep" role="group" aria-label="Koppeling"><span class="filter-label">Koppeling</span>
              <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': !q('koppeling') }" :aria-pressed="!q('koppeling')" @click="zet({ koppeling: undefined })">Alle</button>
              <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': q('koppeling') === 'met' }" :aria-pressed="q('koppeling') === 'met'" data-test="kb-koppeling-met" @click="zet({ koppeling: 'met' })">Bij een klant of contact</button>
              <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': q('koppeling') === 'zonder' }" :aria-pressed="q('koppeling') === 'zonder'" data-test="kb-koppeling-zonder" @click="zet({ koppeling: 'zonder' })">Algemeen</button>
            </div>
            <div v-if="actieveFilters" class="kb-groep kb-groep--eind"><button type="button" class="dd-act" data-test="kb-reset" @click="resetFilters">Reset filters</button></div>
          </div>
        </div>
      </section>

      <section class="section section--laatste">
        <div class="container">
          <div class="kb-feedkop">
            <h2 class="kb-feedtitel tnum" data-test="kb-aantal">{{ data.totaal }} {{ data.totaal === 1 ? 'document' : 'documenten' }}</h2>
            <span class="kb-feedmeta">Klik een document voor de gegevens, de preview en de AI-vragen</span>
          </div>
          <LegeStaat v-if="!data.totaalOrg" kicker="Nog niets" titel="De kennisbank is nog leeg." tekst="Begin met de documenten die je het vaakst zoekt: je beste case, de standaardofferte en de presentatie die je bij een eerste afspraak laat zien." data-test="kb-leeg">
            <button type="button" class="dd-actie dd-actie--zwart" @click="uploadOpen = true"><Icoon naam="Plus" class="dd-actie-icoon" />Eerste document</button>
          </LegeStaat>
          <LegeStaat v-else-if="!data.documenten.length" kicker="Niets gevonden" titel="Geen documenten in dit filter." tekst="Probeer een breder filter of een andere zoekterm." data-test="kb-leeg-filter">
            <button type="button" class="dd-act mt-8" @click="resetFilters">Toon alles</button>
          </LegeStaat>
          <ul v-else class="kb-raster" role="list" data-test="kb-raster">
            <li v-for="d in data.documenten" :key="d.id" class="kb-kaart">
              <button type="button" class="kb-knop" :data-test="`kb-kaart-${d.id}`" :aria-label="`${d.naam} openen`" @click="open(d.id)">
                <span class="kb-thumb" :class="`kb-thumb--${KLEUR[d.type as DocumentType]}`">
                  <Icoon :naam="TYPE_ICOON[d.type as DocumentType]" :grootte="40" />
                  <span class="kb-type">{{ TYPE_LABEL[d.type as DocumentType] }}</span>
                </span>
                <span class="kb-body">
                  <span class="kb-naam">{{ d.naam }}</span>
                  <span v-if="d.beschrijving" class="kb-desc">{{ d.beschrijving }}</span>
                  <span v-if="d.accounts.length" class="kb-chips"><span v-for="a in d.accounts.slice(0, 3)" :key="a.id" class="kb-chip">{{ a.naam }}</span><span v-if="d.accounts.length > 3" class="kb-chip">+{{ d.accounts.length - 3 }}</span></span>
                  <span class="kb-meta tnum">v{{ d.versie }} · {{ grootteLabel(d.grootte) }} · {{ datum(d.bijgewerktOp) }}<template v-if="d.eigenaar"> · {{ d.eigenaar.naam }}</template></span>
                </span>
              </button>
            </li>
          </ul>
        </div>
      </section>

      <DocumentDetailFlyout :document-id="documentId" @sluit="open(null)" @verwijderd="open(null); refresh()" />
      <KennisbankUploadFlyout :open="uploadOpen" @sluit="uploadOpen = false" @bewaard="geupload" />
    </template>
  </div>
</template>

<style scoped>
.kb-werkbalk-sectie { padding: 0 0 8px; }
.kb-werkbalk { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.kb-zoek { position: relative; flex: 1 1 320px; max-width: 720px; display: flex; align-items: center; }
.kb-zoek .zoekinvoer { width: 100%; min-height: 48px; padding-left: 40px; font-size: 15px; border: 2px solid var(--ink); }
.kb-zoek-icoon { position: absolute; left: 12px; color: var(--ink-soft); pointer-events: none; }
.kb-filters--aan { background: var(--ink); color: var(--yellow); border-color: var(--ink); }
.kb-teller { display: inline-flex; align-items: center; height: 18px; padding: 0 7px; margin-left: 2px; background: var(--yellow); color: var(--ink); font-size: 11px; font-weight: 800; border-radius: 2px; }
.kb-pijl { transition: transform var(--transition-fast); }
.kb-pijl--open { transform: rotate(180deg); }
.kb-groep { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.kb-groep .filter-label { min-width: 72px; }
.kb-groep--eind { justify-content: flex-end; }
.kb-paneel { display: flex; flex-direction: column; gap: 12px; background: var(--wit); border: 1px solid var(--border); padding: 16px 18px; margin-top: 12px; }
.kb-feedkop { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
.kb-feedtitel { font-family: var(--font-serif); font-size: 22px; font-weight: 700; letter-spacing: -0.01em; margin: 0; color: var(--ink); }
.kb-feedmeta { font-size: 12px; color: var(--muted); }
.kb-raster { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr; gap: var(--kaart-gap); }
@media (min-width: 720px) { .kb-raster { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 1100px) { .kb-raster { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.kb-kaart { display: flex; min-width: 0; background: var(--wit); border: 1px solid var(--border); }
.kb-kaart:hover { border-color: var(--yellow); }
.kb-knop { display: flex; flex-direction: column; width: 100%; padding: 0; color: var(--ink); text-align: left; background: transparent; border: 0; font: inherit; cursor: pointer; }
.kb-knop:focus-visible { outline: 2px solid var(--ink); outline-offset: -2px; }
.kb-thumb { position: relative; display: flex; align-items: center; justify-content: center; height: 120px; color: var(--wit); background: var(--muted); }
.kb-thumb :deep(.icoon) { width: 40px; height: 40px; }
.kb-thumb--geel { background: var(--yellow); color: var(--ink); }
.kb-thumb--groen { background: var(--green); }
.kb-thumb--rood { background: var(--red); }
.kb-thumb--blauw { background: var(--blue); }
.kb-thumb--inkt { background: var(--ink); color: var(--yellow); }
.kb-thumb--oranje { background: var(--orange); }
.kb-thumb--grijs { background: var(--ink-soft); }
.kb-type { position: absolute; top: 12px; left: 12px; padding: 3px 9px; background: var(--wit); color: var(--ink); font-size: var(--fs-label); font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
.kb-body { display: flex; flex-direction: column; flex: 1; gap: 8px; padding: 16px 18px; }
.kb-naam { font-family: var(--font-serif); font-size: 18px; font-weight: 700; line-height: 1.3; overflow-wrap: anywhere; }
.kb-desc { font-size: 13px; line-height: 1.55; color: var(--ink-soft); }
.kb-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.kb-chip { padding: 2px 7px; background: var(--surface); font-size: var(--fs-label); font-weight: 700; color: var(--ink-soft); }
.kb-meta { margin-top: auto; padding-top: 10px; border-top: 1px solid var(--border); font-size: 11px; color: var(--muted); }
@media (max-width: 719px) {
  .kb-zoek { max-width: none; flex-basis: 100%; }
  .kb-werkbalk > .dd-actie { flex: 1 1 auto; }
  .kb-groep .filter-label { width: 100%; }
  .kb-groep .filter-pil { min-height: var(--touch-target-min); }
  .kb-thumb { height: 88px; }
}
</style>
