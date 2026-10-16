<script setup lang="ts">
// Notificaties (F24, P26) in de opzet van DealDrive: de kop vat samen hoeveel er ongelezen is, met
// "Alles gelezen" en Voorkeuren (kanalen per soort); een strook met tellers per soort die filteren;
// Ongelezen of Alles; en de meldingen als kaarten, drie naast elkaar (twee op een tablet, één op de
// telefoon). Filters staan in de URL (soort, alle=1; standaard alleen ongelezen). "Gelezen" staat op de
// server en geldt op al je toestellen; "Gelezen" en "Verberg" lopen via de sync-wachtrij, dus ook
// offline. Klik op een kaart opent de link van de melding. /meldingen stuurt hierheen door.
import { MELDING_SOORT_LABEL, MELDING_SOORTEN, soortVan, type MeldingSoort } from '~~/shared/kanalen'
interface Melding { id: string; soort: string; titel: string; tekst: string | null; link: string | null; gelezenOp: string | null; op: string }
const { voegToe } = useSyncQueue()
const toast = useToast()
const route = useRoute()
const router = useRouter()
const ongelezenTeller = useState<number>('ongelezen', () => 0)
const { data: alle, refresh } = await useFetch<Melding[]>('/api/notificaties', { key: 'notificaties', default: () => [] })
const soort = computed<MeldingSoort | undefined>(() => (MELDING_SOORTEN as readonly string[]).includes(route.query.soort as string) ? route.query.soort as MeldingSoort : undefined)
const alleenOngelezen = computed(() => route.query.alle !== '1')
const zet = (k: string, v: string | undefined) => router.replace({ query: { ...route.query, [k]: v } })
const voorkeuren = ref(route.query.voorkeuren === '1')

// Een melding die je hier net gelezen hebt, blijft in de lijst Ongelezen staan tot je de pagina verlaat.
const bijgewerkt = reactive(new Set<string>())
const ongelezen = computed(() => alle.value.filter((n) => !n.gelezenOp))
const perSoort = computed(() => MELDING_SOORTEN.map((s) => {
  const lijst = alle.value.filter((n) => soortVan(n.soort) === s)
  return { soort: s, totaal: lijst.length, ongelezen: lijst.filter((n) => !n.gelezenOp).length }
}))
const zichtbaar = computed(() => alle.value.filter((n) => (!soort.value || soortVan(n.soort) === soort.value) && (!alleenOngelezen.value || !n.gelezenOp || bijgewerkt.has(n.id))))
const titel = computed(() => (ongelezen.value.length === 0 ? 'Alles bijgewerkt.' : `${ongelezen.value.length} ${ongelezen.value.length === 1 ? 'melding' : 'meldingen'} ongelezen.`))
// De teller bij de bel pas na het laden bijwerken: de zijbalk is op de server al getekend voor deze pagina
// zijn meldingen had, dus een wijziging tijdens het tekenen gaf een hydration-mismatch (B10).
onMounted(() => { watch(ongelezen, (o) => { ongelezenTeller.value = o.length }, { immediate: true }) })

