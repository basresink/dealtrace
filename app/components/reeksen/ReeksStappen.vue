<script setup lang="ts">
// De stappen van één opvolgreeks (F7), gedeeld door de flyout Volgen en de detailkolom op /opvolgreeksen: mandaat C of
// B, de stappen per dag met kanaal en status, het concept van de Schrijver ter goedkeuring (altijd een concept dat je
// goedkeurt; LinkedIn kopieer je en vink je af), en Reactie ontvangen, Pauzeer, Hervat en Stop. Na elke handeling
// meldt hij `gewijzigd`, zodat de ouder de reeks opnieuw laadt. Een beltaak opent de ouder via `open-taak`.
import { REEKS_KANAAL_LABEL, REEKS_MANDAAT_LABEL, STAP_STATUS_LABEL } from '~~/shared/opvolgreeks'

// kanStappen staat standaard aan (een ontbrekende boolean-prop zou anders false zijn).
const props = withDefaults(defineProps<{ reeks: any; mandaten: string[]; kanWijzigen: boolean; kanStappen?: boolean }>(), { kanStappen: true })
const emit = defineEmits<{ gewijzigd: []; 'open-taak': [id: string] }>()
const toast = useToast()
const bezig = ref(false)
const openStap = ref<string | null>(null)
const bewerk = reactive<Record<string, { tekst: string; onderwerp: string }>>({})
const reactieOpen = ref(false)
const reactie = reactive({ kanaal: 'mail', notitie: '' })
const loopt = computed(() => ['loopt', 'gepauzeerd'].includes(props.reeks?.status))
const stappenMag = computed(() => props.kanStappen && loopt.value)
watch(() => props.reeks, (r) => { for (const s of r?.stappen ?? []) if (s.concept && !bewerk[s.id]) bewerk[s.id] = { tekst: s.concept.tekst, onderwerp: s.concept.onderwerp ?? '' } }, { immediate: true })

