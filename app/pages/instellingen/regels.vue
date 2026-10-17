<script setup lang="ts">
// Regels (F15) in de opzet van DealDrive /instellingen/activity-selling: kop met terug naar Instellingen,
// tellers en de acties (Draai motor nu, Prospectreizen, Exporteren, Importeren, Back-up, Starterset), Filters
// met een paneel, en master en detail: links de lijst (aan of uit, categorie en code, naam, motor, fase,
// prioriteitsstip) en rechts het bewerkpaneel (RegelPaneel) met live voorbeeld en droogloop. Opslaan per veld
// na 600 ms. Dealtrace: elke regel hoort bij de prospectreis (fases, of een overgang als trigger) en kan
// winpunten aan de activiteit koppelen. Gevorderd leest; Expert bewerkt alleen zijn persoonlijke regels.
import { NB_STATUSSEN } from '~~/shared/nbStatus'
import { CATEGORIEEN, UITVOERDERROLLEN, sjabloonFouten } from '~~/shared/regelPatronen'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { functie } = useMe()
const magLezen = computed(() => ['regels.lezen', 'regels.team', 'regels.beheer'].some((s) => functie(s)?.beschikbaar))
const { data, refresh } = await useFetch<any>('/api/regels', { immediate: magLezen.value, default: () => ({ regels: [], tellers: {}, keuzes: { patronen: [], cadansen: [], reizen: [], doelgroepen: [], teams: [], winpunten: [], gebeurtenissen: [] }, kan: {} }) })
const klein = ref(false)
onMounted(() => { klein.value = window.matchMedia('(max-width: 767px)').matches })

// Filters in de URL.
const f = (k: string) => String(route.query[k] ?? '')
function zetFilter(k: string, w: string) { router.replace({ query: { ...route.query, [k]: w || undefined } }) }
const FILTER_SLEUTELS = ['q', 'categorie', 'bron', 'reis', 'fase', 'status', 'rol', 'motor', 'aan', 'winpunt'] as const
const filtersOpen = ref(false)
const actieveFilters = computed(() => FILTER_SLEUTELS.filter((k) => k !== 'q' && f(k)).length)
function wisFilters() { router.replace({ query: { regel: f('regel') || undefined } }) }
const fasesVan = (r: any) => [...(r.data.afbakening.faseIds ?? []), ...(r.faseId ? [r.faseId] : [])]
const lijst = computed(() => data.value.regels.filter((r: any) => {
  if (f('q') && !`${r.code ?? ''} ${r.naam} ${r.categorie} ${r.data.subcategorie ?? ''} ${r.data.omschrijving} ${r.data.gevolg.taaksjabloon ?? ''}`.toLowerCase().includes(f('q').toLowerCase())) return false
  if (f('categorie') && r.categorie !== f('categorie')) return false
  if (f('bron') && r.data.bron !== f('bron')) return false
  if (f('reis') && r.reisId !== f('reis')) return false
  if (f('fase') === '__geen__' && fasesVan(r).length) return false
  if (f('fase') && f('fase') !== '__geen__' && !fasesVan(r).includes(f('fase')) && !(r.data.trigger.patroon === 'reis-overgang' && r.data.trigger.parameters.naarFase === f('fase'))) return false
  if (f('status') && !(r.data.afbakening.statussen ?? []).includes(f('status'))) return false
  if (f('rol') && r.data.gevolg.uitvoerderrol !== f('rol')) return false
  if (f('motor') === '1' && r.data.activiteit !== 'taak') return false
  if (f('aan') === 'aan' && !r.actief) return false
  if (f('aan') === 'uit' && r.actief) return false
  if (f('winpunt') === '1' && !(r.data.gevolg.winpuntIds ?? []).length) return false
  return true
}))
const reizen = computed(() => data.value.keuzes.reizen)
const filterReis = computed(() => reizen.value.find((r: any) => r.id === f('reis')) ?? reizen.value[0] ?? null)
const faseLabel = computed(() => new Map<string, string>(reizen.value.flatMap((r: any) => r.fases.map((x: any) => [x.id, x.label]))))
const faseHoofd = computed(() => new Map<string, string>(reizen.value.flatMap((r: any) => r.fases.map((x: any) => [x.id, x.hoofdfase]))))
const teller = (fase: string) => data.value.regels.filter((r: any) => fasesVan(r).includes(fase)).length