function vervang(id: string, nieuw: Partial<Melding> | null) {
  alle.value = nieuw ? alle.value.map((x) => (x.id === id ? { ...x, ...nieuw } : x)) : alle.value.filter((x) => x.id !== id)
}
async function gelezen(n: Melding) {
  if (n.gelezenOp) return
  const op = new Date().toISOString()
  bijgewerkt.add(n.id)
  vervang(n.id, { gelezenOp: op })
  await voegToe({ tabel: 'notificaties', op: 'patch', recordId: n.id, patch: { gelezenOp: op } })
}
async function verberg(n: Melding) {
  vervang(n.id, null)
  await voegToe({ tabel: 'notificaties', op: 'patch', recordId: n.id, patch: { verborgenOp: new Date().toISOString() } })
}
async function open(n: Melding) {
  if (!n.gelezenOp) await gelezen(n)
  if (n.link) await navigateTo(n.link)
}
async function allesGelezen() {
  try { await $fetch('/api/notificaties/alles-gelezen', { method: 'POST' }); bijgewerkt.clear(); await refresh(); toast.toon('Alles gelezen.') } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const legeTekst = computed(() => {
  const s = soort.value ? `${MELDING_SOORT_LABEL[soort.value].toLowerCase()}-meldingen` : 'meldingen'
  return alleenOngelezen.value ? `Geen ongelezen ${s}. Kies Alles om ook gelezen ${s} te zien.` : 'Je hoort het hier zodra er iets voor je klaarstaat.'
})
useHead({ title: 'Notificaties · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Notificaties" :titel="titel" uitleg="Herinneringen, aanleidingen en wat er voor je klaarstaat." helpartikel="meldingen-instellen">
      <template #acties>
        <button v-if="ongelezen.length" type="button" class="dd-actie dd-actie--zwart" data-test="alles-gelezen" @click="allesGelezen"><Icoon naam="CircleCheck" class="dd-actie-icoon" />Alles gelezen</button>
        <button type="button" class="dd-actie dd-actie--secundair" :aria-expanded="voorkeuren" data-test="voorkeuren-knop" @click="voorkeuren = !voorkeuren"><Icoon naam="Settings" class="dd-actie-icoon" />Voorkeuren</button>
      </template>
    </PaginaKop>

    <section v-if="voorkeuren" class="section nt-sectie">
      <div class="container"><NotificatieKanalen @gewijzigd="refresh()" /></div>
    </section>

    <section class="section nt-sectie">
      <div class="container">
        <div class="nt-stats" data-test="melding-stats">
          <button type="button" class="nt-stat" :class="{ 'nt-stat--aan': !soort }" :aria-pressed="!soort" data-test="stat-alles" @click="zet('soort', undefined)">
            <span class="nt-stat-label">Alles</span>
            <span class="nt-stat-num tnum">{{ alle.length }}</span>
            <span class="nt-stat-voet">{{ ongelezen.length }} ongelezen</span>
          </button>
          <button v-for="s in perSoort" :key="s.soort" type="button" class="nt-stat" :class="[`nt-stat--${s.soort}`, { 'nt-stat--aan': soort === s.soort }]" :aria-pressed="soort === s.soort" :data-test="`stat-${s.soort}`" @click="zet('soort', soort === s.soort ? undefined : s.soort)">
            <span class="nt-stat-label">{{ MELDING_SOORT_LABEL[s.soort] }}</span>
            <span class="nt-stat-num tnum">{{ s.totaal }}</span>
            <span class="nt-stat-voet">{{ s.ongelezen }} ongelezen</span>
          </button>
        </div>

        <div class="nt-balk" data-test="melding-filters">
          <div class="nt-pillen" role="group" aria-label="Gelezen of ongelezen">
            <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': alleenOngelezen }" :aria-pressed="alleenOngelezen" data-test="filter-ongelezen" @click="zet('alle', undefined)">Ongelezen<span v-if="ongelezen.length" class="nt-pil-teller tnum">{{ ongelezen.length }}</span></button>
            <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': !alleenOngelezen }" :aria-pressed="!alleenOngelezen" data-test="filter-alles" @click="zet('alle', '1')">Alles</button>
          </div>
          <span class="nt-aantal tnum" data-test="melding-aantal">{{ zichtbaar.length }} {{ zichtbaar.length === 1 ? 'melding' : 'meldingen' }}<template v-if="soort"> · {{ MELDING_SOORT_LABEL[soort] }}</template></span>
        </div>

        <LegeStaat v-if="!zichtbaar.length" titel="Geen meldingen." :tekst="legeTekst" data-test="melding-leeg" />
        <ul v-else class="nt-raster" data-test="melding-raster">
          <NotificatieKaart v-for="n in zichtbaar" :key="n.id" :melding="n" @open="open(n)" @gelezen="gelezen(n)" @verberg="verberg(n)" />
        </ul>
      </div>
    </section>
  </div>
</template>

<style scoped>
.nt-sectie { padding-top: 0; }
/* Ruimte tussen de lijn onder de kop en de tellers per soort, zodat ze er niet tegenaan of overheen staan. */
.nt-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--kaart-gap); margin: 24px 0 20px; }
@media (min-width: 720px) { .nt-stats { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
@media (min-width: 1100px) { .nt-stats { grid-template-columns: repeat(7, minmax(0, 1fr)); } }
.nt-stat { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; min-width: 0; padding: 14px 16px; background: var(--wit); border: 1px solid var(--border); border-left: 3px solid var(--border-strong); text-align: left; font: inherit; color: var(--ink); cursor: pointer; transition: border-color var(--transition-fast); }
.nt-stat:hover { border-color: var(--ink); }
.nt-stat--kritiek { border-left-color: var(--red); }
.nt-stat--hot { border-left-color: var(--purple); }
.nt-stat--dagstart { border-left-color: var(--blue); }
.nt-stat--herinnering { border-left-color: var(--yellow); }
.nt-stat--inzicht { border-left-color: var(--green); }
.nt-stat--systeem { border-left-color: var(--ink); }
.nt-stat--aan { background: var(--ink); border-color: var(--ink); color: var(--wit); }
.nt-stat--aan .nt-stat-label, .nt-stat--aan .nt-stat-voet { color: var(--wit-70); }
.nt-stat-label { font-size: var(--fs-label); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.nt-stat-num { font-family: var(--font-serif); font-size: 26px; font-weight: 700; line-height: 1; }
.nt-stat-voet { font-size: 11px; color: var(--muted); }
.nt-balk { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
.nt-pillen { display: flex; gap: 8px; flex-wrap: wrap; }
.nt-pil-teller { margin-left: 6px; font-size: 11px; font-weight: 800; }
.nt-aantal { font-size: 13px; color: var(--muted); }
.nt-raster { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--kaart-gap); align-items: stretch; }
@media (min-width: 720px) { .nt-raster { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 1100px) { .nt-raster { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 719px) {
  .nt-stats { gap: 8px; margin-top: 16px; }
  .nt-stat { min-height: var(--touch-target-min); padding: 10px; gap: 2px; }
  .nt-stat-num { font-size: 20px; }
  .nt-stat-voet { font-size: 10px; }
  .nt-pillen .filter-pil { min-height: var(--touch-target-min); }
}
</style>