async function wijzig(body: Record<string, string>, tekst: string) {
  bezig.value = true
  try { await $fetch(`/api/reeksen/${props.reeks.id}`, { method: 'PUT', body }); toast.toon(tekst); emit('gewijzigd') } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
function stop() { if (confirm('De reeks stoppen? Open stappen vallen weg en het ritme gaat verder.')) wijzig({ actie: 'stop' }, 'Reeks gestopt. Het ritme gaat verder.') }
async function meldReactie() {
  bezig.value = true
  try {
    const r = await $fetch<any>(`/api/reeksen/${props.reeks.id}/reactie`, { method: 'POST', body: { kanaal: reactie.kanaal, notitie: reactie.notitie } })
    reactieOpen.value = false; reactie.notitie = ''
    toast.toon(r?.belTerugTaakId ? 'Reeks gestopt. Bel terug binnen twee uur.' : 'Reeks gestopt.')
    emit('gewijzigd')
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
async function stapActie(s: any, actie: string) {
  bezig.value = true
  const b = bewerk[s.id]
  try {
    if (actie === 'kopieer' && b?.tekst) { try { await navigator.clipboard.writeText(b.tekst) } catch { /* geen klembord: de tekst staat in het veld */ } }
    const r = await $fetch<any>(`/api/reeksen/${props.reeks.id}/stappen/${s.id}`, { method: 'POST', body: { actie, tekst: b?.tekst ?? null, onderwerp: b?.onderwerp || null } })
    toast.toon(r.tekst)
    if (actie !== 'concept') openStap.value = null
    else delete bewerk[s.id]
    emit('gewijzigd')
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}

const ICOON: Record<string, string> = { bellen: 'Phone', mail: 'Mail', linkedin: 'Linkedin', einde: 'RefreshCw' }
const ICOON_KLASSE: Record<string, string> = { bellen: 'item-icoon--call', mail: 'item-icoon--email' }
const STATUS_PIL: Record<string, string> = { gepland: 'pil--leeg', open: 'pil--geel', gedaan: 'pil--groen', overgeslagen: 'pil--grijs', tegengehouden: 'pil--rood' }
const dag = (iso: string | null) => (iso ? new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' }).format(new Date(iso)).replace(/\./g, '') : '')
const tijd = (iso: string | null) => (iso ? new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(new Date(iso)).replace(/\./g, '') : '')
function stapMeta(s: any): string {
  if (s.status === 'gedaan') return `Klaar ${dag(s.gedaanOp)}`
  if (s.status === 'overgeslagen' || s.status === 'tegengehouden') return s.reden ?? STAP_STATUS_LABEL[s.status as keyof typeof STAP_STATUS_LABEL]
  if (s.kanaal === 'einde') return `Op ${dag(s.geplandOp)}, als er geen reactie is`
  if (s.status === 'open') {
    if (s.kanaal === 'bellen') return s.taak ? `${s.taak.inBelblok ? 'In je belblok' : 'Beltaak'} ${tijd(s.taak.dueDate)}` : 'Beltaak'
    return s.concept ? `Concept van de Schrijver${s.concept.status === 'goedgekeurd' ? ', goedgekeurd' : ', wacht op je goedkeuring'} · ${dag(s.geplandOp)}` : (s.reden ?? 'Nog geen concept')
  }
  if (s.kanaal === 'bellen') return `Landt in je belblok ${dag(s.geplandOp)}`
  return `Concept volgt een dag eerder · ${dag(s.geplandOp)}`
}
</script>

<template>
  <div class="rs">
    <div v-if="loopt" class="rs-mandaat">
      <span class="meta">Mandaat</span>
      <div class="keuzegroep keuzegroep--klein" role="group" aria-label="Mandaat">
        <button v-for="m in (['C', 'B'] as const)" :key="m" type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': reeks.mandaat === m }" :aria-pressed="reeks.mandaat === m"
          :disabled="bezig || !kanWijzigen || !mandaten.includes(m)" :title="!mandaten.includes(m) ? 'Het mandaat van de eigenaar staat dit niet toe' : undefined" :data-test="`vr-mandaat-${m}`" @click="reeks.mandaat !== m && wijzig({ mandaat: m }, `Mandaat: ${REEKS_MANDAAT_LABEL[m].toLowerCase()}.`)">{{ REEKS_MANDAAT_LABEL[m] }}</button>
      </div>
    </div>
    <ol class="rs-reeks" data-test="vr-stappen">
      <li v-for="s in reeks.stappen" :key="s.id" class="rs-stap" :class="`rs-stap--${s.status}`" :data-test="`vr-stap-${s.volgnummer}`">
        <span class="rs-dag tnum">Dag {{ s.dag }}</span>
        <span class="item-icoon" :class="ICOON_KLASSE[s.kanaal]"><Icoon :naam="ICOON[s.kanaal] ?? 'ListTodo'" :grootte="16" /></span>
        <div class="rs-body">
          <b class="rs-titel">{{ s.titel }}</b>
          <span class="item-meta">{{ stapMeta(s) }}</span>
        </div>
        <div class="rs-rechts">
          <button v-if="s.status === 'open' && s.kanaal !== 'bellen' && stappenMag" type="button" class="dd-act dd-act--geel" :aria-expanded="openStap === s.id" :data-test="`vr-bekijk-${s.volgnummer}`" @click="openStap = openStap === s.id ? null : s.id">Bekijk</button>
          <button v-else-if="s.status === 'open' && s.taak && stappenMag" type="button" class="dd-act" :data-test="`vr-taak-${s.volgnummer}`" @click="emit('open-taak', s.taak.id)">Open taak</button>
          <span v-else class="pil" :class="STATUS_PIL[s.status]">{{ s.kanaal === 'einde' && s.status === 'gepland' ? REEKS_KANAAL_LABEL.einde : STAP_STATUS_LABEL[s.status as keyof typeof STAP_STATUS_LABEL] }}</span>
        </div>
        <!-- Het concept van de Schrijver: altijd een concept dat jij goedkeurt. -->
        <div v-if="openStap === s.id" class="rs-concept" :data-test="`vr-concept-${s.volgnummer}`">
          <template v-if="s.concept && bewerk[s.id]">
            <p class="fo-blok-kicker rs-ai">Schrijver · {{ REEKS_KANAAL_LABEL[s.kanaal as 'mail' | 'linkedin'] }} · stap {{ s.volgnummer }} van {{ reeks.stand.van }}<template v-if="s.concept.stijlscore != null"> · stijlscore {{ s.concept.stijlscore }}</template></p>
            <label v-if="s.kanaal === 'mail'" class="veld"><span class="veld-label">Onderwerp</span><input v-model="bewerk[s.id]!.onderwerp" class="invoer" maxlength="120" data-test="vr-onderwerp"></label>
            <label class="veld"><span class="veld-label">{{ s.kanaal === 'mail' ? 'Tekst' : 'Notitie' }}</span><textarea v-model="bewerk[s.id]!.tekst" class="invoer" rows="5" :maxlength="s.kanaal === 'linkedin' ? 300 : 1500" data-test="vr-tekst" /></label>
            <p v-if="s.kanaal === 'linkedin'" class="meta tnum">{{ bewerk[s.id]!.tekst.length }} van 300 tekens. LinkedIn verstuurt Dealtrace nooit zelf: kopieer de tekst en vink de taak af.</p>
            <p v-else-if="reeks.mandaat === 'B' && s.autoMislukt" class="meta">Niet vanzelf verstuurd: {{ s.autoMislukt }}.</p>
            <p v-else class="meta">Keur goed en verstuur gaat via de Verzender, langs de Bewaker, met de afmeldlink onder een eerste mail.</p>
            <div v-if="s.concept.bronnen?.length" class="rs-herkomst"><span class="rs-label">Gebaseerd op</span><span v-for="(b, i) in s.concept.bronnen" :key="i" class="pil pil--leeg">{{ b.titel }}</span></div>
            <div class="rs-acties">
              <template v-if="s.kanaal === 'mail'">
                <button type="button" class="dd-act dd-act--primair" :disabled="bezig" data-test="vr-verstuur" @click="stapActie(s, 'verstuur')">Keur goed en verstuur</button>
                <button type="button" class="dd-act" :disabled="bezig" data-test="vr-zelf" @click="stapActie(s, 'zelf-verstuurd')">Zelf verstuurd</button>
              </template>
              <button v-else type="button" class="dd-act dd-act--primair" :disabled="bezig" data-test="vr-kopieer" @click="stapActie(s, 'kopieer')"><Icoon naam="Copy" :grootte="14" />Kopieer en vink af</button>
              <button type="button" class="dd-act" :disabled="bezig" data-test="vr-overslaan" @click="stapActie(s, 'overslaan')">Sla over</button>
            </div>
          </template>
          <template v-else>
            <p class="meta">{{ s.reden ?? 'Nog geen concept.' }}</p>
            <div class="rs-acties">
              <button type="button" class="dd-act dd-act--primair" :disabled="bezig" data-test="vr-concept" @click="stapActie(s, 'concept')"><Icoon naam="Sparkles" :grootte="14" />Maak concept</button>
              <button type="button" class="dd-act" :disabled="bezig" data-test="vr-overslaan" @click="stapActie(s, 'overslaan')">Sla over</button>
            </div>
          </template>
        </div>
      </li>
    </ol>
    <div v-if="kanWijzigen && loopt" class="rs-acties">
      <button type="button" class="dd-act rs-zwart" :aria-expanded="reactieOpen" data-test="vr-reactie" @click="reactieOpen = !reactieOpen"><Icoon naam="Inbox" :grootte="14" />Reactie ontvangen</button>
      <button v-if="reeks.status === 'loopt'" type="button" class="dd-act" :disabled="bezig" data-test="vr-pauzeer" @click="wijzig({ actie: 'pauzeer' }, 'Reeks gepauzeerd.')"><Icoon naam="Pause" :grootte="14" />Pauzeer</button>
      <button v-else type="button" class="dd-act" :disabled="bezig" data-test="vr-hervat" @click="wijzig({ actie: 'hervat' }, 'Reeks hervat. De geplande stappen schuiven op.')"><Icoon naam="Play" :grootte="14" />Hervat</button>
      <button type="button" class="dd-act dd-act--gevaar" :disabled="bezig" data-test="vr-stop" @click="stop"><Icoon naam="Square" :grootte="14" />Stop</button>
    </div>
    <form v-if="reactieOpen && loopt" class="rs-reactie" data-test="vr-reactie-form" @submit.prevent="meldReactie">
      <p class="meta">De reeks stopt en je krijgt een taak om terug te bellen, binnen twee uur. Met een gekoppelde mailbox gaat dit bij een antwoord vanzelf.</p>
      <label class="veld"><span class="veld-label">Via</span><select v-model="reactie.kanaal" class="invoer"><option value="mail">Mail</option><option value="telefoon">Telefoon</option><option value="linkedin">LinkedIn</option><option value="anders">Anders</option></select></label>
      <label class="veld"><span class="veld-label">Wat zei de prospect?</span><textarea v-model="reactie.notitie" class="invoer" rows="2" maxlength="1000" data-test="vr-reactie-notitie" /></label>
      <div class="rs-acties"><button type="submit" class="dd-act dd-act--primair" :disabled="bezig" data-test="vr-reactie-stop">Stop de reeks en bel terug</button></div>
    </form>
  </div>
</template>

<style scoped>
.rs-mandaat { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 10px; }
.rs-reeks { margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--border); }
.rs-stap { display: grid; grid-template-columns: 52px 36px minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--border); }
.rs-stap--overgeslagen .rs-titel, .rs-stap--tegengehouden .rs-titel { color: var(--muted); text-decoration: line-through; }
.rs-dag { font-size: var(--fs-label); font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
.rs-body { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
.rs-titel { font-size: 14px; line-height: 1.4; overflow-wrap: anywhere; }
.rs-rechts { display: flex; justify-content: flex-end; }
.rs-concept { grid-column: 1 / -1; display: flex; flex-direction: column; gap: 10px; padding: 12px 14px; background: var(--surface); border-left: 3px solid var(--purple); }
.rs-ai { color: var(--purple); }
.rs-herkomst { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.rs-label { font-size: var(--fs-label); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.rs-acties { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 12px; }
.rs-reactie { display: flex; flex-direction: column; gap: 12px; margin-top: 12px; }
.rs-zwart { background: var(--ink); color: var(--yellow); border-color: var(--ink); }
@media (max-width: 719px) {
  .rs-stap { grid-template-columns: 36px minmax(0, 1fr) auto; }
  .rs-dag { grid-column: 1 / -1; }
  .rs-acties .dd-act, .keuzegroep-knop { min-height: var(--touch-target-min); }
}
</style>
