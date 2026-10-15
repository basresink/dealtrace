<script setup lang="ts">
// Regels (F15): master en detail. Links de lijst, rechts het bewerkpaneel met drie
// blokken (Wat en wanneer, Sturing, Gevolg), live voorbeeld en droogloop. Opslaan
// per veld na 600 ms. Gevorderd leest; Expert bewerkt alleen zijn persoonlijke regels.
import { ACTIESOORTEN, ACTIESOORT_LABEL, CATEGORIEEN, PRIORITEITEN, TERMIJNEN, UITVOERDERROLLEN, sjabloonFouten, vulSjabloon } from '~~/shared/regelPatronen'
import { NB_STATUSSEN } from '~~/shared/nbStatus'
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { functie } = useMe()
const magLezen = computed(() => ['regels.lezen', 'regels.team', 'regels.beheer'].some((s) => functie(s)?.beschikbaar))
const { data, refresh } = await useFetch<any>('/api/regels', { immediate: magLezen.value, default: () => ({ regels: [], tellers: {}, keuzes: { patronen: [], cadansen: [], reizen: [], doelgroepen: [], teams: [] }, kan: {} }) })
const klein = ref(false)
onMounted(() => { klein.value = window.matchMedia('(max-width: 767px)').matches })

// Filters in de URL.
const f = (k: string) => String(route.query[k] ?? '')
function zetFilter(k: string, w: string) { const q: Record<string, any> = { ...route.query, [k]: w || undefined }; router.replace({ query: q }) }
const lijst = computed(() => data.value.regels.filter((r: any) => {
  if (f('q') && !`${r.code ?? ''} ${r.naam} ${r.data.omschrijving}`.toLowerCase().includes(f('q').toLowerCase())) return false
  if (f('categorie') && r.categorie !== f('categorie')) return false
  if (f('bron') && r.data.bron !== f('bron')) return false
  if (f('status') && !(r.data.afbakening.statussen ?? []).includes(f('status'))) return false
  if (f('rol') && r.data.gevolg.uitvoerderrol !== f('rol')) return false
  if (f('fase') && !(r.data.afbakening.faseIds ?? []).includes(f('fase')) && r.faseId !== f('fase')) return false
  if (f('motor') === '1' && r.data.activiteit !== 'taak') return false
  return true
}))
const fases = computed(() => data.value.keuzes.reizen.flatMap((r: any) => r.fases).filter((x: any, i: number, a: any[]) => a.findIndex((y) => y.id === x.id) === i))

// Bewerken
const gekozen = computed(() => data.value.regels.find((r: any) => r.id === f('regel')) ?? null)
const bewerk = ref<any>(null)
const leesStand = computed(() => klein.value || !bewerk.value?.kanSchrijven)
const beperkt = computed(() => !!bewerk.value?.alleenBeperkt)
const patroonInfo = computed(() => data.value.keuzes.patronen.find((p: any) => p.id === bewerk.value?.data.trigger.patroon))
const status = ref('')
const droog = ref<any>(null)
const bevestig = ref<null | { tekst: string; doe: () => Promise<void> }>(null)
let timer: any
let droogTimer: any
async function doeDroogloop() {
  if (!bewerk.value) { droog.value = null; return }
  try { droog.value = await $fetch(`/api/regels/${bewerk.value.id}/droogloop`, { method: 'POST', body: { regel: bewerk.value } }) } catch { droog.value = null }
}
watch(gekozen, (r) => { bewerk.value = r ? JSON.parse(JSON.stringify(r)) : null; void doeDroogloop() }, { immediate: true })
function wijzig() {
  if (leesStand.value) return
  status.value = 'Opslaan…'
  clearTimeout(timer)
  clearTimeout(droogTimer)
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
  $fetch(`/api/regels/${r.id}`, { method: 'PUT', body: { actief: !r.actief, versie: r.versie } }).then(() => refresh()).catch((e) => toast.toon(foutTekst(e), 'fout'))
}
function lijstVeld(pad: 'statussen' | 'faseIds' | 'klassen' | 'accounttypes' | 'doelgroepIds', w: string) {
  const l: string[] = bewerk.value.data.afbakening[pad] ?? []
  bewerk.value.data.afbakening[pad] = l.includes(w) ? l.filter((x) => x !== w) : [...l, w]
  wijzig()
}
function kiesPatroon(p: string) {
  const info = data.value.keuzes.patronen.find((x: any) => x.id === p)
  bewerk.value.data.trigger = { patroon: p, parameters: { ...(info?.parameters ?? {}) } }
  wijzig()
}
const voorbeeld = computed(() => bewerk.value ? vulSjabloon(bewerk.value.data.gevolg.taaksjabloon || `${ACTIESOORT_LABEL[bewerk.value.data.gevolg.actiesoort]}: {account}`, { account: 'Testinstallatie Koperwiek', contact: 'Gerrit Testveen' }) : '')

