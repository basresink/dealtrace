<script setup lang="ts">
// Volgen (F2 en F7) op de account- en contactkaart: de volgende beste stap met de weging (factoren met punten),
// twee alternatieven, het oordeel van de Bewaker en de herkomst, met Doe het nu, Plan in en Niet nu (al gedaan,
// klopt niet, later). Daaronder de opvolgreeks van het account: stappen per dag met kanaal en status, mandaat C of
// B, Pauzeer, Stop en "Reactie ontvangen"; of een reeks starten vanuit een sjabloon. Concepten komen van de Schrijver
// en zijn altijd een concept dat je goedkeurt; LinkedIn kopieer je en vink je af. Doe het nu opent de taak.
import { NIET_NU_LABEL, NIET_NU_REDENEN, STAP_SOORT_LABEL } from '~~/shared/volgendeStap'
import { REEKS_KANAAL_LABEL, REEKS_MANDAAT_LABEL } from '~~/shared/opvolgreeks'

const props = defineProps<{ open: boolean; accountId: string; naam: string; contactId?: string | null; contactNaam?: string | null }>()
const emit = defineEmits<{ sluit: []; gewijzigd: [] }>()
const toast = useToast()
const d = ref<any>(null)
const laden = ref(false)
const bezig = ref(false)
const fout = ref<string | null>(null)
const taakId = ref<string | null>(null)
const nietNuOpen = ref(false)
const start = reactive({ sjabloonId: '', contactId: '', mandaat: 'C' as 'B' | 'C' })

async function laad() {
  laden.value = !d.value
  fout.value = null
  try {
    d.value = await $fetch<any>(`/api/volgen/${props.accountId}`, { query: props.contactId ? { contact: props.contactId } : {} })
    if (!start.sjabloonId) start.sjabloonId = d.value.sjablonen[0]?.id ?? ''
    if (!start.contactId) start.contactId = props.contactId ?? d.value.stap.contactId ?? d.value.contacten[0]?.id ?? ''
  } catch (e) { fout.value = foutTekst(e) } finally { laden.value = false }
}
watch(() => props.open, (o) => { if (o) { nietNuOpen.value = false; laad() } }, { immediate: true })
function sluit() { emit('sluit') }
function toets(e: KeyboardEvent) { if (e.key === 'Escape' && props.open && !taakId.value) sluit() }
onMounted(() => document.addEventListener('keydown', toets))
onBeforeUnmount(() => document.removeEventListener('keydown', toets))

