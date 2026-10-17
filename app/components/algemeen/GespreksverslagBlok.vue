<script setup lang="ts">
// Het blok "Transcript en gespreksverslag" (opzet van DealDrive), gedeeld door het afspraakvenster en het
// taakvenster (alleen bij een beltaak). Drie wegen naar één analyse: een transcript uploaden (.txt, .md,
// .vtt, .srt) of plakken, het verslag typen of inspreken (VerslagVeld), en "Analyseer verslag" met de
// Notulist: samenvatting, actiepunten als concepttaak, koopsignalen als inzicht, bezwaren en open vragen.
// De API staat onder `api` (/api/afspraken/:id of /api/tasks/:id) met /verslag, /transcript en /analyse.
// Het verslag is een v-model, zodat het venster het kan meenemen bij afronden.
import { TRANSCRIPT_MAX_BYTES, magTranscript, telWoorden, transcriptUitBestand } from '~~/shared/transcript'

const props = defineProps<{
  modelValue: string
  /** Basis van de API, bijvoorbeeld /api/tasks/123. */
  api: string
  /** Het record voor een ingesproken opname (VerslagVeld). */
  record: { soort: string; id: string }
  /** Voorvoegsel van de data-test-namen: af (afspraak) of tf (taak). */
  prefix: string
  /** Het bewaarde verslag ({ tekst }), het transcript en de analyse zoals de API ze geeft. */
  verslag: { tekst?: string | null } | null
  transcript: { tekst: string; bestandsnaam?: string | null; woorden: number; bron: string } | null
  analyse: any | null
  account: { id: string } | null
  heeftContact?: boolean
  /** "afspraak" of "beltaak": voor de teksten. */
  onderwerp: 'afspraak' | 'beltaak'
  /** Herladen na de analyse (het venster haalt zijn record opnieuw op). */
  herlaad: () => Promise<unknown>
  /** Een uitleg onder de analyse, bijvoorbeeld de voorgestelde uitkomst. */
  uitkomstTekst?: string | null
}>()
const emit = defineEmits<{ 'update:modelValue': [v: string]; patch: [p: { verslag?: any; transcript?: any }]; gewijzigd: []; sluit: [] }>()
const toast = useToast()

const transcriptConcept = ref('')
const transcriptNaam = ref<string | null>(null)
const transcriptMelding = ref('')
const transcriptFout = ref('')
const sleepActief = ref(false)
const bestandInput = ref<HTMLInputElement | null>(null)
const bewaartVerslag = ref(false)
const bewaartTranscript = ref(false)
const analyseert = ref(false)
const analyseReden = ref('')
// Een ander record: alles leeg.
watch(() => props.api, () => { transcriptConcept.value = ''; transcriptNaam.value = null; transcriptMelding.value = ''; transcriptFout.value = ''; analyseReden.value = '' })

const tekst = computed({ get: () => props.modelValue, set: (v: string) => emit('update:modelValue', v) })
const opgeslagen = computed(() => String(props.verslag?.tekst ?? '').trim())
const gewijzigd = computed(() => tekst.value.trim() !== opgeslagen.value)
const heeftTekst = computed(() => !!(opgeslagen.value || props.transcript))
const herkomst = computed(() => { const b = props.analyse?.basis; if (!b) return [] as string[]; return [b.verslag && 'Verslag', b.transcript && 'Transcript'].filter(Boolean) as string[] })
const snippet = (t: string) => (t.length > 280 ? `${t.slice(0, 280).trim()}…` : t)
const tid = (naam: string) => `${props.prefix}-${naam}`
const uid = `gv-${Math.random().toString(36).slice(2, 8)}`
const waar = computed(() => (props.onderwerp === 'afspraak' ? 'een afspraak' : 'een beltaak'))

