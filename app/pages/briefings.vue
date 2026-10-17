<script setup lang="ts">
// Briefings (Gevorderd, in het menu direct onder Taken), in de opzet van DealDrive met wat Dealtrace al had.
// Kop met zoeken, AI en hulp, + Afspraak en Filters. Bovenaan je volgende gesprek met de drie regels, Open briefing,
// Lees voor en Bereid voor (Pitstop). Daaronder één zoekveld voor prospects, klanten en contactpersonen: een keuze
// opent de briefing van het account in de flyout, met een contact ook zijn gegevens, laatste contact en volgende
// gesprekken (?account=&contact= in de link). Dan de chips van de filters en de briefings per dag als kaarten
// (of lijst): achterstallig apart en rood bovenaan, belblokken als één kaart. Filters: periode (standaard Deze week),
// status (nog voorbereiden, voorbereid, achterstallig), soort, doelgroep, met gespreksverslag, wie (salesmanager),
// weergave en sorteer; alles in de link. De periode bepaalt wat de server ophaalt, de rest filtert hier.
import { BRIEFING_SOORTEN, type BriefingSoort } from '~~/shared/briefing'
import { dagKop, DOELGROEPEN, inPeriode, PERIODES, SOORT_KLEUR, SOORT_KORT, STANDAARD_PERIODE, STATUSSEN, type Periode } from '~~/shared/briefingOverzicht'
import type { FilterGroep } from '~/components/briefing/BriefingFilters.vue'
const { me, functie } = useMe()
const aan = !!functie('briefing.bewerken')?.beschikbaar
const route = useRoute()
const router = useRouter()
const q = (k: string) => (typeof route.query[k] === 'string' ? (route.query[k] as string) : '')
const periode = computed(() => ((PERIODES.some(([k]) => k === q('periode')) ? q('periode') : STANDAARD_PERIODE) as Periode))
const magTeam = computed(() => ['salesmanager', 'beheerder'].includes(me.value?.gebruiker?.rol ?? ''))
const query = computed(() => ({ periode: periode.value, van: periode.value === 'vantot' ? q('van') || undefined : undefined, tot: periode.value === 'vantot' ? q('tot') || undefined : undefined, wie: q('wie') === 'team' ? 'team' : undefined }))
const { data, refresh, pending } = await useFetch<any>('/api/briefing/overzicht', { query, immediate: aan, default: () => ({ vandaag: '', items: [], volgend: null, meer: 0, tellers: {}, team: false }) })
const vandaag = computed(() => data.value.vandaag || new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' }))
const TZ = 'Europe/Amsterdam'
const dagVan = (it: any) => (it.wanneer ? new Date(it.wanneer).toLocaleDateString('sv-SE', { timeZone: TZ }) : null)

function zet(p: Record<string, string | undefined>) {
  const n: Record<string, any> = { ...route.query, ...p }
  for (const k of Object.keys(n)) if (!n[k]) delete n[k]
  router.replace({ query: n })
}

// ── Filters ─────────────────────────────────────────────────────────────────
const soorten = computed(() => q('soort').split(',').filter((s) => (BRIEFING_SOORTEN as readonly string[]).includes(s)))
const status = computed(() => (STATUSSEN.some(([k]) => k === q('status')) ? q('status') : 'alle'))
const doelgroep = computed(() => (DOELGROEPEN.some(([k]) => k === q('doelgroep')) ? q('doelgroep') : 'alle'))
const verslag = computed(() => (q('verslag') === 'met' ? 'met' : 'alle'))
const weergave = computed(() => (q('weergave') === 'lijst' ? 'lijst' : 'kaarten'))
const sorteer = computed(() => (q('sorteer') === 'soort' ? 'soort' : 'tijd'))
type Stand = { status: string; soort: string[]; doelgroep: string; verslag: string }
const stand = computed<Stand>(() => ({ status: status.value, soort: soorten.value, doelgroep: doelgroep.value, verslag: verslag.value }))
/** Een belblok valt buiten elk filter op de briefing zelf (soort, Pitstop, doelgroep, verslag); alleen Achterstallig geldt. */
function past(it: any, s: Stand) {
  const laat = !!dagVan(it) && dagVan(it)! < vandaag.value
  if (it.onderwerp === 'belblok') return (s.status === 'alle' || (s.status === 'laat' && laat)) && !s.soort.length && s.doelgroep === 'alle' && s.verslag === 'alle'
  if (s.status === 'laat' && !laat) return false
  if (s.status === 'voorbereid' && !it.pitstop) return false
  if (s.status === 'voorbereiden' && it.pitstop) return false
  if (s.soort.length && !s.soort.includes(it.soort)) return false
  if (s.doelgroep !== 'alle' && it.account.soort !== s.doelgroep) return false
  if (s.verslag === 'met' && !it.verslag) return false
  return true
}
const zichtbaar = computed(() => data.value.items.filter((it: any) => past(it, stand.value)))
const tel = (wijzig: Partial<Stand>) => data.value.items.filter((it: any) => past(it, { ...stand.value, ...wijzig })).length
const groepen = computed<FilterGroep[]>(() => [
  { id: 'periode', label: 'Periode', opties: PERIODES.map(([k, l]) => ({ k, l, n: k === 'vantot' ? null : data.value.tellers?.[k] ?? null })) },
  { id: 'status', label: 'Status', opties: STATUSSEN.map(([k, l]) => ({ k, l, n: tel({ status: k }) })) },
  { id: 'soort', label: 'Soort', opties: [{ k: 'alle', l: 'Alle', n: tel({ soort: [] }) }, ...BRIEFING_SOORTEN.map((s) => ({ k: s, l: SOORT_KORT[s], n: tel({ soort: [s] }), kleur: SOORT_KLEUR[s] }))] },
  { id: 'doelgroep', label: 'Doelgroep', opties: DOELGROEPEN.map(([k, l]) => ({ k, l, n: tel({ doelgroep: k }) })) },
  { id: 'verslag', label: 'Verslag', opties: [{ k: 'alle', l: 'Alle', n: tel({ verslag: 'alle' }) }, { k: 'met', l: 'Met gespreksverslag', n: tel({ verslag: 'met' }) }] },
  ...(magTeam.value ? [{ id: 'wie', label: 'Wie', opties: [{ k: 'mij', l: 'Van mij' }, { k: 'team', l: 'Mijn team' }] }] : []),
  { id: 'weergave', label: 'Weergave', keuze: true, opties: [{ k: 'kaarten', l: 'Kaarten' }, { k: 'lijst', l: 'Lijst' }] },
  { id: 'sorteer', label: 'Sorteer', keuze: true, opties: [{ k: 'tijd', l: 'Tijd' }, { k: 'soort', l: 'Soort' }] },
])
const waarde: Record<string, () => string> = { periode: () => periode.value, status: () => status.value, doelgroep: () => doelgroep.value, verslag: () => verslag.value, wie: () => (q('wie') === 'team' ? 'team' : 'mij'), weergave: () => weergave.value, sorteer: () => sorteer.value }
const STANDAARD: Record<string, string> = { periode: STANDAARD_PERIODE, status: 'alle', doelgroep: 'alle', verslag: 'alle', wie: 'mij', weergave: 'kaarten', sorteer: 'tijd' }
const isAan = (g: string, k: string) => (g === 'soort' ? (k === 'alle' ? !soorten.value.length : soorten.value.includes(k)) : waarde[g]?.() === k)
function zetFilter(g: string, k: string) {
  if (g === 'soort') {
    const n = k === 'alle' ? [] : soorten.value.includes(k) ? soorten.value.filter((s) => s !== k) : [...soorten.value, k]
    zet({ soort: n.join(',') || undefined }); return
  }
  if (g === 'periode' && k === 'vantot' && !q('van')) { zet({ periode: k, van: vandaag.value, tot: plusDagenIso(vandaag.value, 13) }); return }
  zet({ [g]: k === STANDAARD[g] ? undefined : k, ...(g === 'periode' && k !== 'vantot' ? { van: undefined, tot: undefined } : {}) })
}
const plusDagenIso = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
const PERIODE_LABEL = Object.fromEntries(PERIODES) as Record<string, string>
const STATUS_LABEL = Object.fromEntries(STATUSSEN) as Record<string, string>
const chips = computed(() => {
  const c: { sleutel: string; label: string; tekst: string; wis: () => void }[] = []
  if (periode.value !== STANDAARD_PERIODE) c.push({ sleutel: 'periode', label: 'Periode', tekst: periode.value === 'vantot' ? `${q('van') || '…'} tot ${q('tot') || '…'}` : PERIODE_LABEL[periode.value]!, wis: () => zet({ periode: undefined, van: undefined, tot: undefined }) })
  if (status.value !== 'alle') c.push({ sleutel: 'status', label: 'Status', tekst: STATUS_LABEL[status.value]!, wis: () => zet({ status: undefined }) })
  for (const s of soorten.value) c.push({ sleutel: `soort-${s}`, label: 'Soort', tekst: SOORT_KORT[s as BriefingSoort], wis: () => zetFilter('soort', s) })
  if (doelgroep.value !== 'alle') c.push({ sleutel: 'doelgroep', label: 'Doelgroep', tekst: doelgroep.value === 'klant' ? 'Klanten' : 'Prospects', wis: () => zet({ doelgroep: undefined }) })
  if (verslag.value === 'met') c.push({ sleutel: 'verslag', label: 'Verslag', tekst: 'Met gespreksverslag', wis: () => zet({ verslag: undefined }) })
  if (q('wie') === 'team') c.push({ sleutel: 'wie', label: 'Wie', tekst: 'Mijn team', wis: () => zet({ wie: undefined }) })
  return c
})
function wisAlles() { zet({ periode: undefined, van: undefined, tot: undefined, status: undefined, soort: undefined, doelgroep: undefined, verslag: undefined, wie: undefined }) }
const filtersOpen = ref(false)
const scherm = useSchermklasse()
const kicker = computed(() => `Taken · Briefings · ${zichtbaar.value.length} ${periode.value === 'week' && !chips.value.length ? 'deze week' : 'in dit filter'}`)

// ── Dagen en kaarten ────────────────────────────────────────────────────────
const SOORT_VOLGORDE = [...BRIEFING_SOORTEN] as string[]
const lijst = computed(() => {
  const r = [...zichtbaar.value].sort((a: any, b: any) => (sorteer.value === 'soort' ? (SOORT_VOLGORDE.indexOf(a.soort ?? 'zz') - SOORT_VOLGORDE.indexOf(b.soort ?? 'zz')) : 0) || String(a.wanneer ?? '9').localeCompare(String(b.wanneer ?? '9')))
  const uit: { sleutel: string; titel: string; rood: boolean; items: any[] }[] = []
  for (const it of r) {
    const k = sorteer.value === 'soort' ? (it.onderwerp === 'belblok' ? { sleutel: 'belblok', titel: 'Belblokken', rood: false } : { sleutel: it.soort, titel: it.soortLabel, rood: false }) : dagKop(dagVan(it), vandaag.value)
    let g = uit.find((x) => x.sleutel === k.sleutel)
    if (!g) { g = { ...k, items: [] }; uit.push(g) }
    g.items.push(it)
  }
  return uit
})

// ── Je volgende gesprek ─────────────────────────────────────────────────────
const nu = ref<number | null>(null)
onMounted(() => { nu.value = Date.now() })
const volgend = computed(() => (nu.value === null ? null : data.value.volgend ?? null))
const volgendWanneer = computed(() => {
  const v = volgend.value
  if (!v || nu.value === null) return ''
  const min = Math.round((Date.parse(v.wanneer) - nu.value) / 60000)
  const uur = new Date(v.wanneer).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
  if (min <= 0) return 'nu'
  if (min < 60) return `over ${min} ${min === 1 ? 'minuut' : 'minuten'}`
  const d = dagVan(v)
  if (d === vandaag.value) return `vandaag om ${uur}`
  if (d === plusDagenIso(vandaag.value, 1)) return `morgen om ${uur}`
  return `${new Date(v.wanneer).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ })} om ${uur}`
})
const vl = useVoorlezen()
const kanLezen = computed(() => nu.value !== null && !!functie('spraak.voorlezen')?.beschikbaar && vl.kan())
function leesVolgend() { if (vl.spreekt.value) vl.stop(); else if (volgend.value) vl.lees(`${volgend.value.account.naam}. ${volgend.value.drieRegels.join('. ')}`) }

// ── Zelf opzoeken: één veld voor prospects, klanten en contactpersonen ──────
type Treffer = { id: string; soort: 'account' | 'contact'; accountId: string; contactId?: string; naam: string; accountSoort: string; plaats?: string | null; functie?: string | null; accountNaam?: string }
const zoek = (t: string) => $fetch<Treffer[]>('/api/briefing/zoek', { query: { q: t.trim() || undefined } }).catch(() => [] as Treffer[])
const volgendVan = (accountId: string) => data.value.items.find((it: any) => it.onderwerp !== 'belblok' && it.account.id === accountId)
function trefferSub(t: Treffer) {
  if (t.soort === 'contact') return [t.functie, t.accountNaam].filter(Boolean).join(' bij ')
  const v = volgendVan(t.accountId)
  const d = v ? dagVan(v) : null
  return [t.accountSoort === 'klant' ? 'Klant' : 'Prospect', v ? `volgend gesprek ${!d ? 'zonder datum' : d < vandaag.value ? 'over tijd' : d === vandaag.value ? 'vandaag' : d === plusDagenIso(vandaag.value, 1) ? 'morgen' : new Date(v.wanneer).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ })}` : t.plaats].filter(Boolean).join(' · ')
}
function kies(t: Treffer) { zet({ account: t.accountId, contact: t.contactId }) }

// ── Flyouts ─────────────────────────────────────────────────────────────────
const gekozen = computed(() => (q('account') ? { id: q('account'), contact: q('contact') || null } : null))
const open = ref<{ onderwerp: 'afspraak' | 'taak'; id: string; tab?: 'drie' | 'hele'; pitstop?: boolean } | null>(null)
function openBriefing(it: any, opties: { tab?: 'drie' | 'hele'; pitstop?: boolean } = {}) { open.value = { onderwerp: it.onderwerp, id: it.id, ...opties } }
const taakOpen = ref<string | null>(null)
const afspraakOpen = ref<string | null>(null)
function openItem(g: { onderwerp: 'afspraak' | 'taak'; id: string }) {
  open.value = null; zet({ account: undefined, contact: undefined })
  if (g.onderwerp === 'taak') taakOpen.value = g.id; else afspraakOpen.value = g.id
}
function vanuitAccount(g: { onderwerp: 'afspraak' | 'taak'; id: string }) { zet({ account: undefined, contact: undefined }); open.value = { ...g, tab: 'hele' } }
const planOpen = ref(false)
async function gepland(id: string) { planOpen.value = false; await refresh(); afspraakOpen.value = id }
useHead({ title: 'Briefings · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="briefing.bewerken" />
    <template v-else>
      <PaginaKop titel="Briefings" uitleg="Vijf minuten vooraf weten of jij het gesprek stuurt. Elke briefing vult zich uit de accountkaart, je verslagen en je verkoopverhaal; jij past aan wat niet klopt." helpartikel="briefing-en-pitstop">
        <template #kicker><span class="kicker kicker--streep" data-test="briefings-kicker">{{ kicker }}</span></template>
        <template #acties>
          <button type="button" class="dd-actie dd-actie--zwart" data-test="briefings-afspraak" @click="planOpen = true"><Icoon naam="Plus" class="dd-actie-icoon" />Afspraak</button>
          <button type="button" class="dd-actie dd-actie--secundair" :class="{ 'bfp-filterknop--aan': filtersOpen || chips.length }" :aria-expanded="filtersOpen" data-test="briefings-filters" @click="filtersOpen = !filtersOpen">
            <Icoon naam="SlidersHorizontal" class="dd-actie-icoon" />Filters<span v-if="chips.length" class="bfp-teller">{{ chips.length }}</span><Icoon naam="ChevronDown" :grootte="14" class="bfp-pijl" :class="{ 'bfp-pijl--open': filtersOpen }" />
          </button>
        </template>
      </PaginaKop>

      <BriefingFilters
        v-if="filtersOpen" :groepen="groepen" :aan="isAan" :van="q('van')" :tot="q('tot')" :blad="scherm === 'telefoon'" :aantal="zichtbaar.length" :wisbaar="chips.length > 0"
        @zet="zetFilter" @datum="(v, w) => zet({ [v]: w || undefined })" @wis="wisAlles" @sluit="filtersOpen = false"
      />

      <section class="section section--laatste">
        <div class="container">
          <section v-if="volgend" class="bfp-volgend" aria-labelledby="bfp-volgend-titel" data-test="briefings-volgend">
            <div class="bfp-volgend-tekst">
              <span class="bfp-volgend-label">Je volgende gesprek · {{ volgendWanneer }}</span>
              <h2 id="bfp-volgend-titel" class="bfp-volgend-titel">{{ new Date(volgend.wanneer).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }) }} · {{ volgend.account.naam }}</h2>
              <p class="bfp-volgend-meta"><template v-if="volgend.contact">{{ [volgend.contact.naam, volgend.contact.functie].filter(Boolean).join(', ') }} · </template>{{ volgend.titel }} · <span class="pil" :class="`pil--${SOORT_KLEUR[volgend.soort as BriefingSoort] === 'zwart' ? 'geel' : SOORT_KLEUR[volgend.soort as BriefingSoort]}`">{{ SOORT_KORT[volgend.soort as BriefingSoort] }}</span></p>
              <ol class="bfp-volgend-regels"><li v-for="r in volgend.drieRegels" :key="r">{{ r }}</li></ol>
            </div>
            <div class="bfp-volgend-acties">
              <button type="button" class="dd-actie dd-actie--primair" data-test="volgend-open" @click="openBriefing(volgend)"><Icoon naam="FileText" class="dd-actie-icoon" />Open briefing</button>
              <button v-if="kanLezen" type="button" class="dd-actie dd-actie--secundair bfp-volgend-knop" :aria-pressed="vl.spreekt.value" data-test="volgend-lees-voor" @click="leesVolgend"><Icoon :naam="vl.spreekt.value ? 'VolumeX' : 'Volume2'" class="dd-actie-icoon" />{{ vl.spreekt.value ? 'Stop' : 'Lees voor' }}</button>
              <button type="button" class="dd-actie dd-actie--secundair bfp-volgend-knop" data-test="volgend-bereid-voor" @click="openBriefing(volgend, { tab: 'hele', pitstop: !volgend.pitstop })"><Icoon naam="Sparkles" class="dd-actie-icoon" />{{ volgend.pitstop ? 'Bekijk concept' : 'Bereid voor' }}</button>
            </div>
          </section>

          <section class="kaart bfp-zoek" aria-labelledby="bfp-zoek-titel" data-test="briefing-zoeken">
            <h2 id="bfp-zoek-titel" class="kicker kicker--streep">Briefing opzoeken</h2>
            <div class="mt-8">
              <ZoekKiezer
                :zoek="zoek" labelledby="bfp-zoek-titel" placeholder="Zoek een prospect, klant of contactpersoon" data-test="bf-zoek" :optie-test="() => 'bf-zoek-optie'"
                :sub="trefferSub" leeg="Niets gevonden. Zoek op een deel van de naam." @kies="kies"
              >
                <template #optie="{ item }"><span class="bfp-treffer"><Icoon :naam="item.soort === 'contact' ? 'CircleUser' : 'Building2'" :grootte="14" /><span class="zk-naam">{{ item.naam }}</span><span class="zoeklijst-sub"> · {{ trefferSub(item) }}</span></span></template>
              </ZoekKiezer>
            </div>
            <p class="meta mt-8">Kies je een contactpersoon, dan staan zijn laatste contact en zijn volgende gesprekken in de briefing.</p>
          </section>

          <div class="bfp-resultaat" aria-live="polite" data-test="briefings-resultaat">
            <span class="bfp-tel tnum" data-test="briefings-aantal">{{ zichtbaar.length }} <small>{{ zichtbaar.length === 1 ? 'briefing' : 'briefings' }}</small></span>
            <span v-for="c in chips" :key="c.sleutel" class="bfp-chip" :data-test="`chip-${c.sleutel}`"><span><em>{{ c.label }}:</em> {{ c.tekst }}</span><button type="button" :aria-label="`Wis ${c.label} ${c.tekst}`" @click="c.wis()"><Icoon naam="X" :grootte="14" /></button></span>
            <button v-if="chips.length" type="button" class="dd-tekstknop" data-test="chips-wis-alles" @click="wisAlles">Wis alles</button>
          </div>

          <LegeStaat
            v-if="!zichtbaar.length && !pending" kicker="Niets gepland" titel="Geen briefings in dit filter."
            :tekst="data.items.length ? 'Er zijn wel briefings in deze periode, maar niet binnen de gekozen filters.' : 'Geen afspraken, beltaken of belblokken met een prospect of klant in deze periode. Zoek hierboven zelf een bedrijf of kies een andere periode.'"
          >
            <button v-if="chips.length" type="button" class="dd-act mt-8" @click="wisAlles">Wis de filters</button>
          </LegeStaat>
          <div v-else data-test="briefings">
            <section v-for="g in lijst" :key="g.sleutel" class="bfp-dag" :data-test="`briefings-dag-${g.sleutel}`">
              <header class="bfp-dagkop" :class="{ 'bfp-dagkop--rood': g.rood }"><h2 class="bfp-dagtitel">{{ g.titel }}</h2><span class="meta tnum">{{ g.items.length }} {{ g.items.length === 1 ? 'briefing' : 'briefings' }}</span></header>
              <div :class="weergave === 'lijst' ? 'bfp-lijst' : 'bfp-raster'">
                <BriefingKaart v-for="it in g.items" :key="it.id" :item="it" :vandaag="vandaag" :weergave="weergave" @open="openBriefing" />
              </div>
            </section>
            <p v-if="data.meer" class="meta mt-16" data-test="briefings-meer">Nog {{ data.meer }} {{ data.meer === 1 ? 'gesprek' : 'gesprekken' }} later in deze periode. Kies een kortere periode om ze te zien.</p>
          </div>
        </div>
      </section>

      <BriefingDetail
        v-if="open" :key="`${open.onderwerp}:${open.id}`" :onderwerp="open.onderwerp" :id="open.id" :tab="open.tab" :pitstop="open.pitstop"
        @sluit="open = null" @gewijzigd="refresh()" @open-item="openItem" @gesprek="(g) => (open = { ...g, tab: 'hele' })"
      />
      <BriefingDetail
        v-else-if="gekozen" :key="`account:${gekozen.id}:${gekozen.contact ?? ''}`" onderwerp="account" :id="gekozen.id" :contact-id="gekozen.contact" tab="hele"
        @sluit="zet({ account: undefined, contact: undefined })" @wis-contact="zet({ contact: undefined })" @gesprek="vanuitAccount"
      />
      <TaakFlyout :open="!!taakOpen" :taak-id="taakOpen" @sluit="taakOpen = null" @klaar="refresh()" @gewijzigd="refresh()" />
      <AfspraakFlyout :open="!!afspraakOpen" :afspraak-id="afspraakOpen" @sluit="afspraakOpen = null" @gewijzigd="refresh()" />
      <PlanAfspraakFlyout :open="planOpen" @sluit="planOpen = false" @gepland="gepland" />
    </template>
  </div>
</template>

<style scoped>
.bfp-filterknop--aan { background: var(--ink); color: var(--yellow); border-color: var(--ink); }
.bfp-teller { display: inline-flex; align-items: center; height: 18px; padding: 0 7px; margin-left: 2px; background: var(--yellow); color: var(--ink); font-size: 11px; font-weight: 800; border-radius: 2px; }
.bfp-pijl { transition: transform var(--transition-fast); }
.bfp-pijl--open { transform: rotate(180deg); }
.bfp-volgend { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 16px 24px; align-items: start; margin-bottom: 24px; padding: 24px; background: var(--ink); color: var(--wit); border-radius: var(--radius); }
.bfp-volgend-label { font-size: var(--fs-label); font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--yellow); }
.bfp-volgend-titel { margin: 6px 0 2px; font-family: var(--font-serif); font-size: 26px; line-height: 1.2; color: var(--wit); overflow-wrap: anywhere; }
.bfp-volgend-meta { margin: 0; font-size: 13px; color: var(--muted-light); }
.bfp-volgend-regels { display: grid; gap: 6px; margin: 14px 0 0; padding-left: 20px; font-size: 14.5px; line-height: 1.5; }
.bfp-volgend-acties { display: flex; flex-direction: column; gap: 8px; min-width: 200px; }
.bfp-volgend .bfp-volgend-knop { background: transparent; color: var(--wit); border-color: var(--muted); }
.bfp-volgend .bfp-volgend-knop:hover { border-color: var(--yellow); color: var(--yellow); }
.bfp-zoek { padding: 20px 24px; }
.bfp-treffer { display: inline-flex; align-items: center; gap: 8px; max-width: 100%; overflow: hidden; }
.bfp-resultaat { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 24px 0 4px; }
.bfp-tel { margin-right: 4px; font-family: var(--font-serif); font-size: 22px; font-weight: 700; }
.bfp-tel small { font-family: var(--font-sans); font-size: 13px; font-weight: 600; color: var(--muted); }
.bfp-chip { display: inline-flex; align-items: center; gap: 4px; min-height: 32px; padding: 0 2px 0 10px; background: var(--wit); border: 1px solid var(--border-strong); border-radius: var(--radius); font-size: 12px; font-weight: 600; }
.bfp-chip em { font-style: normal; color: var(--muted); }
.bfp-chip button { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; padding: 0; background: none; border: 0; color: var(--muted); cursor: pointer; }
.bfp-chip button:hover { color: var(--ink); }
.bfp-dagkop { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin: 28px 0 12px; padding-bottom: 8px; border-bottom: 2px solid var(--ink); }
.bfp-dagkop--rood { border-bottom-color: var(--red); }
.bfp-dagkop--rood .bfp-dagtitel { color: var(--red); }
.bfp-dagtitel { margin: 0; font-family: var(--font-serif); font-size: 20px; }
.bfp-raster { display: grid; grid-template-columns: 1fr; gap: var(--kaart-gap); }
@media (min-width: 720px) { .bfp-raster { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 1100px) { .bfp-raster { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.bfp-lijst { display: grid; gap: 6px; }
@media (max-width: 900px) {
  .bfp-volgend { grid-template-columns: minmax(0, 1fr); }
  .bfp-volgend-acties { flex-direction: row; flex-wrap: wrap; min-width: 0; }
  .bfp-volgend-acties .dd-actie { flex: 1 1 auto; }
}
@media (max-width: 719px) {
  .bfp-volgend, .bfp-zoek { padding: 16px; }
  .bfp-volgend-titel { font-size: 22px; }
  .bfp-chip { min-height: var(--touch-target-min); }
  .bfp-chip button { width: var(--touch-target-min); height: var(--touch-target-min); }
  .bfp-resultaat .dd-tekstknop { min-height: var(--touch-target-min); }
}
</style>