// Bewerken
const gekozen = computed(() => data.value.regels.find((r: any) => r.id === f('regel')) ?? null)
const bewerk = ref<any>(null)
const leesStand = computed(() => klein.value || !bewerk.value?.kanSchrijven)
const beperkt = computed(() => !!bewerk.value?.alleenBeperkt)
const status = ref('')
const droog = ref<any>(null)
const bevestig = ref<null | { tekst: string; doe: () => Promise<void> }>(null)
let timer: any
async function doeDroogloop() {
  if (!bewerk.value) { droog.value = null; return }
  try { droog.value = await $fetch(`/api/regels/${bewerk.value.id}/droogloop`, { method: 'POST', body: { regel: bewerk.value } }) } catch { droog.value = null }
}
watch(gekozen, (r, oud) => {
  // Na een refresh van dezelfde regel de bewerkte stand houden (anders springt een veld terug tijdens typen).
  if (r && oud && r.id === oud.id && bewerk.value?.id === r.id) { bewerk.value.versie = r.versie; bewerk.value.trigger = r.trigger; return }
  bewerk.value = r ? JSON.parse(JSON.stringify(r)) : null
  void doeDroogloop()
}, { immediate: true })
function wijzig() {
  if (leesStand.value) return
  status.value = 'Opslaan…'
  clearTimeout(timer)
  timer = setTimeout(async () => {
    await doeDroogloop()
    const groot = droog.value?.perPersoon?.find((p: any) => p.taken > 50)
    if (droog.value?.vraagtBevestiging && groot) {
      bevestig.value = { tekst: `Deze regel maakt bij de volgende run ${groot.taken} taken voor ${groot.naam.replace(/^Testgebruiker /, '').split(' ')[0]}. Toch opslaan?`, doe: bewaar }
      status.value = ''
      return
    }
    await bewaar()
  }, 600)
}
async function bewaar() {
  bevestig.value = null
  const b = bewerk.value
  const fouten = sjabloonFouten(b.data.gevolg.taaksjabloon ?? '')
  if (fouten.length) { status.value = 'Opslaan mislukt'; toast.toon(fouten.join('; '), 'fout'); return }
  const patch = beperkt.value
    ? { versie: b.versie, actief: b.actief, cadansDagen: b.cadansDagen, data: { trigger: { parameters: b.data.trigger.parameters }, afbakening: { klassen: b.data.afbakening.klassen } } }
    : { versie: b.versie, naam: b.naam, categorie: b.categorie, actief: b.actief, motor: b.motor, cadansDagen: b.cadansDagen, prioriteit: b.prioriteit, reisId: b.reisId, faseId: b.faseId, data: b.data }
  try {
    const na = await $fetch<any>(`/api/regels/${b.id}`, { method: 'PUT', body: patch })
    bewerk.value.versie = na.versie
    status.value = 'Opgeslagen'
    await refresh()
  } catch (e) { status.value = 'Opslaan mislukt'; toast.toon(foutTekst(e), 'fout') }
}
function kies(id: string) { zetFilter('regel', id) }
function wisselActief(r: any) {
  if (!r.kanSchrijven || klein.value) return
  $fetch<any>(`/api/regels/${r.id}`, { method: 'PUT', body: { actief: !r.actief, versie: r.versie } })
    .then(async (na) => { if (bewerk.value?.id === r.id) Object.assign(bewerk.value, { actief: na.actief, versie: na.versie }); await refresh() })
    .catch((e) => toast.toon(foutTekst(e), 'fout'))
}