// Acties bovenaan
const motorBezig = ref(false)
async function draaiMotor() {
  motorBezig.value = true
  try { const r = await $fetch<any>('/api/motor/run', { method: 'POST', body: {} }); toast.toon(`Motor gedraaid. ${r.taken} ${r.taken === 1 ? 'taak' : 'taken'} en ${r.inzichten} ${r.inzichten === 1 ? 'inzicht' : 'inzichten'} klaargezet.`) } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { motorBezig.value = false }
}
async function exporteer() {
  const r = await fetch('/api/regels/excel-export', { method: 'POST' })
  if (!r.ok) { toast.toon('Exporteren mislukt', 'fout'); return }
  const url = URL.createObjectURL(await r.blob())
  const a = document.createElement('a'); a.href = url; a.download = 'dealtrace-regels.xlsx'; a.click(); URL.revokeObjectURL(url)
}
const importOpen = ref(false)
const importModus = ref<'samenvoegen' | 'vervangen'>('samenvoegen')
const importRapport = ref<any>(null)
async function importeer(ev: Event) {
  const bestand = (ev.target as HTMLInputElement).files?.[0]
  if (!bestand) return
  const fd = new FormData(); fd.append('bestand', bestand); fd.append('modus', importModus.value)
  try { importRapport.value = await $fetch('/api/regels/excel-import', { method: 'POST', body: fd }); if (importRapport.value.toegepast) { toast.toon(`Import klaar: ${importRapport.value.nieuw} nieuw, ${importRapport.value.bijgewerkt} bijgewerkt.`); await refresh() } } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function backup(terugzetten = false) {
  try { const r = await $fetch<any>('/api/regels/backup', { method: 'POST', body: { terugzetten } }); toast.toon(terugzetten ? `Back-up van ${new Date(r.op).toLocaleString('nl-NL')} teruggezet.` : `Back-up gemaakt van ${r.aantal} regels.`); if (terugzetten) await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const startersetOpen = ref(false)
async function starterset() {
  startersetOpen.value = false
  try { await $fetch('/api/regels/starterset', { method: 'POST', body: { bevestigd: true } }); toast.toon('De starterset van 23 regels staat er weer.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function nieuweRegel() {
  try {
    const r = await $fetch<any>('/api/regels', { method: 'POST', body: { naam: 'Nieuwe regel', categorie: 'Bewerken', cadansDagen: 7, data: { omschrijving: '', activiteit: 'taak', bron: 'intern', trigger: { patroon: 'inactiviteit', parameters: {} }, afbakening: {}, gevolg: { actiesoort: 'bellen', uitvoerderrol: 'eigenaar', termijnWerkdagen: 3, taaksjabloon: 'Bel {account}' } } } })
    await refresh(); kies(r.id)
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const voorstelTekst = ref('')
async function stelVoor() {
  try { await $fetch(`/api/regels/${bewerk.value.id}/voorstel`, { method: 'POST', body: { tekst: voorstelTekst.value } }); voorstelTekst.value = ''; toast.toon('Je voorstel staat bij je salesmanager.') } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function verwijder() {
  try { await $fetch(`/api/regels/${bewerk.value.id}`, { method: 'DELETE' }); zetFilter('regel', ''); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const PRIO_STIP: Record<string, string> = { hoog: 'prio-stip--high', middel: 'prio-stip--medium', laag: 'prio-stip--low' }
const ROL_LABEL: Record<string, string> = { binnendienst: 'Binnendienst', buitendienst: 'Buitendienst', eigenaar: 'Eigenaar', salesmanager: 'Salesmanager' }
useHead({ title: 'Regels · Instellingen · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!magLezen" sleutel="regels.lezen" />
    <template v-else>
      <PaginaKop kicker="Instellingen · Regels" titel="Regels" :uitleg="`${data.tellers.actief} actief · ${data.tellers.uit} uit · ${data.tellers.motor} door de motor · ${data.tellers.totaal} totaal`" helpartikel="regels">
        <template #acties>
          <span v-if="status" class="meta" role="status" data-test="opslagstatus">{{ status }}</span>
          <button v-if="data.kan.motor" type="button" class="dd-actie dd-actie--primair" :disabled="motorBezig" data-test="draai-motor" @click="draaiMotor"><Icoon naam="RefreshCw" class="dd-actie-icoon" />{{ motorBezig ? 'Motor draait…' : 'Draai motor nu' }}</button>
          <button v-if="data.kan.persoonlijk || data.kan.team || data.kan.beheer" type="button" class="dd-actie dd-actie--secundair alleen-groot" data-test="regel-nieuw" @click="nieuweRegel"><Icoon naam="Plus" class="dd-actie-icoon" />Regel</button>
        </template>
      </PaginaKop>
      <section class="section section--laatste">
        <div class="container">
          <p class="alleen-groot-melding kaart kaart--geel">Beter op een groot scherm.</p>
          <div v-if="data.kan.export || data.kan.beheer" class="reis-knoppen alleen-groot" data-test="regel-knoppen">
            <button v-if="data.kan.export" type="button" class="dd-act" data-test="exporteren" @click="exporteer">Exporteren</button>
            <template v-if="data.kan.beheer">
              <button type="button" class="dd-act" data-test="importeren" @click="importOpen = !importOpen">Importeren</button>
              <button type="button" class="dd-act" @click="backup(false)">Back-up</button>
              <button type="button" class="dd-act" @click="backup(true)">Back-up terugzetten</button>
              <button type="button" class="dd-act" data-test="starterset" @click="startersetOpen = true">Starterset terugzetten</button>
            </template>
          </div>
          <div v-if="importOpen" class="kaart mt-16" data-test="import-paneel">
            <div class="formulier-raster">
              <label class="veld"><span class="veld-label">Modus</span><select v-model="importModus" class="invoer"><option value="samenvoegen">Samenvoegen op id</option><option value="vervangen">Alles vervangen</option></select></label>
              <label class="veld"><span class="veld-label">Excel-bestand (hooguit 5 MB en 2.000 rijen)</span><input type="file" accept=".xlsx" class="invoer" data-test="import-bestand" @change="importeer"></label>
            </div>
            <ul v-if="importRapport" class="schakel-lijst mt-16"><li v-for="r in importRapport.rijen.filter((x: any) => x.fouten.length || x.waarschuwingen.length)" :key="r.rij" class="schakel-rij"><span>Rij {{ r.rij }} {{ r.naam }}</span><span :class="r.fouten.length ? 'tekst-rood' : 'meta'">{{ [...r.fouten, ...r.waarschuwingen].join('; ') }}</span></li></ul>
          </div>
          <div class="filterbalk mt-16" data-test="regel-filters">
            <input class="invoer invoer--klein" :value="f('q')" placeholder="Zoeken" aria-label="Zoeken" @input="zetFilter('q', ($event.target as HTMLInputElement).value)">
            <select class="invoer invoer--klein" :value="f('categorie')" aria-label="Categorie" @change="zetFilter('categorie', ($event.target as HTMLSelectElement).value)"><option value="">Alle categorieën</option><option v-for="c in CATEGORIEEN" :key="c" :value="c">{{ c }}</option></select>
            <select class="invoer invoer--klein" :value="f('bron')" aria-label="Bron" @change="zetFilter('bron', ($event.target as HTMLSelectElement).value)"><option value="">Alle bronnen</option><option value="intern">Intern</option><option value="extern">Extern</option></select>
            <select class="invoer invoer--klein" :value="f('fase')" aria-label="Reis en fase" @change="zetFilter('fase', ($event.target as HTMLSelectElement).value)"><option value="">Alle fases</option><option v-for="x in fases" :key="x.id" :value="x.id">{{ x.label }}</option></select>
            <select class="invoer invoer--klein" :value="f('status')" aria-label="Status van het account" @change="zetFilter('status', ($event.target as HTMLSelectElement).value)"><option value="">Alle statussen</option><option v-for="s in NB_STATUSSEN" :key="s" :value="s">{{ s }}</option></select>
            <select class="invoer invoer--klein" :value="f('rol')" aria-label="Uitvoerderrol" @change="zetFilter('rol', ($event.target as HTMLSelectElement).value)"><option value="">Alle uitvoerders</option><option v-for="u in UITVOERDERROLLEN" :key="u" :value="u">{{ ROL_LABEL[u] }}</option></select>
            <label class="schakel-naam"><input type="checkbox" :checked="f('motor') === '1'" @change="zetFilter('motor', ($event.target as HTMLInputElement).checked ? '1' : '')"> Alleen motorregels</label>
          </div>
          <div class="regels-raster mt-16">
            <div class="kaart regels-lijst" data-test="regel-lijst">
              <LegeStaat v-if="!lijst.length" titel="Geen regels die aan deze filters voldoen." tekst="Pas de filters aan." />
              <button v-if="!lijst.length" type="button" class="dd-act mt-16" @click="router.replace({ query: {} })">Toon alles</button>
              <ul class="schakel-lijst">
                <li v-for="r in lijst" :key="r.id" class="schakel-rij regel-rij" :class="{ 'regel-rij--actief': r.id === f('regel') }">
                  <Schakelaar v-if="r.kanSchrijven && !klein" :aan="r.actief" :label="`${r.naam} aan of uit`" @wissel="wisselActief(r)" />
                  <span v-else class="pil" :class="r.actief ? 'pil--groen' : 'pil--grijs'">{{ r.actief ? 'aan' : 'uit' }}</span>
                  <button type="button" class="regel-knop" :data-test="`regel-${r.code ?? r.id}`" @click="kies(r.id)">
                    <span class="prio-stip" :class="PRIO_STIP[r.prioriteit]" />
                    <span><span class="meta">{{ r.code ? `${r.code} · ` : '' }}{{ r.categorie }}</span><br><strong>{{ r.naam }}</strong></span>
                    <span class="pil pil--leeg">{{ r.data.activiteit === 'taak' ? 'motor' : 'alleen feed' }}</span>
                  </button>
                </li>
              </ul>
            </div>
            <div v-if="bewerk" class="regels-paneel" data-test="regel-paneel">
              <p v-if="leesStand && !klein" class="kaart kaart--geel">{{ bewerk.scope === 'persoonlijk' ? 'Dit is de persoonlijke regel van iemand anders.' : 'Je kunt deze regel lezen.' }}<template v-if="data.kan.persoonlijk && bewerk.scope !== 'persoonlijk'"> Een wijziging kun je voorstellen.</template></p>
              <p v-else-if="beperkt" class="kaart kaart--geel">Bij organisatieregels wijzig je aan of uit, cadans, drempels en klassen.</p>
              <fieldset class="kaart" :disabled="leesStand">
                <legend class="kaart-titel">Wat en wanneer</legend>
                <div class="formulier-raster">
                  <label class="veld"><span class="veld-label">Naam</span><input v-model="bewerk.naam" class="invoer" :disabled="beperkt" @input="wijzig"></label>
                  <label class="veld"><span class="veld-label">Categorie <span class="veld-info" title="Groep in de lijst.">ⓘ</span></span><select v-model="bewerk.categorie" class="invoer" :disabled="beperkt" @change="wijzig"><option v-for="c in CATEGORIEEN" :key="c" :value="c">{{ c }}</option></select></label>
                  <label class="veld"><span class="veld-label">Subcategorie</span><input v-model="bewerk.data.subcategorie" class="invoer" :disabled="beperkt" @input="wijzig"></label>
                  <label class="veld"><span class="veld-label">Activiteit <span class="veld-info" title="Inzicht gaat ter goedkeuring; een taak komt direct in de takenlijst.">ⓘ</span></span><select v-model="bewerk.data.activiteit" class="invoer" :disabled="beperkt" data-test="veld-activiteit" @change="wijzig"><option value="inzicht">Inzicht</option><option value="taak">Taak</option></select></label>
                  <label class="veld"><span class="veld-label">Cadans <span class="veld-info" title="Hoe vaak de regel hoogstens per onderwerp vuurt.">ⓘ</span></span><select v-model.number="bewerk.cadansDagen" class="invoer" data-test="veld-cadans" @change="wijzig"><option v-for="c in data.keuzes.cadansen" :key="c.dagen" :value="c.dagen">{{ c.label }}</option></select></label>
                  <label class="veld"><span class="veld-label">Prioriteit</span><select v-model="bewerk.prioriteit" class="invoer" :disabled="beperkt" @change="wijzig"><option v-for="p in PRIORITEITEN" :key="p" :value="p">{{ p }}</option></select></label>
                </div>
                <label class="veld mt-16"><span class="veld-label">Omschrijving <span class="veld-info" title='Komt in "Waarom krijg ik dit?".'>ⓘ</span></span><textarea v-model="bewerk.data.omschrijving" class="invoer" rows="2" :disabled="beperkt" @input="wijzig" /></label>
              </fieldset>
              <fieldset class="kaart mt-16" :disabled="leesStand">
                <legend class="kaart-titel">Sturing</legend>
                <div class="formulier-raster">
                  <label class="veld"><span class="veld-label">Bron</span><select v-model="bewerk.data.bron" class="invoer" :disabled="beperkt" @change="wijzig"><option value="intern">Intern</option><option value="extern">Extern</option></select></label>
                  <label class="veld"><span class="veld-label">Specifieke bron</span><input v-model="bewerk.data.specifiekeBron" class="invoer" :disabled="beperkt" @input="wijzig"></label>
                  <label class="veld"><span class="veld-label">Triggerpatroon <span class="veld-info" :title="bewerk.trigger">ⓘ</span></span><select :value="bewerk.data.trigger.patroon" class="invoer" :disabled="beperkt" data-test="veld-patroon" @change="kiesPatroon(($event.target as HTMLSelectElement).value)"><option v-for="p in data.keuzes.patronen" :key="p.id" :value="p.id">{{ p.label }}</option></select></label>
                  <label class="veld"><span class="veld-label">Motor</span><select v-model="bewerk.motor" class="invoer" :disabled="beperkt || !data.kan.ai" @change="wijzig"><option value="regel">Regel</option><option value="ai">AI</option></select></label>
                  <template v-for="(w, k) in patroonInfo?.parameters ?? {}" :key="k">
                    <label v-if="typeof w === 'number' || typeof bewerk.data.trigger.parameters[k] === 'number'" class="veld"><span class="veld-label">{{ k }}</span><input v-model.number="bewerk.data.trigger.parameters[k]" type="number" min="0" class="invoer" :data-test="`param-${k}`" @input="wijzig"></label>
                    <label v-else-if="typeof w === 'boolean'" class="schakel-naam"><input v-model="bewerk.data.trigger.parameters[k]" type="checkbox" @change="wijzig"> {{ k }}</label>
                    <label v-else-if="!Array.isArray(w)" class="veld"><span class="veld-label">{{ k }}</span><input v-model="bewerk.data.trigger.parameters[k]" class="invoer" :disabled="beperkt" @input="wijzig"></label>
                  </template>
                </div>
                <div class="afbakening mt-16">
                  <span class="veld-label">Afbakening</span>
                  <div class="reis-knoppen">
                    <label v-for="t in ['prospect', 'klant']" :key="t" class="schakel-naam"><input type="checkbox" :checked="(bewerk.data.afbakening.accounttypes ?? []).includes(t)" :disabled="beperkt" @change="lijstVeld('accounttypes', t)"> {{ t }}</label>
                  </div>
                  <div class="reis-knoppen"><label v-for="s in NB_STATUSSEN" :key="s" class="schakel-naam"><input type="checkbox" :checked="(bewerk.data.afbakening.statussen ?? []).includes(s)" :disabled="beperkt" @change="lijstVeld('statussen', s)"> {{ s }}</label></div>
                  <div class="reis-knoppen"><label v-for="x in fases" :key="x.id" class="schakel-naam"><input type="checkbox" :checked="(bewerk.data.afbakening.faseIds ?? []).includes(x.id)" :disabled="beperkt" @change="lijstVeld('faseIds', x.id)"> {{ x.label }}</label></div>
                  <div class="reis-knoppen"><label v-for="k in ['A', 'B', 'C', 'D']" :key="k" class="schakel-naam"><input type="checkbox" :checked="(bewerk.data.afbakening.klassen ?? []).includes(k)" :data-test="`klasse-${k}`" @change="lijstVeld('klassen', k)"> klasse {{ k }}</label></div>
                  <div v-if="data.keuzes.doelgroepen.length" class="reis-knoppen"><label v-for="d in data.keuzes.doelgroepen" :key="d.id" class="schakel-naam"><input type="checkbox" :checked="(bewerk.data.afbakening.doelgroepIds ?? []).includes(d.id)" :disabled="beperkt" @change="lijstVeld('doelgroepIds', d.id)"> {{ d.naam }}</label></div>
                </div>
              </fieldset>
              <fieldset class="kaart mt-16" :disabled="leesStand || beperkt">
                <legend class="kaart-titel">Gevolg</legend>
                <div class="formulier-raster">
                  <label class="veld"><span class="veld-label">Actiesoort</span><select v-model="bewerk.data.gevolg.actiesoort" class="invoer" @change="wijzig"><option v-for="a in ACTIESOORTEN" :key="a" :value="a">{{ ACTIESOORT_LABEL[a] }}</option></select></label>
                  <label class="veld"><span class="veld-label">Uitvoerderrol</span><select v-model="bewerk.data.gevolg.uitvoerderrol" class="invoer" @change="wijzig"><option v-for="u in UITVOERDERROLLEN" :key="u" :value="u">{{ ROL_LABEL[u] }}</option></select></label>
                  <label class="veld"><span class="veld-label">Termijn</span><select v-model.number="bewerk.data.gevolg.termijnWerkdagen" class="invoer" @change="wijzig"><option v-for="t in TERMIJNEN" :key="t.werkdagen" :value="t.werkdagen">{{ t.label }}</option></select></label>
                  <label class="veld"><span class="veld-label">Signaaltype</span><input v-model="bewerk.data.gevolg.signaaltype" class="invoer" @input="wijzig"></label>
                </div>
                <label class="veld mt-16"><span class="veld-label">Taaksjabloon <span class="veld-info" title="Met {account}, {contact}, {afspraak}.">ⓘ</span></span><input v-model="bewerk.data.gevolg.taaksjabloon" class="invoer" data-test="veld-sjabloon" @input="wijzig"><span v-for="x in sjabloonFouten(bewerk.data.gevolg.taaksjabloon ?? '')" :key="x" class="veld-fout">{{ x }}</span></label>
                <div class="formulier-raster mt-16">
                  <label class="veld"><span class="veld-label">Verwacht resultaat</span><input v-model="bewerk.data.gevolg.verwachtResultaat" class="invoer" @input="wijzig"></label>
                  <label class="schakel-naam"><input v-model="bewerk.data.gevolg.automatischVoorbereiden" type="checkbox" @change="wijzig"> Automatisch voorbereiden</label>
                </div>
              </fieldset>
              <article class="kaart mt-16" data-test="voorbeeld">
                <span class="veld-label">Zo verschijnt hij in de takenlijst</span>
                <div class="schakel-rij"><span><span class="pil pil--leeg">{{ ACTIESOORT_LABEL[bewerk.data.gevolg.actiesoort] }}</span> <span class="pil pil--geel">Uit regel</span><br><strong>{{ voorbeeld }}</strong><br><span class="meta">Waarom krijg ik dit? {{ bewerk.data.omschrijving }} {{ bewerk.trigger }}</span></span></div>
              </article>
              <article v-if="droog" class="kaart mt-16" data-test="droogloop">
                <span class="veld-label">Droogloop</span>
                <p>Deze regel raakt nu <strong class="tnum">{{ droog.geraakt }}</strong> accounts en maakt bij de volgende run <strong class="tnum">{{ droog.taken }}</strong> {{ droog.taken === 1 ? 'taak' : 'taken' }}.</p>
                <ul class="schakel-lijst"><li v-for="p in droog.perPersoon" :key="p.id" class="schakel-rij"><span>{{ p.naam.replace(/^Testgebruiker /, '') }}</span><span class="tnum">{{ p.taken }}</span></li></ul>
              </article>
              <div v-if="leesStand && data.kan.persoonlijk && bewerk.scope !== 'persoonlijk' && !klein" class="kaart mt-16">
                <label class="veld"><span class="veld-label">Stel wijziging voor</span><textarea v-model="voorstelTekst" class="invoer" rows="2" data-test="voorstel-tekst" /></label>
                <button type="button" class="dd-act mt-8" :disabled="!voorstelTekst.trim()" data-test="stel-voor" @click="stelVoor">Stel wijziging voor</button>
              </div>
              <button v-if="!leesStand && (data.kan.beheer || bewerk.scope === 'persoonlijk')" type="button" class="dd-act dd-act--gevaar mt-16" @click="verwijder">Regel verwijderen</button>
            </div>
            <div v-else class="kaart regels-paneel alleen-groot"><LegeStaat titel="Kies een regel." tekst="Links staat de lijst; klik een regel om hem te lezen of te bewerken." /></div>
          </div>
        </div>
      </section>
      <BevestigVenster :open="!!bevestig" titel="Veel taken" :tekst="bevestig?.tekst ?? ''" bevestig="Opslaan" @geannuleerd="bevestig = null; status = ''" @bevestigd="bevestig?.doe()" />
      <BevestigVenster :open="startersetOpen" titel="Starterset terugzetten?" tekst="De regels van de organisatie worden de 23 regels van de starterset. Eigen wijzigingen aan organisatieregels gaan verloren; persoonlijke en teamregels blijven staan." bevestig="Terugzetten" @geannuleerd="startersetOpen = false" @bevestigd="starterset" />
    </template>
  </div>
</template>
