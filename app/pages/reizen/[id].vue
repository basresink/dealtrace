<script setup lang="ts">
// De reiseditor (F05, P22): tabbladen Doelgroep, Fases, Overgangen, Activiteiten, Ritme en Stroom. Een concept
// bewerk je; een actieve reis lees je en wijzig je via "Maak concept". Werkbalk: Controleer, Droogloop,
// Publiceer (salesmanager) of Vraag publicatie aan (Expert), Stel fases voor, Draai terug, Pauzeer, Archiveer
// en bij de standaardreis de accenten en "Standaard terugzetten". Op de telefoon alleen lezen.
import { GEBEURTENIS_LABEL, type Gebeurtenis } from '~~/shared/nbStatus'
import { HOOFDFASEN, HOOFDFASE_LABEL } from '~~/shared/reis'
import { KIESBARE_GEBEURTENISSEN, KLEUREN } from '~~/shared/reisEditor'
const route = useRoute()
const { functie } = useMe()
const toast = useToast()
const aan = computed(() => !!functie('reis.overzicht')?.beschikbaar || !!functie('nav.reizen')?.beschikbaar)
const { data: r, refresh } = await useFetch<any>(() => `/api/reizen/${route.params.id}`, { immediate: aan.value })
const klein = ref(false)
onMounted(() => { klein.value = window.matchMedia('(max-width: 767px)').matches })
const bewerken = computed(() => !!r.value?.kan?.bewerken && !klein.value)
type Tab = 'doelgroep' | 'fases' | 'overgangen' | 'activiteiten' | 'ritme' | 'stroom'
const tab = ref<Tab>('fases')
const TABS: [Tab, string][] = [['doelgroep', 'Doelgroep'], ['fases', 'Fases'], ['overgangen', 'Overgangen'], ['activiteiten', 'Activiteiten'], ['ritme', 'Ritme'], ['stroom', 'Stroom']]

// Het concept lokaal; "Bewaar" schrijft het weg (ook vóór Controleer, Droogloop en Publiceer).
const c = reactive<{ naam: string; doelgroepId: string | null; fases: any[]; overgangen: any[]; activiteiten: any[]; overschrijvingen: any }>({ naam: '', doelgroepId: null, fases: [], overgangen: [], activiteiten: [], overschrijvingen: {} })
const vuil = ref(false)
watch(r, (x) => {
  if (!x) return
  Object.assign(c, { naam: x.naam, doelgroepId: x.doelgroepId ?? null, fases: JSON.parse(JSON.stringify(x.fases)).map((f: any) => ({ ...f, eind: f.eind ?? null, instap: !!f.instap })), overgangen: JSON.parse(JSON.stringify(x.overgangen)), activiteiten: JSON.parse(JSON.stringify(x.activiteiten)), overschrijvingen: { ...(x.overschrijvingen ?? {}) } })
  vuil.value = false
}, { immediate: true })
watch(() => [c.naam, c.doelgroepId, c.fases, c.overgangen, c.activiteiten, c.overschrijvingen], () => { vuil.value = true }, { deep: true })
async function bewaar(stil = false) {
  if (!bewerken.value) return true
  try {
    await $fetch(`/api/reizen/${r.value.id}`, { method: 'PUT', body: { naam: c.naam, doelgroepId: c.doelgroepId, data: { fases: c.fases, overgangen: c.overgangen, overschrijvingen: c.overschrijvingen }, activiteiten: c.activiteiten } })
    if (!stil) toast.toon('Concept bewaard.')
    await refresh(); return true
  } catch (e) { toast.toon(foutTekst(e), 'fout'); return false }
}
const label = (id: string | null) => (id ? c.fases.find((f) => f.id === id)?.label || id : 'Instap')
const g = (x: string) => GEBEURTENIS_LABEL[x as Gebeurtenis] ?? x
const ROL: Record<string, string> = { binnendienst: 'Binnendienst', buitendienst: 'Buitendienst', alle: 'Iedereen' }
const ACTIES = ['taak', 'bellen', 'mail', 'bezoek', 'briefing', 'pitstop', 'overdracht', 'terugkom']