// Transcript: een bestand (.txt, .md, .vtt, .srt) of geplakte tekst. Ondertitels worden beurten.
async function leesBestand(bestand: File | null | undefined) {
  transcriptFout.value = ''; transcriptMelding.value = ''
  if (!bestand) return
  if (!magTranscript(bestand.name)) { transcriptFout.value = 'Kies een .txt, .md, .vtt of .srt. Een Word- of pdf-bestand: kopieer de tekst en plak hem hieronder.'; return }
  if (bestand.size > TRANSCRIPT_MAX_BYTES) { transcriptFout.value = 'Dit bestand is groter dan 5 MB.'; return }
  const r = transcriptUitBestand(bestand.name, await bestand.text())
  if (!r.tekst.trim()) { transcriptFout.value = 'In dit bestand staat geen tekst.'; return }
  transcriptConcept.value = r.tekst; transcriptNaam.value = bestand.name
  transcriptMelding.value = `${bestand.name} · ${r.woorden} woorden${r.afgekapt ? ' (ingekort)' : ''}. Controleer de tekst en bewaar.`
}
function onDrop(e: DragEvent) { sleepActief.value = false; leesBestand(e.dataTransfer?.files?.[0]) }
function onKies(e: Event) { const i = e.target as HTMLInputElement; leesBestand(i.files?.[0]); i.value = '' }
async function bewaarTranscript() {
  if (transcriptConcept.value.trim().length < 5) return
  bewaartTranscript.value = true
  try {
    const t = await $fetch<any>(`${props.api}/transcript`, { method: 'POST', body: { tekst: transcriptConcept.value, bestandsnaam: transcriptNaam.value } })
    emit('patch', { transcript: t })
    transcriptConcept.value = ''; transcriptNaam.value = null; transcriptMelding.value = ''
    toast.toon('Transcript bewaard. Analyseer het verslag voor actiepunten en koopsignalen.')
    emit('gewijzigd')
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bewaartTranscript.value = false }
}
async function verwijderTranscript() {
  try { await $fetch(`${props.api}/transcript`, { method: 'DELETE' }); emit('patch', { transcript: null }); toast.toon('Transcript verwijderd.'); emit('gewijzigd') } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function bewaarVerslag(stil = false) {
  if (!gewijzigd.value) return true
  bewaartVerslag.value = true
  try {
    const r = await $fetch<any>(`${props.api}/verslag`, { method: 'PUT', body: { tekst: tekst.value } })
    emit('patch', { verslag: r.verslag })
    if (!stil) toast.toon(r.verslag ? 'Verslag bewaard. Het staat op het tabblad Gespreksverslagen.' : 'Verslag gewist.')
    emit('gewijzigd'); return true
  } catch (e) { toast.toon(foutTekst(e), 'fout'); return false } finally { bewaartVerslag.value = false }
}
async function analyseer() {
  analyseReden.value = ''
  if (!(await bewaarVerslag(true))) return
  analyseert.value = true
  try {
    const r = await $fetch<any>(`${props.api}/analyse`, { method: 'POST' })
    if (!r.ok) { analyseReden.value = r.reden ?? 'De analyse is tegengehouden.'; return }
    await props.herlaad()
    toast.toon(r.actiepunten ? `Analyse klaar: ${r.actiepunten} ${r.actiepunten === 1 ? 'actiepunt staat' : 'actiepunten staan'} als concept klaar.` : 'Analyse klaar.')
    emit('gewijzigd')
  } catch (e) { analyseReden.value = foutTekst(e) } finally { analyseert.value = false }
}
defineExpose({ bewaarVerslag })
</script>

<template>
  <article class="fo-blok gv-blok" :data-test="tid('verslagblok')">
    <header class="gv-kop"><Icoon naam="FileText" /><h3 class="fo-blok-titel">Transcript en gespreksverslag</h3><span v-if="heeftTekst" class="pil pil--groen">Aanwezig</span></header>

    <section class="gv-deel" :aria-labelledby="`${uid}-tr`">
      <h4 :id="`${uid}-tr`" class="gv-sub">Transcript</h4>
      <div v-if="transcript" class="gv-tr-voorbeeld" :data-test="tid('transcript')">
        <p class="gv-pre gv-snippet">{{ snippet(transcript.tekst) }}</p>
        <p class="meta"><template v-if="transcript.bestandsnaam"><Icoon naam="FileText" :grootte="12" /> {{ transcript.bestandsnaam }} · </template>{{ transcript.woorden }} woorden · {{ transcript.bron === 'upload' ? 'geüpload' : 'geplakt' }}</p>
        <div class="dd-acties mt-8"><button type="button" class="dd-act" :data-test="tid('transcript-weg')" @click="verwijderTranscript">Verwijder transcript</button></div>
      </div>
      <template v-else>
        <button type="button" class="gv-drop" :class="{ 'gv-drop--over': sleepActief }" :data-test="tid('transcript-drop')" @dragover.prevent="sleepActief = true" @dragleave="sleepActief = false" @drop.prevent="onDrop" @click="bestandInput?.click()">
          <Icoon naam="Upload" :grootte="22" />
          <span class="gv-drop-titel">Sleep een transcript hierheen of klik om te kiezen</span>
          <span class="meta">.txt, .md of een Teams- of Zoom-transcript (.vtt, .srt), hooguit 5 MB</span>
        </button>
        <input ref="bestandInput" type="file" accept=".txt,.md,.vtt,.srt,text/plain,text/vtt" class="gv-verborgen" :data-test="tid('transcript-bestand')" aria-label="Kies een transcript" @change="onKies">
        <div class="gv-scheiding"><span>Of plak tekst</span></div>
        <textarea v-model="transcriptConcept" class="invoer" rows="4" placeholder="Plak hier het transcript van het gesprek" :data-test="tid('transcript-tekst')" aria-label="Transcript" />
        <p v-if="transcriptMelding" class="gv-gelezen"><Icoon naam="CircleCheck" :grootte="14" /> {{ transcriptMelding }}</p>
        <p v-if="transcriptFout" class="veld-fout">{{ transcriptFout }}</p>
        <div class="dd-acties mt-8"><span class="dd-acties-vul" /><button type="button" class="dd-act" :disabled="transcriptConcept.trim().length < 5 || bewaartTranscript" :data-test="tid('transcript-bewaar')" @click="bewaarTranscript">{{ bewaartTranscript ? 'Bewaren…' : 'Bewaar transcript' }}</button></div>
      </template>
    </section>

    <section class="gv-deel" :aria-labelledby="`${uid}-vs`">
      <h4 :id="`${uid}-vs`" class="gv-sub">Gespreksverslag</h4>
      <VerslagVeld v-model="tekst" :record="record" groot placeholder="Typ je verslag: wat is besproken, wat speelt er en wat is afgesproken" />
      <p class="meta mt-8">{{ tekst.trim() ? `${telWoorden(tekst)} woorden.` : 'Typ, plak of spreek in.' }} Het verslag staat op het tabblad Gespreksverslagen van de prospect{{ heeftContact ? ' en het contact' : '' }}.</p>
      <div class="dd-acties mt-8"><span class="dd-acties-vul" /><button type="button" class="dd-act" :disabled="!gewijzigd || bewaartVerslag" :data-test="tid('verslag-bewaar')" @click="bewaarVerslag()">{{ bewaartVerslag ? 'Bewaren…' : 'Bewaar verslag' }}</button></div>
    </section>

    <section class="gv-deel" :aria-labelledby="`${uid}-an`" :data-test="tid('analyse')">
      <div class="gv-an-kop"><div><span class="fo-blok-kicker">Notulist</span><h4 :id="`${uid}-an`" class="gv-sub">AI-analyse van het verslag</h4></div>
        <button type="button" class="dd-act dd-act--primair" :disabled="analyseert || !account || !(tekst.trim() || transcript)" :data-test="tid('analyseer')" @click="analyseer"><Icoon naam="Sparkles" />{{ analyseert ? 'Analyseren…' : analyse ? 'Opnieuw analyseren' : 'Analyseer verslag' }}</button>
      </div>
      <p v-if="!account" class="meta">Een analyse hoort bij {{ waar }} met een prospect.</p>
      <p v-else-if="!analyse && !analyseReden" class="meta">De Notulist maakt een samenvatting, zet actiepunten als concepttaak klaar en legt koopsignalen vast als inzicht. Jij keurt goed.</p>
      <p v-if="analyseReden" class="veld-fout" :data-test="tid('analyse-reden')">{{ analyseReden }}</p>
      <template v-if="analyse">
        <p v-if="herkomst.length" class="gv-herkomst"><span class="meta">Gebaseerd op</span><span v-for="h in herkomst" :key="h" class="pil">{{ h }}</span></p>
        <div v-if="analyse.samenvatting" class="gv-an-blok" :data-test="tid('samenvatting')"><span class="gv-an-label">Samenvatting</span><p>{{ analyse.samenvatting }}</p></div>
        <div class="gv-an-blok" :data-test="tid('actiepunten')"><span class="gv-an-label">Actiepunten</span>
          <ul v-if="analyse.actiepunten.length"><li v-for="p in analyse.actiepunten" :key="p">{{ p }}</li></ul>
          <p v-else class="meta">Geen actiepunten gevonden.</p>
          <p v-if="analyse.actiepunten.length" class="meta">Staan als concepttaak klaar in <FunctieLink to="/concepten" class="tekst-link" @click="emit('sluit')">Concepten</FunctieLink>.</p>
        </div>
        <div class="gv-an-blok" :data-test="tid('koopsignalen')"><span class="gv-an-label">Koopsignalen</span>
          <ul v-if="analyse.koopsignalen.length"><li v-for="k in analyse.koopsignalen" :key="k">{{ k }}</li></ul>
          <p v-else class="meta">Geen koopsignalen gevonden.</p>
          <p v-if="analyse.koopsignalen.length && account" class="meta">Staan als inzicht op de <NuxtLink :to="`/accounts/${account.id}?tab=inzichten`" class="tekst-link" @click="emit('sluit')">accountkaart</NuxtLink>.</p>
        </div>
        <div v-if="analyse.bezwaren.length" class="gv-an-blok" :data-test="tid('bezwaren')"><span class="gv-an-label">Bezwaren</span><ul><li v-for="b in analyse.bezwaren" :key="b">{{ b }}</li></ul></div>
        <div v-if="analyse.openVragen.length" class="gv-an-blok"><span class="gv-an-label">Open vragen</span><ul><li v-for="q in analyse.openVragen" :key="q">{{ q }}</li></ul></div>
        <div v-if="analyse.concurrenten.length" class="gv-an-blok"><span class="gv-an-label">Concurrenten genoemd</span><p>{{ analyse.concurrenten.join(', ') }}</p></div>
        <p v-if="uitkomstTekst" class="meta">{{ uitkomstTekst }}</p>
      </template>
    </section>
  </article>
</template>

<style scoped>
.gv-blok { border-left-color: var(--ink); }
.gv-kop { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.gv-kop .pil { margin-left: auto; }
.gv-deel { padding-top: 12px; margin-top: 12px; border-top: 1px solid var(--border); }
.gv-deel:first-of-type { margin-top: 0; }
.gv-sub { margin: 0 0 8px; font-size: var(--fs-label); font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink); }
.gv-pre { white-space: pre-wrap; }
.gv-drop { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 100%; min-height: 96px; padding: 16px; background: var(--surface); border: 1px dashed var(--border-strong); border-radius: var(--radius); font: inherit; color: var(--ink); text-align: center; cursor: pointer; }
.gv-drop:hover, .gv-drop--over { border-color: var(--ink); background: var(--yellow-zacht); }
.gv-drop-titel { font-weight: 700; font-size: var(--fs-klein); }
.gv-verborgen { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.gv-scheiding { display: flex; align-items: center; gap: 10px; margin: 12px 0 8px; font-size: var(--fs-label); font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
.gv-scheiding::before, .gv-scheiding::after { content: ''; flex: 1; height: 1px; background: var(--border); }
.gv-gelezen { display: flex; align-items: center; gap: 6px; margin: 8px 0 0; font-size: var(--fs-klein); color: var(--green); }
.gv-tr-voorbeeld { padding: 10px 12px; background: var(--surface); border-radius: var(--radius); }
.gv-snippet { margin: 0 0 6px; font-size: var(--fs-klein); }
.gv-an-kop { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 8px; flex-wrap: wrap; }
.gv-herkomst { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin: 0 0 10px; }
.gv-an-blok { margin-top: 10px; font-size: var(--fs-klein); }
.gv-an-blok ul { margin: 4px 0; padding-left: 18px; }
.gv-an-blok p { margin: 4px 0; }
.gv-an-label { display: block; font-size: var(--fs-label); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
@media (max-width: 720px) {
  .gv-an-kop .dd-act, .gv-deel .dd-act { min-height: 44px; }
}
</style>