// Acties bovenaan
const motorBezig = ref(false)
async function draaiMotor() {
  motorBezig.value = true
  try { const r = await $fetch<any>('/api/motor/run', { method: 'POST', body: {} }); toast.toon(`Motor gedraaid. ${r.taken} ${r.taken === 1 ? 'taak' : 'taken'} en ${r.inzichten} ${r.inzichten === 1 ? 'inzicht' : 'inzichten'} klaargezet.`); await doeDroogloop() } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { motorBezig.value = false }
}
async function exporteer() {
  const r = await fetch('/api/regels/excel-export', { method: 'POST' })
  if (!r.ok) { toast.toon('Exporteren mislukt', 'fout'); return }
  const url = URL.createObjectURL(await r.blob())
  const a = document.createElement('a'); a.href = url; a.download = 'dealtrace-regels.xlsx'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
  toast.toon(`${data.value.regels.length} regels geëxporteerd naar Excel.`)
}
const importOpen = ref(false)
async function importKlaar() { importOpen.value = false; await refresh() }
const backupTerugOpen = ref(false)
async function backup(terugzetten = false) {
  backupTerugOpen.value = false
  try { const r = await $fetch<any>('/api/regels/backup', { method: 'POST', body: { terugzetten } }); toast.toon(terugzetten ? `Back-up van ${new Date(r.op).toLocaleString('nl-NL')} teruggezet.` : `Back-up gemaakt van ${r.aantal} regels.`); if (terugzetten) await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const startersetOpen = ref(false)
async function starterset() {
  startersetOpen.value = false
  try { await $fetch('/api/regels/starterset', { method: 'POST', body: { bevestigd: true } }); toast.toon('De starterset van 23 regels staat er weer.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const nieuwOpen = ref(false)
async function regelGemaakt(id: string) { nieuwOpen.value = false; await refresh(); kies(id) }
async function stelVoor(tekst: string) {
  try { await $fetch(`/api/regels/${bewerk.value.id}/voorstel`, { method: 'POST', body: { tekst } }); toast.toon('Je voorstel staat bij je salesmanager.') } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const verwijderOpen = ref(false)
async function verwijder() {
  verwijderOpen.value = false
  const zichtbaar = lijst.value
  const i = zichtbaar.findIndex((r: any) => r.id === bewerk.value.id)
  const volgende = zichtbaar[i + 1] ?? zichtbaar[i - 1] ?? null
  try { await $fetch(`/api/regels/${bewerk.value.id}`, { method: 'DELETE' }); toast.toon('Regel verwijderd.'); zetFilter('regel', volgende?.id ?? ''); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const magVerwijderen = computed(() => !!bewerk.value && (data.value.kan.beheer || bewerk.value.scope === 'persoonlijk'))
const PRIO_STIP: Record<string, string> = { hoog: 'prio-stip--high', middel: 'prio-stip--medium', laag: 'prio-stip--low' }
const ROL_LABEL: Record<string, string> = { binnendienst: 'Binnendienst', buitendienst: 'Buitendienst', eigenaar: 'Eigenaar', salesmanager: 'Salesmanager' }
const uitleg = computed(() => `${data.value.tellers.actief ?? 0} actief · ${data.value.tellers.uit ?? 0} uit · ${data.value.tellers.motor ?? 0} door de motor · ${data.value.tellers.totaal ?? 0} totaal`)
useHead({ title: 'Regels · Instellingen · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!magLezen" sleutel="regels.lezen" />
    <template v-else>
      <PaginaKop titel="Regels" :uitleg="uitleg" helpartikel="regels">
        <template #kicker>
          <span class="rg-kicker">
            <NuxtLink to="/instellingen" class="rg-terug" data-test="terug-instellingen"><Icoon naam="ArrowLeft" :grootte="14" />Alle instellingen</NuxtLink>
            <span class="kicker kicker--streep">Methodiek · Activity selling</span>
          </span>
        </template>
        <template #acties>
          <span v-if="status" class="meta rg-status" role="status" data-test="opslagstatus">{{ status }}</span>
          <button v-if="data.kan.motor" type="button" class="dd-actie dd-actie--primair" :disabled="motorBezig" data-test="draai-motor" @click="draaiMotor"><Icoon naam="Play" class="dd-actie-icoon" />{{ motorBezig ? 'Motor draait…' : 'Draai motor nu' }}</button>
          <button v-if="data.kan.persoonlijk || data.kan.team || data.kan.beheer" type="button" class="dd-actie dd-actie--zwart alleen-groot" data-test="regel-nieuw" @click="nieuwOpen = true"><Icoon naam="Plus" class="dd-actie-icoon" />Regel</button>
          <button type="button" class="dd-actie dd-actie--secundair" :class="{ 'rg-filters--aan': filtersOpen || actieveFilters }" :aria-expanded="filtersOpen" aria-controls="rg-filterpaneel" data-test="regel-filters-knop" @click="filtersOpen = !filtersOpen">
            <Icoon naam="SlidersHorizontal" class="dd-actie-icoon" />Filters<span v-if="actieveFilters" class="rg-teller">{{ actieveFilters }}</span><Icoon naam="ChevronDown" :grootte="14" class="rg-pijl" :class="{ 'rg-pijl--open': filtersOpen }" />
          </button>
        </template>
      </PaginaKop>
      <section class="section section--laatste">
        <div class="container">
          <p class="alleen-groot-melding kaart kaart--geel">Beter op een groot scherm. Hier lees je de regels; bewerken doe je op een laptop.</p>
          <div class="rg-balk" data-test="regel-knoppen">
            <div class="rg-zoek">
              <Icoon naam="Search" :grootte="16" class="rg-zoek-icoon" />
              <input class="invoer" type="search" :value="f('q')" placeholder="Zoek regel" aria-label="Zoek regel" data-test="regel-zoek" @input="zetFilter('q', ($event.target as HTMLInputElement).value)">
            </div>
            <div class="rg-knoppen">
              <FunctieLink to="/reizen" class="dd-act"><Icoon naam="Route" :grootte="15" />Prospectreizen</FunctieLink>
              <button v-if="data.kan.export" type="button" class="dd-act" data-test="exporteren" @click="exporteer"><Icoon naam="Download" :grootte="15" />Exporteren</button>
              <template v-if="data.kan.beheer">
                <button type="button" class="dd-act" data-test="importeren" @click="importOpen = true"><Icoon naam="Upload" :grootte="15" />Importeren</button>
                <button type="button" class="dd-act" data-test="backup" @click="backup(false)"><Icoon naam="Archive" :grootte="15" />Back-up</button>
                <button type="button" class="dd-act" data-test="backup-terug" @click="backupTerugOpen = true">Back-up terugzetten</button>
                <button type="button" class="dd-act" data-test="starterset" @click="startersetOpen = true">Starterset terugzetten</button>
              </template>
            </div>
          </div>
          <div v-if="filtersOpen" id="rg-filterpaneel" class="rg-paneel" data-test="regel-filters">
            <div class="rg-groep"><span class="filter-label">Status</span>
              <button v-for="[k, l] in [['', 'Alle'], ['aan', 'Aan'], ['uit', 'Uit']]" :key="k" type="button" class="filter-pil" :class="{ 'filter-pil--aan': f('aan') === k }" :aria-pressed="f('aan') === k" @click="zetFilter('aan', k!)">{{ l }}</button>
              <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': f('motor') === '1' }" :aria-pressed="f('motor') === '1'" data-test="filter-motor" @click="zetFilter('motor', f('motor') === '1' ? '' : '1')">Alleen motorregels</button>
              <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': f('winpunt') === '1' }" :aria-pressed="f('winpunt') === '1'" data-test="filter-winpunt" @click="zetFilter('winpunt', f('winpunt') === '1' ? '' : '1')">Met winpunt</button>
            </div>
            <div class="rg-groep"><span class="filter-label">Bron</span>
              <button v-for="[k, l] in [['', 'Beide bronnen'], ['intern', 'Intern'], ['extern', 'Extern']]" :key="k" type="button" class="filter-pil" :class="{ 'filter-pil--aan': f('bron') === k }" :aria-pressed="f('bron') === k" @click="zetFilter('bron', k!)">{{ l }}</button>
            </div>
            <div v-if="reizen.length > 1" class="rg-groep"><span class="filter-label">Reis</span>
              <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': !f('reis') }" :aria-pressed="!f('reis')" @click="zetFilter('reis', '')">Alle reizen</button>
              <button v-for="r in reizen" :key="r.id" type="button" class="filter-pil" :class="{ 'filter-pil--aan': f('reis') === r.id }" :aria-pressed="f('reis') === r.id" @click="zetFilter('reis', r.id)">{{ r.naam }}</button>
            </div>
            <div class="rg-groep" data-test="filter-fase"><span class="filter-label">Fase</span>
              <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': !f('fase') }" :aria-pressed="!f('fase')" @click="zetFilter('fase', '')">Alle fases</button>
              <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': f('fase') === '__geen__' }" :aria-pressed="f('fase') === '__geen__'" data-test="fase-filter-geen" @click="zetFilter('fase', '__geen__')">Zonder fase</button>
              <button v-for="x in filterReis?.fases ?? []" :key="x.id" type="button" class="filter-pil" :class="{ 'filter-pil--aan': f('fase') === x.id }" :aria-pressed="f('fase') === x.id" :data-test="`fase-filter-${x.id}`" @click="zetFilter('fase', x.id)">{{ x.label }}<span class="rg-pil-tel tnum">{{ teller(x.id) }}</span></button>
            </div>
            <div class="rg-groep rg-groep--selects">
              <label class="rg-select"><span class="filter-label">Categorie</span><select class="invoer invoer--klein" :value="f('categorie')" data-test="filter-categorie" @change="zetFilter('categorie', ($event.target as HTMLSelectElement).value)"><option value="">Alle categorieën</option><option v-for="c in CATEGORIEEN" :key="c" :value="c">{{ c }}</option></select></label>
              <label class="rg-select"><span class="filter-label">Prospectstatus</span><select class="invoer invoer--klein" :value="f('status')" @change="zetFilter('status', ($event.target as HTMLSelectElement).value)"><option value="">Alle statussen</option><option v-for="s in NB_STATUSSEN" :key="s" :value="s">{{ s }}</option></select></label>
              <label class="rg-select"><span class="filter-label">Uitvoerder</span><select class="invoer invoer--klein" :value="f('rol')" @change="zetFilter('rol', ($event.target as HTMLSelectElement).value)"><option value="">Alle uitvoerders</option><option v-for="u in UITVOERDERROLLEN" :key="u" :value="u">{{ ROL_LABEL[u] }}</option></select></label>
              <button v-if="actieveFilters" type="button" class="dd-act" data-test="reset-filters" @click="wisFilters">Filters wissen</button>
            </div>
          </div>
          <div class="regels-raster mt-16">
            <aside class="kaart regels-lijst rg-lijst" aria-label="Regellijst" data-test="regel-lijst">
              <header class="rg-lijst-kop">
                <h2 class="rg-lijst-titel">Regels</h2>
                <span class="meta">{{ data.tellers.actief ?? 0 }} van {{ data.tellers.totaal ?? 0 }} aan · {{ lijst.length }} in dit filter</span>
              </header>
              <LegeStaat v-if="!data.regels.length" titel="Nog geen regels." tekst="Maak er een met + Regel, of haal de starterset terug." />
              <template v-else-if="!lijst.length">
                <LegeStaat titel="Geen regels in dit filter." tekst="Pas de filters aan." />
                <button type="button" class="dd-act mt-16" @click="wisFilters">Filters wissen</button>
              </template>
              <ul class="schakel-lijst">
                <li v-for="r in lijst" :key="r.id" class="schakel-rij regel-rij" :class="{ 'regel-rij--actief': r.id === f('regel'), 'rg-rij--uit': !r.actief }">
                  <Schakelaar v-if="r.kanSchrijven && !klein" :aan="r.actief" :label="`${r.naam} aan of uit`" @wissel="wisselActief(r)" />
                  <span v-else class="pil" :class="r.actief ? 'pil--groen' : 'pil--grijs'">{{ r.actief ? 'aan' : 'uit' }}</span>
                  <button type="button" class="regel-knop" :aria-current="r.id === f('regel') ? 'true' : undefined" :data-test="`regel-${r.code ?? r.id}`" @click="kies(r.id)">
                    <span class="rg-rij-tekst">
                      <span class="meta">{{ r.categorie }}{{ r.code ? ` · ${r.code}` : '' }}</span>
                      <strong>{{ r.naam }}</strong>
                      <span class="rg-rij-labels">
                        <span class="pil pil--leeg">{{ r.data.activiteit === 'taak' ? 'motor' : 'alleen feed' }}</span>
                        <Label v-for="fid in fasesVan(r).slice(0, 2)" :key="fid" soort="fase" :waarde="faseHoofd.get(fid) ?? null" :tekst="faseLabel.get(fid) ?? fid" />
                        <span v-if="r.data.trigger.patroon === 'reis-overgang'" class="pil pil--leeg">overgang</span>
                        <span v-if="r.data.gevolg.winpuntIds?.length" class="pil pil--leeg rg-wp" :title="`${r.data.gevolg.winpuntIds.length} winpunt(en)`"><Icoon naam="Trophy" :grootte="12" />{{ r.data.gevolg.winpuntIds.length }}</span>
                      </span>
                    </span>
                    <span class="prio-stip" :class="PRIO_STIP[r.prioriteit]" :title="`Prioriteit ${r.prioriteit}`" />
                  </button>
                </li>
              </ul>
              <footer class="rg-legenda" aria-hidden="true"><span><span class="prio-stip prio-stip--high" /> Hoog</span><span><span class="prio-stip prio-stip--medium" /> Middel</span><span><span class="prio-stip prio-stip--low" /> Laag</span></footer>
            </aside>
            <RegelPaneel v-if="bewerk" v-model="bewerk" :keuzes="data.keuzes" :kan="data.kan" :lees-stand="leesStand" :beperkt="beperkt" :klein="klein" :droog="droog" :mag-verwijderen="magVerwijderen" @wijzig="wijzig" @wissel-actief="wisselActief(gekozen)" @verwijder="verwijderOpen = true" @stel-voor="stelVoor" />
            <div v-else class="kaart regels-paneel alleen-groot"><LegeStaat titel="Kies een regel." tekst="Links staat de lijst; klik een regel om hem te lezen of te bewerken." /></div>
          </div>
          <div class="rg-cta mt-16">
            <div>
              <h2 class="rg-cta-titel">Gekoppeld aan de prospectreis en Inzichten</h2>
              <p>Alleen actieve regels doen mee. Een regel met activiteit Inzicht verschijnt eerst bij Inzichten; een taak komt direct in de takenlijst, met het winpunt als gespreksonderwerp in de taak, het belscript en de briefing.</p>
            </div>
            <div class="rg-cta-knoppen">
              <FunctieLink to="/inzichten" class="dd-actie dd-actie--secundair">Open Inzichten</FunctieLink>
              <FunctieLink to="/instellingen/verkoopverhaal" class="dd-actie dd-actie--secundair">Winpunten</FunctieLink>
            </div>
          </div>
        </div>
      </section>
      <NieuweRegelFlyout :open="nieuwOpen" :regels="data.regels" :reizen="reizen" @sluit="nieuwOpen = false" @gemaakt="regelGemaakt" />
      <RegelImportFlyout :open="importOpen" @sluit="importOpen = false" @klaar="importKlaar" />
      <BevestigVenster :open="!!bevestig" titel="Veel taken" :tekst="bevestig?.tekst ?? ''" bevestig="Opslaan" @geannuleerd="bevestig = null; status = ''" @bevestigd="bevestig?.doe()" />
      <BevestigVenster :open="startersetOpen" titel="Starterset terugzetten?" tekst="De regels van de organisatie worden de 23 regels van de starterset. Eigen wijzigingen aan organisatieregels gaan verloren; persoonlijke en teamregels blijven staan." bevestig="Terugzetten" @geannuleerd="startersetOpen = false" @bevestigd="starterset" />
      <BevestigVenster :open="backupTerugOpen" titel="Back-up terugzetten?" tekst="Alle regels worden de stand van de laatste back-up. Wijzigingen van daarna gaan verloren." bevestig="Terugzetten" @geannuleerd="backupTerugOpen = false" @bevestigd="backup(true)" />
      <BevestigVenster :open="verwijderOpen" titel="Regel verwijderen?" :tekst="`De regel ${bewerk?.naam ?? ''} verdwijnt. Uitzetten kan ook: dan blijft hij bestaan maar doet hij niets.`" bevestig="Verwijderen" @geannuleerd="verwijderOpen = false" @bevestigd="verwijder" />
    </template>
  </div>
</template>

<style scoped>
.rg-kicker { display: flex; flex-direction: column; align-items: flex-start; }
.rg-terug { display: inline-flex; align-items: center; gap: 4px; width: fit-content; min-height: 32px; margin-bottom: 6px; font-family: var(--font-mono); font-size: var(--fs-label); font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-soft); text-decoration: none; }
.rg-terug:hover { color: var(--ink); }
.rg-status { align-self: center; }
.rg-filters--aan { background: var(--ink); color: var(--yellow); border-color: var(--ink); }
.rg-teller { display: inline-flex; align-items: center; height: 18px; padding: 0 7px; margin-left: 2px; background: var(--yellow); color: var(--ink); font-size: 11px; font-weight: 800; border-radius: 2px; }
.rg-pijl { transition: transform var(--transition-fast); }
.rg-pijl--open { transform: rotate(180deg); }
.rg-balk { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px 16px; }
.rg-zoek { position: relative; flex: 0 1 320px; }
.rg-zoek .invoer { width: 100%; padding-left: 34px; }
.rg-zoek-icoon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--muted); }
.rg-knoppen { display: flex; flex-wrap: wrap; gap: 8px; }
.rg-knoppen .dd-act { display: inline-flex; align-items: center; gap: 6px; }
.rg-paneel { display: flex; flex-direction: column; gap: 12px; margin-top: 16px; padding: 16px 18px; background: var(--wit); border: 1px solid var(--border); }
.rg-groep { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.rg-groep .filter-label { min-width: 72px; }
.rg-groep--selects { gap: 12px; }
.rg-select { display: inline-flex; align-items: center; gap: 8px; }
.rg-pil-tel { margin-left: 6px; opacity: 0.7; font-size: 11px; }
.rg-lijst { display: flex; flex-direction: column; }
.rg-lijst-kop { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; padding-bottom: 10px; border-bottom: 1px solid var(--border); }
.rg-lijst-titel { margin: 0; font-family: var(--font-serif); font-size: 20px; }
.regel-knop { grid-template-columns: minmax(0, 1fr) auto; }
.rg-rij--uit strong { color: var(--muted); }
.rg-rij-tekst { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; text-align: left; }
.rg-rij-labels { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.rg-wp { display: inline-flex; align-items: center; gap: 3px; }
.rg-legenda { display: flex; gap: 14px; padding-top: 10px; font-size: 12px; color: var(--muted); }
.rg-legenda > span { display: inline-flex; align-items: center; gap: 6px; }
.rg-cta { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px 24px; padding: 20px 24px; background: var(--ink); color: var(--wit); }
.rg-cta p { margin: 4px 0 0; max-width: 720px; color: var(--wit); opacity: 0.85; }
.rg-cta-titel { margin: 0; font-family: var(--font-serif); font-size: 20px; color: var(--wit); }
.rg-cta-knoppen { display: flex; flex-wrap: wrap; gap: 8px; }
.rg-cta-knoppen .dd-actie { background: var(--wit); }
@media (max-width: 767px) {
  .rg-zoek { flex: 1 1 100%; }
  .rg-zoek .invoer { min-height: var(--touch-target-min); }
  .rg-knoppen .dd-act, .rg-terug { min-height: var(--touch-target-min); }
  .rg-groep .filter-label { width: 100%; }
  .rg-groep .filter-pil, .rg-select .invoer { min-height: var(--touch-target-min); }
  .rg-select { width: 100%; flex-wrap: wrap; }
  .rg-select .invoer { flex: 1; }
  .rg-cta { padding: 16px; }
}
</style>