// Fases
function nieuweFase() { const n = c.fases.length + 1; c.fases.push({ id: `fase-${Date.now().toString(36)}`, label: `Nieuwe fase ${n}`, omschrijving: '', hoofdfase: 'bewerken', volgorde: n, kleur: 'grijs', accent: '', verwachtVerblijfDagen: null, instap: false, eind: null }) }
function schuif(i: number, d: -1 | 1) { const j = i + d; if (j < 0 || j >= c.fases.length) return; const x = c.fases.splice(i, 1)[0]; c.fases.splice(j, 0, x); c.fases.forEach((f, k) => { f.volgorde = k + 1 }) }
const verwijder = ref<{ fase: any; vervang: string } | null>(null)
const gevolg = computed(() => {
  if (!verwijder.value) return ''
  const f = verwijder.value.fase
  const o = c.overgangen.filter((x) => x.vanFaseId === f.id || x.naarFaseId === f.id).length
  const a = c.activiteiten.filter((x) => x.faseId === f.id).length
  const naar = verwijder.value.vervang ? label(verwijder.value.vervang) : 'de vervangende fase'
  return `${f.aantal ?? 0} accounts, ${o} overgangen en ${a} startactiviteiten gaan naar '${naar}'.`
})
async function doeVerwijder() {
  const v = verwijder.value!
  if (!v.vervang) return
  if (!(await bewaar(true))) return
  try { const x = await $fetch<any>(`/api/reizen/${r.value.id}/fase-verwijderen`, { method: 'POST', body: { faseId: v.fase.id, vervangendeFaseId: v.vervang } }); toast.toon(`Fase verwijderd. ${x.overgangen} overgangen en ${x.activiteiten} startactiviteiten omgezet.`); verwijder.value = null; await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}

// Werkbalk
const validatie = ref<any>(null)
async function controleer() { if (!(await bewaar(true))) return; validatie.value = await $fetch<any>(`/api/reizen/${r.value.id}/controleer`, { method: 'POST' }).catch((e) => { toast.toon(foutTekst(e), 'fout'); return null }) }
function naarFase(tekst: string) { const f = c.fases.find((x) => tekst.includes(x.label)); tab.value = 'fases'; if (f) nextTick(() => document.querySelector(`[data-fase="${f.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })) }
const droog = ref<any>(null)
async function droogloop() { if (!(await bewaar(true))) return; droog.value = await $fetch<any>(`/api/reizen/${r.value.id}/droogloop`, { method: 'POST', body: {} }).catch((e) => { toast.toon(foutTekst(e), 'fout'); return null }) }
const mapping = ref<{ rijen: any[]; keuze: Record<string, string>; terug?: boolean } | null>(null)
async function publiceer() {
  if (!(await bewaar(true))) return
  try {
    const m = await $fetch<any>(`/api/reizen/${r.value.id}/mapping`)
    if (m.rijen.length) { mapping.value = { rijen: m.rijen, keuze: Object.fromEntries(m.rijen.map((x: any) => [x.faseId, x.voorstel ?? ''])) }; return }
    await doePubliceer({})
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function doePubliceer(keuze: Record<string, string>) {
  try {
    const x = await $fetch<any>(`/api/reizen/${r.value.id}/${mapping.value?.terug ? 'terugdraaien' : 'publiceer'}`, { method: 'POST', body: { mapping: keuze } })
    toast.toon(mapping.value?.terug ? `Teruggedraaid. ${x.omgezet} accounts omgezet.` : `Versie ${x.versie} gepubliceerd. ${x.omgezet} accounts omgezet.`)
    mapping.value = null
    if (x.id && x.id !== r.value.id) navigateTo(`/reizen/${x.id}`); else await refresh()
  } catch (e: any) {
    const nodig = e?.data?.data?.mapping
    if (nodig) mapping.value = { rijen: nodig, keuze: Object.fromEntries(nodig.map((y: any) => [y.faseId, y.voorstel ?? ''])), terug: mapping.value?.terug }
    toast.toon(foutTekst(e), 'fout')
  }
}
async function vraagAan() { if (!(await bewaar(true))) return; try { await $fetch(`/api/reizen/${r.value.id}/publicatie-aanvragen`, { method: 'POST' }); toast.toon('Publicatie aangevraagd. Je salesmanager kreeg een taak.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') } }
async function maakConcept() { try { const x = await $fetch<any>('/api/reizen', { method: 'POST', body: { vanuit: r.value.id } }); navigateTo(`/reizen/${x.id}`) } catch (e) { toast.toon(foutTekst(e), 'fout') } }
async function stelVoor() { try { const x = await $fetch<any>('/api/reizen/voorstel', { method: 'POST', body: { doelgroepId: c.doelgroepId } }); toast.toon('De Coach stelde een conceptreis voor.'); navigateTo(`/reizen/${x.id}`) } catch (e) { toast.toon(foutTekst(e), 'fout') } }
function terugdraaien() { mapping.value = { rijen: [], keuze: {}, terug: true }; doePubliceer({}) }
const statusVraag = ref<string | null>(null)
async function zetStatus(reden: string) { try { await $fetch(`/api/reizen/${r.value.id}/status`, { method: 'POST', body: { status: statusVraag.value, reden } }); toast.toon(statusVraag.value === 'gepauzeerd' ? 'Reis gepauzeerd.' : statusVraag.value === 'gearchiveerd' ? 'Reis gearchiveerd.' : 'Reis hervat.'); statusVraag.value = null; await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') } }

// Standaardreis: accenten en terugzetten (P05).
const accenten = reactive<Record<string, string>>({})
watchEffect(() => { for (const f of r.value?.fases ?? []) accenten[f.id] = f.accent })
const accentGewijzigd = computed(() => (r.value?.fases ?? []).some((f: any) => accenten[f.id] !== f.accent))
async function bewaarAccenten() { try { await $fetch(`/api/reizen/${r.value.id}`, { method: 'PUT', body: { fases: r.value.fases.filter((f: any) => accenten[f.id] !== f.accent).map((f: any) => ({ id: f.id, accent: accenten[f.id] })) } }); toast.toon('Accenten bewaard; nieuwe versie van de reis.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') } }
const terugOpen = ref(false)
async function standaardTerug() { terugOpen.value = false; try { await $fetch(`/api/reizen/${r.value.id}/standaard-terug`, { method: 'POST', body: { bevestigd: true } }); toast.toon('De reis staat weer op de standaard.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') } }

// Doelgroep: teller en overlap.
const telling = ref<{ aantal: number; inAndereReis: number } | null>(null)
watch(() => c.doelgroepId, async (id) => { telling.value = id ? await $fetch<any>(`/api/doelgroepen/${id}/telling`).catch(() => null) : null }, { immediate: true })
const doelgroep = computed(() => (r.value?.doelgroepen ?? []).find((d: any) => d.id === c.doelgroepId))
const { data: ritmes } = await useFetch<any>('/api/ritmes', { immediate: aan.value, default: () => [] })
const verblijf = (f: any) => (f.verwachtVerblijfDagen != null ? `${f.verwachtVerblijfDagen} dagen` : f.verblijfTekst ?? 'onbepaald')
const STATUS: Record<string, string> = { concept: 'Concept', actief: 'Actief', gepauzeerd: 'Gepauzeerd', gearchiveerd: 'Gearchiveerd' }
useHead({ title: computed(() => `${r.value?.naam ?? 'Reis'} · Prospectreizen · Dealtrace`) })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="nav.reizen" />
    <template v-else-if="r">
      <PaginaKop :kicker="`Prospectreizen · ${STATUS[r.status]} · versie ${r.versie}`" :titel="r.naam" :uitleg="r.isStandaard ? 'De standaardreis: tien fases tot en met de eerste afspraak en de overdracht.' : 'Een eigen reis voor deze doelgroep, tot en met de eerste afspraak en de overdracht.'" helpartikel="een-eigen-prospectreis-bouwen">
        <template #acties>
          <span class="dd-acties alleen-groot re-werkbalk" data-test="werkbalk">
            <template v-if="bewerken">
              <button type="button" class="dd-actie dd-actie--secundair" :disabled="!vuil" data-test="bewaar" @click="bewaar()">Bewaar</button>
              <button type="button" class="dd-actie dd-actie--secundair" data-test="controleer" @click="controleer">Controleer</button>
              <button type="button" class="dd-actie dd-actie--secundair" data-test="droogloop" @click="droogloop">Droogloop</button>
              <button v-if="r.kan.publiceren" type="button" class="dd-actie dd-actie--primair" data-test="publiceer" @click="publiceer">Publiceer</button>
              <button v-else type="button" class="dd-actie dd-actie--primair" :disabled="!!r.publicatieAangevraagd" data-test="vraag-publicatie" @click="vraagAan">{{ r.publicatieAangevraagd ? 'Publicatie aangevraagd' : 'Vraag publicatie aan' }}</button>
              <button v-if="r.kan.voorstel" type="button" class="dd-actie dd-actie--secundair" data-test="stel-voor" @click="stelVoor"><Icoon naam="Sparkles" class="dd-actie-icoon" />Stel fases voor</button>
            </template>
            <template v-else>
              <NuxtLink v-if="r.conceptId" class="dd-actie dd-actie--secundair" :to="`/reizen/${r.conceptId}`">Open concept</NuxtLink>
              <button v-else-if="r.kan.concept" type="button" class="dd-actie dd-actie--primair" data-test="maak-concept" @click="maakConcept">Maak concept</button>
              <template v-if="r.kan.beheer">
                <button v-if="r.versies.length > 1" type="button" class="dd-actie dd-actie--secundair" data-test="terugdraaien" @click="terugdraaien">Draai terug</button>
                <button type="button" class="dd-actie dd-actie--secundair" @click="statusVraag = r.status === 'gepauzeerd' ? 'actief' : 'gepauzeerd'">{{ r.status === 'gepauzeerd' ? 'Hervat' : 'Pauzeer' }}</button>
                <button type="button" class="dd-actie dd-actie--secundair" @click="statusVraag = 'gearchiveerd'">Archiveer</button>
              </template>
              <button v-if="r.kan.standaardTerug" type="button" class="dd-actie dd-actie--secundair" data-test="standaard-terug" @click="terugOpen = true"><Icoon naam="RefreshCw" class="dd-actie-icoon" />Standaard terugzetten</button>
            </template>
          </span>
        </template>
      </PaginaKop>
      <section class="section section--laatste">
        <div class="container">
          <p class="alleen-groot-melding kaart kaart--geel">Beter op een groot scherm. Hier lees je de fases en overgangen.</p>
          <label v-if="bewerken" class="veld re-naam"><span class="veld-label">Naam van de reis</span><input v-model="c.naam" class="invoer" data-test="reis-naam"></label>

          <article v-if="validatie" class="kaart mt-16" data-test="validatie">
            <header class="kaart-kop"><h2 class="kaart-titel">Controle</h2><button type="button" class="fo-sluit" aria-label="Sluiten" @click="validatie = null"><Icoon naam="X" /></button></header>
            <p v-if="!validatie.fouten.length && !validatie.waarschuwingen.length" class="kaart-meta">Geen fouten. Je kunt publiceren.</p>
            <div v-for="[groep, titel] in [['fouten', 'Fouten'], ['waarschuwingen', 'Waarschuwingen'], ['informatie', 'Informatie']]" :key="groep">
              <template v-if="validatie[groep].length"><h3 class="kicker mt-8">{{ titel }}</h3>
                <ul class="schakel-lijst"><li v-for="t in validatie[groep]" :key="t" class="schakel-rij"><button type="button" class="re-link" :class="{ 'tekst-rood': groep === 'fouten' || validatie.blokkeert.includes(t) }" @click="naarFase(t)">{{ t }}</button></li></ul></template>
            </div>
          </article>

          <nav class="tabbalk mt-16" aria-label="Tabbladen"><button v-for="[k, l] in TABS" :key="k" type="button" class="tab" :class="{ 'tab--actief': tab === k }" :data-test="`tab-${k}`" @click="tab = k">{{ l }}</button></nav>

          <div v-if="tab === 'doelgroep'" class="mt-16" data-test="tab-inhoud-doelgroep">
            <label class="veld"><span class="veld-label">Doelgroep</span>
              <select v-model="c.doelgroepId" class="invoer" :disabled="!bewerken" data-test="reis-doelgroep"><option :value="null">Geen (de standaard)</option><option v-for="d in r.doelgroepen" :key="d.id" :value="d.id">{{ d.naam }} · prioriteit {{ d.prioriteit }}</option></select></label>
            <p v-if="telling" class="kaart kaart--vlak mt-8" data-test="doelgroep-telling">{{ telling.aantal }} accounts vallen in deze doelgroep, waarvan {{ telling.inAndereReis }} al in een andere reis.</p>
            <p v-if="doelgroep?.data?.ambitieToets" class="meta mt-8">Past bij onze ambitie: {{ doelgroep.data.ambitieToets }}</p>
            <p class="meta mt-8">Een doelgroep maak of wijzig je bij <NuxtLink to="/reizen">Prospectreizen</NuxtLink>, met branches, klassen, gebieden, bron en de ambitievraag.</p>
          </div>

          <div v-else-if="tab === 'fases'" class="mt-16" data-test="fases">
            <div class="ak-blokken">
              <article v-for="(f, i) in ((bewerken ? c.fases : r.fases) as any[])" :key="f.id" class="fasekaart" :data-fase="f.id" :data-test="`fase-${f.id}`">
                <template v-if="bewerken">
                  <header class="kaart-kop"><span class="meta tnum">{{ i + 1 }}</span><Label soort="fase" :waarde="f.hoofdfase" :tekst="f.label || 'Zonder naam'" />
                    <span class="dd-acties"><button type="button" class="dd-act dd-act--icoon" aria-label="Eerder" :disabled="i === 0" @click="schuif(i, -1)">↑</button><button type="button" class="dd-act dd-act--icoon" aria-label="Later" :disabled="i === c.fases.length - 1" @click="schuif(i, 1)">↓</button><button type="button" class="dd-act dd-act--icoon" :aria-label="`${f.label} verwijderen`" :data-test="`verwijder-${f.id}`" @click="verwijder = { fase: f, vervang: '' }">×</button></span></header>
                  <label class="veld"><span class="veld-label">Naam</span><input v-model="f.label" class="invoer"></label>
                  <div class="re-rij">
                    <label class="veld"><span class="veld-label">Hoofdfase</span><select v-model="f.hoofdfase" class="invoer"><option v-for="h in HOOFDFASEN" :key="h" :value="h">{{ HOOFDFASE_LABEL[h] }}</option></select></label>
                    <label class="veld"><span class="veld-label">Kleur</span><select v-model="f.kleur" class="invoer"><option v-for="k in KLEUREN" :key="k" :value="k">{{ k }}</option></select></label>
                    <label class="veld"><span class="veld-label">Verblijf (dagen)</span><input v-model.number="f.verwachtVerblijfDagen" type="number" min="0" class="invoer"></label>
                  </div>
                  <label class="veld"><span class="veld-label">Omschrijving</span><input v-model="f.omschrijving" class="invoer"></label>
                  <label class="veld fasekaart-accent"><span class="veld-label">Pitstop-accent</span><textarea v-model="f.accent" class="invoer" rows="2" /></label>
                  <div class="re-rij">
                    <label class="schakel-inline"><input v-model="f.instap" type="checkbox"> Instapfase</label>
                    <label class="veld"><span class="veld-label">Eindfase</span><select v-model="f.eind" class="invoer invoer--klein"><option :value="null">Geen</option><option value="overgedragen">Overgedragen</option><option value="verloren">Verloren</option></select></label>
                  </div>
                </template>
                <template v-else>
                  <header class="kaart-kop"><span class="meta tnum">{{ f.volgorde }}</span><Label soort="fase" :waarde="f.hoofdfase" :tekst="f.label" /><span class="meta">{{ HOOFDFASE_LABEL[f.hoofdfase as keyof typeof HOOFDFASE_LABEL] }}</span></header>
                  <p class="kaart-meta">{{ f.omschrijving }}</p>
                  <p class="kaart-meta">Verwacht verblijf: {{ verblijf(f) }} · <span class="tnum">{{ f.aantal }}</span> accounts</p>
                  <label v-if="r.kan.accent && !klein" class="veld fasekaart-accent"><span class="veld-label">Pitstop-accent</span><textarea v-model="accenten[f.id]" class="invoer" rows="2" :data-test="`accent-${f.id}`" /></label>
                  <p v-else-if="f.accent" class="fasekaart-accent">{{ f.accent }}</p>
                </template>
              </article>
            </div>
            <button v-if="bewerken" type="button" class="dd-act mt-16" data-test="fase-nieuw" @click="nieuweFase">+ Fase</button>
            <button v-if="!bewerken && r.kan.accent && !klein" type="button" class="dd-act dd-act--primair mt-16" :disabled="!accentGewijzigd" data-test="accenten-bewaar" @click="bewaarAccenten">Accenten bewaren</button>
          </div>

          <div v-else-if="tab === 'overgangen'" class="tabel-wrap mt-16">
            <table class="tabel tabel--kaarten" data-test="overgangen">
              <thead><tr><th>Vanuit</th><th>Gebeurtenis</th><th>Naar</th><th v-if="bewerken">Prioriteit</th><th v-if="bewerken" /></tr></thead>
              <tbody>
                <tr v-for="(o, i) in ((bewerken ? c.overgangen : r.overgangen) as any[])" :key="o.id">
                  <template v-if="bewerken">
                    <td><select v-model="o.vanFaseId" class="invoer invoer--klein" aria-label="Vanuit"><option :value="null">Instap</option><option v-for="f in c.fases" :key="f.id" :value="f.id">{{ f.label }}</option></select></td>
                    <td><select v-model="o.gebeurtenis" class="invoer invoer--klein" aria-label="Gebeurtenis"><option v-for="x in KIESBARE_GEBEURTENISSEN" :key="x" :value="x">{{ g(x) }}</option></select></td>
                    <td><select v-model="o.naarFaseId" class="invoer invoer--klein" aria-label="Naar"><option v-for="f in c.fases" :key="f.id" :value="f.id">{{ f.label }}</option></select></td>
                    <td><input v-model.number="o.prioriteit" type="number" class="invoer invoer--klein re-smal" aria-label="Prioriteit"></td>
                    <td><button type="button" class="dd-act dd-act--icoon" aria-label="Overgang weghalen" @click="c.overgangen.splice(i, 1)">×</button></td>
                  </template>
                  <template v-else><td>{{ label(o.vanFaseId) }}</td><td>{{ g(o.gebeurtenis) }}</td><td><strong>{{ label(o.naarFaseId) }}</strong></td></template>
                </tr>
              </tbody>
            </table>
            <button v-if="bewerken" type="button" class="dd-act mt-16" data-test="overgang-nieuw" @click="c.overgangen.push({ id: `o-${Date.now().toString(36)}`, vanFaseId: c.fases[0]?.id ?? null, gebeurtenis: 'eerste-contact', naarFaseId: c.fases[1]?.id ?? c.fases[0]?.id, prioriteit: 1 })">+ Overgang</button>
          </div>

          <div v-else-if="tab === 'activiteiten'" class="tabel-wrap mt-16">
            <p class="kaart-meta">Startactiviteiten bij "fase betreden". De motor voert ze uit.</p>
            <table class="tabel tabel--kaarten mt-16">
              <thead><tr><th>Fase</th><th>Activiteit</th><th>Actiesoort</th><th>Voor</th><th>Termijn (werkdagen)</th><th v-if="bewerken" /></tr></thead>
              <tbody>
                <tr v-for="(x, i) in ((bewerken ? c.activiteiten : r.activiteiten) as any[])" :key="x.id ?? i">
                  <template v-if="bewerken">
                    <td><select v-model="x.faseId" class="invoer invoer--klein" aria-label="Fase"><option v-for="f in c.fases" :key="f.id" :value="f.id">{{ f.label }}</option></select></td>
                    <td><input v-model="x.naam" class="invoer invoer--klein" aria-label="Activiteit"></td>
                    <td><select v-model="x.actiesoort" class="invoer invoer--klein" aria-label="Actiesoort"><option v-for="a in ACTIES" :key="a" :value="a">{{ a }}</option></select></td>
                    <td><select v-model="x.rol" class="invoer invoer--klein" aria-label="Voor"><option v-for="(l, k) in ROL" :key="k" :value="k">{{ l }}</option></select></td>
                    <td><input v-model.number="x.termijnWerkdagen" type="number" min="0" class="invoer invoer--klein re-smal" aria-label="Termijn"></td>
                    <td><button type="button" class="dd-act dd-act--icoon" aria-label="Activiteit weghalen" @click="c.activiteiten.splice(i, 1)">×</button></td>
                  </template>
                  <template v-else><td>{{ label(x.faseId) }}</td><td>{{ x.naam }}<template v-if="x.belscript"> · script "{{ x.belscript }}"</template></td><td>{{ x.actiesoort }}</td><td>{{ ROL[x.rol] }}</td><td class="tnum">{{ x.termijnWerkdagen }}</td></template>
                </tr>
              </tbody>
            </table>
            <button v-if="bewerken" type="button" class="dd-act mt-16" @click="c.activiteiten.push({ faseId: c.fases[0]?.id, naam: 'Nieuwe activiteit', actiesoort: 'bellen', rol: 'alle', termijnWerkdagen: 1, uitvoerder: 'eigenaar' })">+ Activiteit</button>
          </div>

          <div v-else-if="tab === 'ritme'" class="mt-16">
            <label class="veld"><span class="veld-label">Hercontactritme</span>
              <select v-model="c.overschrijvingen.hercontactRitmeId" class="invoer" :disabled="!bewerken"><option :value="undefined">Zoals de organisatie</option><option v-for="x in (Array.isArray(ritmes) ? ritmes : ritmes?.ritmes ?? [])" :key="x.id" :value="x.id">{{ x.naam }}</option></select></label>
            <p class="meta mt-8">Leeg betekent de instellingen van de organisatie. De belmatrix en afspraakmatrix stel je in bij Instellingen.</p>
          </div>

          <div v-else-if="tab === 'stroom'" class="fasebord mt-16" data-test="stroom">
            <div v-for="h in HOOFDFASEN" :key="h" class="fasebord-kolom">
              <span class="kicker">{{ HOOFDFASE_LABEL[h] }}</span>
              <div v-for="f in c.fases.filter((x: any) => x.hoofdfase === h)" :key="f.id" class="fasekaart">
                <Label soort="fase" :waarde="f.hoofdfase" :tekst="f.label" />
                <ul class="schakel-lijst mt-8"><li v-for="o in c.overgangen.filter((x: any) => x.vanFaseId === f.id)" :key="o.id" class="stroom-pijl">{{ g(o.gebeurtenis) }} → {{ label(o.naarFaseId) }}</li></ul>
              </div>
            </div>
            <p v-for="w in r.validatie.waarschuwingen" :key="w" class="kaart kaart--geel tekst-rood">{{ w }}</p>
          </div>
        </div>
      </section>

      <FlyoutShell v-if="droog" open titel-id="fs-id0" paneel-klasse="re-560" data-test="droogloop-venster" @sluit="droog = null">
          <template #kop><span class="fo-kicker">Droogloop</span><h2 id="fs-id0" class="fo-titel">{{ droog.accounts }} accounts, {{ droog.taken }} startactiviteiten</h2></template>
            <div class="fo-body">
              <p v-if="droog.inAndereReis" class="meta">{{ droog.inAndereReis }} accounts zitten al in een andere reis en blijven daar.</p>
              <ul class="schakel-lijst"><li v-for="f in droog.perFase" :key="f.faseId" class="schakel-rij"><span>{{ f.label }}</span><span class="tnum">{{ f.accounts }} accounts · {{ f.taken }} taken</span></li></ul>
              <h3 class="kicker mt-16">Per persoon</h3>
              <ul class="schakel-lijst"><li v-for="p in droog.perPersoon" :key="p.ownerId" class="schakel-rij"><span>{{ p.naam }}</span><span class="tnum">{{ p.taken }} taken</span></li></ul>
            </div>
        </FlyoutShell>
      <FlyoutShell v-if="mapping && mapping.rijen.length" open titel-id="fs-id1" paneel-klasse="re-640" data-test="fasemapping" @sluit="mapping = null">
          <template #kop><span class="fo-kicker">Fasemapping</span><h2 id="fs-id1" class="fo-titel">Waar gaan de accounts naartoe?</h2></template>
        <form id="fm-form" class="fs-form" @submit.prevent="doePubliceer(mapping!.keuze)">
            <div class="fo-body">
              <ul class="schakel-lijst"><li v-for="m in mapping.rijen" :key="m.faseId" class="schakel-rij"><span>{{ m.label ?? m.faseId }} <span class="meta">· {{ m.aantal }} accounts</span></span>
                <select v-model="mapping.keuze[m.faseId]" class="invoer invoer--klein re-mapping" required :aria-label="`Nieuwe fase voor ${m.label ?? m.faseId}`" :data-test="`mapping-${m.faseId}`"><option value="" disabled>Kies</option><option v-for="f in c.fases" :key="f.id" :value="f.id">{{ f.label }}</option></select></li></ul>
            </div>
        </form>
          <template #voet>
            <footer class="fo-foot fs-voet">
          <button type="submit" form="fm-form" class="dd-actie dd-actie--zwart fs-hoofdactie" :disabled="mapping.rijen.some((m) => !mapping!.keuze[m.faseId])" data-test="mapping-publiceer"><Icoon naam="Check" :grootte="16" />{{ mapping.terug ? 'Draai terug en zet accounts om' : 'Publiceer en zet accounts om' }}</button>
          <span class="fo-foot-vul" />
        </footer>
          </template>
        </FlyoutShell>
      <Teleport to="body">
        <div v-if="verwijder" class="cd-overlay" @click.self="verwijder = null">
          <div class="cd-dialog" role="alertdialog" aria-modal="true" aria-labelledby="fv-titel" data-test="fase-verwijderen">
            <div class="cd-head"><h2 id="fv-titel" class="cd-title">Fase '{{ verwijder.fase.label }}' verwijderen?</h2></div>
            <label class="veld"><span class="veld-label">Vervangende fase</span><select v-model="verwijder.vervang" class="invoer" required data-test="vervangende-fase"><option value="" disabled>Kies</option><option v-for="f in c.fases.filter((x) => x.id !== verwijder!.fase.id)" :key="f.id" :value="f.id">{{ f.label }}</option></select></label>
            <p class="cd-message">{{ gevolg }}</p>
            <div class="cd-foot"><button type="button" class="cd-btn cd-btn--ghost" @click="verwijder = null">Annuleren</button><button type="button" class="cd-btn cd-btn--danger" :disabled="!verwijder.vervang" data-test="fase-verwijder-bevestig" @click="doeVerwijder">Verwijderen</button></div>
          </div>
        </div>
      </Teleport>
      <BevestigVenster :open="!!statusVraag" :titel="statusVraag === 'gearchiveerd' ? 'Reis archiveren?' : statusVraag === 'gepauzeerd' ? 'Reis pauzeren?' : 'Reis hervatten?'" tekst="Nieuwe accounts komen dan in de standaardreis of een andere passende reis." :bevestig="statusVraag === 'gearchiveerd' ? 'Archiveer' : statusVraag === 'gepauzeerd' ? 'Pauzeer' : 'Hervat'" met-reden @bevestigd="zetStatus" @geannuleerd="statusVraag = null" />
      <BevestigVenster :open="terugOpen" titel="Standaard terugzetten?" tekst="Fases, accenten, overgangen en startactiviteiten van deze reis gaan terug naar de standaard. Jullie aangepaste accenten gaan verloren. Maatwerkreizen blijven zoals ze zijn." bevestig="Terugzetten" @geannuleerd="terugOpen = false" @bevestigd="standaardTerug" />
    </template>
  </div>
</template>

<style scoped>
.re-werkbalk { flex-wrap: wrap; gap: 8px; }
.re-naam { max-width: 480px; }
.re-rij { display: flex; flex-wrap: wrap; gap: 12px; align-items: end; }
.re-rij .veld { flex: 1 1 120px; }
.re-smal { width: 80px; }
.re-mapping { width: auto; min-width: 200px; }
.re-link { all: unset; cursor: pointer; text-decoration: underline dotted; }
.re-560 { width: min(560px, 100vw); }
.re-640 { width: min(640px, 100vw); }
</style>