async function kies(keuze: 'nu' | 'plan' | 'niet-nu' | 'alternatief', k: any, reden?: string) {
  bezig.value = true
  try {
    const r = await $fetch<any>(`/api/volgen/${props.accountId}/keuze`, { method: 'POST', body: { sleutel: k.sleutel, keuze, reden: reden ?? null, contactId: props.contactId ?? null } })
    toast.toon(r.tekst)
    nietNuOpen.value = false
    emit('gewijzigd')
    if ((keuze === 'nu' || keuze === 'alternatief') && r.taskId) taakId.value = r.taskId
    else await laad()
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
async function taakDicht() { taakId.value = null; emit('gewijzigd'); await laad() }

// Opvolgreeks
const reeks = computed(() => d.value?.reeks ?? null)
const loopt = computed(() => !!reeks.value && ['loopt', 'gepauzeerd'].includes(reeks.value.status))
const sjabloon = computed(() => d.value?.sjablonen.find((s: any) => s.id === start.sjabloonId) ?? null)
async function startReeks() {
  bezig.value = true
  try {
    await $fetch(`/api/volgen/${props.accountId}/reeks`, { method: 'POST', body: { sjabloonId: start.sjabloonId, contactId: start.contactId || null, mandaat: start.mandaat } })
    toast.toon(`Reeks ${sjabloon.value?.naam ?? ''} gestart.`)
    emit('gewijzigd'); await laad()
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
// De stappen, het mandaat en de knoppen van de reeks staan in ReeksStappen (gedeeld met /opvolgreeksen).
async function reeksGewijzigd() { emit('gewijzigd'); await laad() }

const ICOON: Record<string, string> = { bellen: 'Phone', mail: 'Mail', linkedin: 'Linkedin', bezoek: 'MapPin', taak: 'ListTodo', wachten: 'Pause', einde: 'RefreshCw' }
const ICOON_KLASSE: Record<string, string> = { bellen: 'item-icoon--call', mail: 'item-icoon--email', bezoek: 'item-icoon--visit' }
const SOORT_PIL: Record<string, string> = { bellen: 'pil--blauw', mail: 'pil--blauw', linkedin: 'pil--blauw', bezoek: 'pil--groen', taak: 'pil--grijs', wachten: 'pil--grijs' }
const dag = (iso: string | null) => (iso ? new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' }).format(new Date(iso)).replace(/\./g, '') : '')
function stappenTekst(s: { stappen: { dag: number; kanaal: string }[]; einde: { dag: number } }) {
  return `${s.stappen.map((x) => `Dag ${x.dag} ${(REEKS_KANAAL_LABEL[x.kanaal as keyof typeof REEKS_KANAAL_LABEL] ?? x.kanaal).toLowerCase()}`).join(' · ')} · dag ${s.einde.dag} terug naar het ritme`
}
const factorBreedte = (p: number) => `${Math.min(100, Math.abs(p) * 2)}%`
const titelKicker = computed(() => (props.contactId ? `Volgen · ${props.contactNaam ?? 'contact'} bij ${props.naam}` : `Volgen · ${props.naam}`))
</script>

<template>
  <Teleport to="body">
    <div v-if="open && !taakId" class="fo-overlay" @click.self="sluit">
      <aside class="fo-panel fo-panel--breed fo-panel--schuif" role="dialog" aria-modal="true" aria-labelledby="vl-titel" data-test="volgen-flyout">
        <header class="fo-head">
          <div class="fo-head-tekst">
            <span class="fo-kicker">{{ titelKicker }}</span>
            <h2 id="vl-titel" class="fo-titel">Volgende beste stap</h2>
            <p class="fo-meta">Gewogen uit taken, inzichten, ritme, fase en bereikbaarheid. De Bewaker toetst elke stap.</p>
          </div>
          <button type="button" class="fo-sluit" aria-label="Sluiten" data-test="volgen-sluit" @click="sluit">×</button>
        </header>

        <div class="fo-body">
          <p v-if="laden" class="fo-leeg">Laden…</p>
          <p v-else-if="fout" class="fo-fout" data-test="volgen-fout">{{ fout }}</p>
          <template v-else-if="d">
            <!-- 1. De volgende beste stap -->
            <article class="fo-blok fo-blok--accent" data-test="vs-stap">
              <span class="fo-blok-kicker">Volgende beste stap</span>
              <h3 class="vl-stap-titel" data-test="vs-titel">{{ d.stap.titel }}</h3>
              <div class="vl-tags">
                <span class="pil" :class="SOORT_PIL[d.stap.soort]" data-test="vs-soort">{{ STAP_SOORT_LABEL[d.stap.soort as keyof typeof STAP_SOORT_LABEL] }}</span>
                <span class="pil pil--zwart tnum" data-test="vs-score">{{ d.stap.score }} punten</span>
                <NuxtLink v-if="d.stap.contactId && d.stap.contactId !== contactId" :to="`/contacten/${d.stap.contactId}`" class="tekst-link vl-contact" @click="sluit">{{ d.stap.contactNaam }}</NuxtLink>
              </div>
              <ul class="vl-factoren" data-test="vs-factoren" aria-label="Weging">
                <li v-for="(f, i) in d.stap.factoren" :key="i" class="vl-factor">
                  <span class="vl-factor-label">{{ f.label }}</span>
                  <b class="tnum" :class="{ 'vl-min': f.punten < 0 }">{{ f.punten > 0 ? `+${f.punten}` : f.punten }}</b>
                  <span class="vl-balk" aria-hidden="true"><i :class="{ 'vl-balk--min': f.punten < 0 }" :style="{ width: factorBreedte(f.punten) }" /></span>
                </li>
              </ul>
              <div class="vl-bewaker" :class="{ 'vl-bewaker--nee': !d.stap.bewaker.mag }" data-test="vs-bewaker">
                <Icoon naam="ShieldCheck" :grootte="16" />
                <p><strong>Bewaker</strong> {{ d.stap.bewaker.tekst }}</p>
              </div>
              <div class="vl-herkomst" data-test="vs-herkomst"><span class="vl-label">Gebaseerd op</span><span v-for="h in d.herkomst" :key="h" class="pil pil--leeg">{{ h }}</span></div>
              <div v-if="d.kan.wijzigen" class="vl-acties">
                <template v-if="d.stap.soort !== 'wachten'">
                  <button type="button" class="dd-actie dd-actie--primair" :disabled="bezig" data-test="vs-nu" @click="kies('nu', d.stap)"><Icoon :naam="ICOON[d.stap.soort] ?? 'Check'" class="dd-actie-icoon" />Doe het nu</button>
                  <button type="button" class="dd-actie dd-actie--secundair" :disabled="bezig" data-test="vs-plan" @click="kies('plan', d.stap)"><Icoon naam="Calendar" class="dd-actie-icoon" />Plan in</button>
                </template>
                <button type="button" class="dd-actie dd-actie--secundair" :aria-expanded="nietNuOpen" data-test="vs-niet-nu" @click="nietNuOpen = !nietNuOpen">Niet nu</button>
              </div>
              <div v-if="nietNuOpen" class="vl-nietnu" role="group" aria-label="Waarom niet nu?" data-test="vs-niet-nu-redenen">
                <span class="meta">Waarom niet?</span>
                <button v-for="r in NIET_NU_REDENEN" :key="r" type="button" class="filter-pil" :disabled="bezig" :data-test="`vs-reden-${r}`" @click="kies('niet-nu', d.stap, r)">{{ NIET_NU_LABEL[r] }}</button>
              </div>
            </article>

            <!-- 2. Alternatieven -->
            <section class="vl-sectie" data-test="vs-alternatieven">
              <h3 class="vl-kop">Alternatieven</h3>
              <ul v-if="d.alternatieven.length" class="vl-lijst">
                <li v-for="(a, i) in d.alternatieven" :key="a.sleutel">
                  <div class="item-rij vl-rij" :data-test="`vs-alt-${i}`">
                    <span class="item-icoon" :class="ICOON_KLASSE[a.soort]"><Icoon :naam="ICOON[a.soort] ?? 'ListTodo'" :grootte="16" /></span>
                    <div class="item-body"><div class="item-naam">{{ a.titel }}</div><div class="item-meta">{{ a.waarom }}</div></div>
                    <div class="item-acties"><span class="pil pil--leeg tnum">{{ a.score }}</span><button v-if="d.kan.wijzigen" type="button" class="dd-act" :disabled="bezig || !a.bewaker.mag" :data-test="`vs-kies-${i}`" @click="kies('alternatief', a)">Kies</button></div>
                  </div>
                </li>
              </ul>
              <p v-else class="meta">Geen alternatieven.</p>
            </section>

            <!-- 3. Opvolgreeks -->
            <section class="vl-sectie" data-test="vr-blok">
              <header class="vl-kop-rij">
                <h3 class="vl-kop">Opvolgreeks</h3>
                <span v-if="reeks" class="pil" :class="reeks.status === 'loopt' ? 'pil--geel' : reeks.status === 'gestopt' && reeks.stopreden !== 'handmatig' ? 'pil--groen' : 'pil--grijs'" data-test="vr-status">{{ reeks.stand.label }}</span>
              </header>
              <template v-if="reeks && loopt">
                <p class="meta vl-reeks-meta" data-test="vr-meta"><strong>{{ reeks.naam }}</strong><template v-if="reeks.contact"> · {{ reeks.contact.naam }}</template> · gestart {{ dag(reeks.gestartOp) }}<template v-if="reeks.aanleiding"> na "{{ reeks.aanleiding }}"</template> · stap {{ reeks.stand.stap }} van {{ reeks.stand.van }}<template v-if="reeks.stand.wacht"> · {{ reeks.stand.wacht }} {{ reeks.stand.wacht === 1 ? 'wacht' : 'wachten' }} op jou</template></p>
                <ReeksStappen :reeks="reeks" :mandaten="d.mandaten" :kan-wijzigen="d.kan.wijzigen" @gewijzigd="reeksGewijzigd" @open-taak="(id: string) => (taakId = id)" />
              </template>
              <template v-else>
                <p v-if="reeks" class="meta" data-test="vr-vorige">Laatste reeks: {{ reeks.naam }}, {{ reeks.stand.label.charAt(0).toLowerCase() + reeks.stand.label.slice(1) }} ({{ dag(reeks.gestoptOp) }}).<template v-if="reeks.belTerugTaakId"> <button type="button" class="tekst-link vl-link" data-test="vr-belterug" @click="taakId = reeks.belTerugTaakId">Open de taak bel terug</button></template></p>
                <p class="meta">Na "stuur maar wat informatie", een voicemail of een eerste gesprek: een reeks van mail, LinkedIn en een belmoment die vanzelf stopt zodra de prospect reageert.</p>
                <form v-if="d.kan.wijzigen && d.sjablonen.length" class="vl-start" data-test="vr-start-form" @submit.prevent="startReeks">
                  <fieldset class="veld">
                    <legend class="veld-label">Sjabloon</legend>
                    <label v-for="s in d.sjablonen" :key="s.id" class="vl-sjabloon" :class="{ 'vl-sjabloon--aan': start.sjabloonId === s.id }" :data-test="`vr-sjabloon-${s.sleutel}`">
                      <input v-model="start.sjabloonId" type="radio" name="vl-sjabloon" :value="s.id">
                      <span><b>{{ s.naam }}</b><span class="item-meta"> · na "{{ s.na }}"</span><span class="vl-sjabloon-stappen">{{ stappenTekst(s) }}</span></span>
                    </label>
                  </fieldset>
                  <div class="vl-rij2">
                    <label class="veld"><span class="veld-label">Contactpersoon</span>
                      <select v-model="start.contactId" class="invoer" data-test="vr-contact"><option v-for="c in d.contacten" :key="c.id" :value="c.id">{{ c.naam }}{{ c.email ? '' : ' (geen e-mailadres)' }}</option></select>
                    </label>
                    <div class="veld"><span class="veld-label">Mandaat</span>
                      <div class="keuzegroep keuzegroep--klein" role="group" aria-label="Mandaat">
                        <button v-for="m in (['C', 'B'] as const)" :key="m" type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': start.mandaat === m }" :aria-pressed="start.mandaat === m" :disabled="!d.mandaten.includes(m)" :data-test="`vr-start-mandaat-${m}`" @click="start.mandaat = m">{{ REEKS_MANDAAT_LABEL[m] }}</button>
                      </div>
                    </div>
                  </div>
                  <p class="meta">Mail en LinkedIn krijgen een concept van de Schrijver (AI-credits); je keurt elk concept goed. Bij "Binnen kader" verstuurt de reeks een mail op de dag zelf, langs de Bewaker.</p>
                  <div class="vl-acties"><button type="submit" class="dd-actie dd-actie--primair" :disabled="bezig || !start.sjabloonId" data-test="vr-start">Start reeks</button></div>
                </form>
                <p v-else-if="!d.kan.wijzigen" class="meta">Alleen de eigenaar van het account, zijn salesmanager of de beheerder start hier een reeks.</p>
              </template>
            </section>
          </template>
        </div>
      </aside>
    </div>
    <TaakFlyout :open="!!taakId" :taak-id="taakId" @sluit="taakDicht" @klaar="taakDicht" @gewijzigd="emit('gewijzigd')" />
  </Teleport>
</template>

<style scoped>
.vl-stap-titel { margin: 2px 0 10px; font-family: var(--font-serif); font-size: 19px; font-weight: 700; line-height: 1.35; color: var(--ink); overflow-wrap: anywhere; }
.vl-tags { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 12px; }
.vl-contact { font-size: var(--fs-klein); }
.vl-factoren { display: grid; gap: 8px; margin: 0 0 12px; padding: 0; list-style: none; }
.vl-factor { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px 12px; font-size: var(--fs-klein); line-height: 1.45; }
.vl-factor-label { min-width: 0; overflow-wrap: anywhere; }
.vl-min { color: var(--red); }
.vl-balk { grid-column: 1 / -1; height: 4px; background: var(--border); }
.vl-balk i { display: block; height: 100%; background: var(--yellow-dark, var(--yellow)); }
.vl-balk i.vl-balk--min { background: var(--red); }
.vl-bewaker { display: flex; align-items: flex-start; gap: 8px; margin: 0 0 10px; padding: 10px 12px; background: var(--wit); border-left: 3px solid var(--green); font-size: var(--fs-klein); }
.vl-bewaker p { margin: 0; }
.vl-bewaker--nee { border-left-color: var(--red); }
.vl-herkomst { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 4px; }
.vl-label { font-size: var(--fs-label); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.vl-acties { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 12px; }
.vl-nietnu { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 10px; }
.vl-sectie { margin-top: 22px; }
.vl-kop-rij { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
.vl-kop { margin: 0 0 8px; font-size: var(--fs-label); font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; color: var(--muted); }
.vl-kop-rij .vl-kop { margin: 0; }
.vl-lijst { margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--border); }
.vl-rij { grid-template-columns: 36px minmax(0, 1fr) auto; }
.vl-reeks-meta { margin: 0 0 10px; }
.vl-start { display: flex; flex-direction: column; gap: 12px; margin-top: 12px; }
.vl-sjabloon { display: flex; align-items: flex-start; gap: 10px; margin-top: 8px; padding: 10px 12px; border: 1px solid var(--border); cursor: pointer; font-size: var(--fs-klein); line-height: 1.45; }
.vl-sjabloon--aan { border-color: var(--ink); background: var(--yellow-zacht, var(--surface)); }
.vl-sjabloon input { margin-top: 3px; }
.vl-sjabloon-stappen { display: block; color: var(--muted); }
.vl-rij2 { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: end; }
.vl-link { padding: 0; background: none; border: 0; font: inherit; cursor: pointer; }
@media (max-width: 719px) {
  .vl-rij { grid-template-columns: 36px minmax(0, 1fr); }
  .vl-rij .item-acties { grid-column: 2; justify-content: flex-start; }
  .vl-rij2 { grid-template-columns: 1fr; }
  .vl-acties .dd-act, .vl-nietnu .filter-pil, .keuzegroep-knop, .vl-link { min-height: var(--touch-target-min); }
  .vl-sjabloon { min-height: var(--touch-target-min); }
  .vl-contact { display: inline-flex; align-items: center; min-height: var(--touch-target-min); }
}
</style>
