<script setup lang="ts">
// Belblok plannen: advies uit je agenda (eerst je vaste blokken, dan vrije gaten), of je
// eigen tijdstip. Rekent gesprekstijd, marge en blok, en laat vooraf zien wat niet past en
// waar het heen schuift (zelfde verdeling als POST /api/belblokken/plan).
import { blokduur, kaalBlok, marge, PLEKKEN, soortLabel, verdeelOverBlok, volgendVastBlok, type VastBlok } from '~~/shared/belblokken'
import { nlMoment, nlTijdstip } from '~~/shared/datum'

interface Advies { start: string; eind: string; bron: 'vast' | 'vrij'; label: string; blokId?: string }
const props = defineProps<{
  gekozen: { accountId: string; duur: number }[]
  advies: Advies[]
  blokken: VastBlok[]
  voorkeuren: { lunch: { start: string; minuten: number } }
  agendaGekoppeld: boolean
  kanPlannen: boolean
}>()
const emit = defineEmits<{ gepland: []; ververs: [] }>()
const toast = useToast()

const TZ = 'Europe/Amsterdam'
const uurMin = (d: Date) => new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(d)
const vandaag = nlMoment(new Date()).datum
const morgen = nlMoment(new Date(Date.now() + 864e5)).datum
function dagLabel(d: Date) {
  const dag = nlMoment(d).datum
  if (dag === vandaag) return 'Vandaag'
  if (dag === morgen) return 'Morgen'
  const t = new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'short', timeZone: TZ }).format(d)
  return t.charAt(0).toUpperCase() + t.slice(1)
}
const minVan = (hhmm: string) => { const [u, m] = hhmm.split(':').map(Number); return (u ?? 0) * 60 + (m ?? 0) }

const gesprekstijd = computed(() => props.gekozen.reduce((s, k) => s + k.duur, 0))
// Een vrij gat krijgt de lengte die de keuze nodig heeft (hooguit 240 minuten, de grens van de API).
const vrijeDuur = computed(() => Math.min(240, blokduur(gesprekstijd.value)))

// ── Moment ─────────────────────────────────────────────────────────────
const keuze = ref<string>('')
watch(() => props.advies, (a) => { if (!keuze.value || (keuze.value !== 'eigen' && !a.some((x) => x.start === keuze.value))) keuze.value = a[0]?.start ?? 'eigen' }, { immediate: true })
const tijdvakken = computed(() => props.advies.map((a) => {
  const blok = a.blokId ? props.blokken.find((b) => b.id === a.blokId) : undefined
  const minuten = a.bron === 'vast' ? Math.round((Date.parse(a.eind) - Date.parse(a.start)) / 60_000) : vrijeDuur.value
  const s = new Date(a.start)
  return {
    ...a, blok, minuten,
    titel: `${dagLabel(s)} ${uurMin(s)} tot ${uurMin(new Date(s.getTime() + minuten * 60_000))}`,
    sub: a.bron === 'vast' ? `Vast blok${blok ? ` · ${soortLabel(blok)} · ${blok.plek}` : ''}` : props.agendaGekoppeld ? 'Vrij in je agenda' : 'Vrij tussen je blokken',
  }
}))

const datum = ref('')
const van = ref('')
const tot = ref('')
function eigenAan() { keuze.value = 'eigen' }

const lunchAan = computed(() => props.voorkeuren.lunch.minuten > 0)
const lunchLabel = computed(() => {
  const l = props.voorkeuren.lunch
  const m = l.minuten > 0 ? l.minuten : 45
  const e = minVan(l.start) + m
  return `${l.start} tot ${String(Math.floor(e / 60)).padStart(2, '0')}:${String(e % 60).padStart(2, '0')}`
})

const gekozenVak = computed(() => tijdvakken.value.find((t) => t.start === keuze.value) ?? null)
const eigenMinuten = computed(() => (van.value && tot.value ? minVan(tot.value) - minVan(van.value) : 0))
const eigenFout = computed(() => {
  if (keuze.value !== 'eigen') return ''
  if (!datum.value || !van.value || !tot.value) return 'Kies een datum, een begin en een eind.'
  if (eigenMinuten.value < 30 || eigenMinuten.value > 240) return 'Een blok duurt 30 tot 240 minuten.'
  const [u, m] = van.value.split(':').map(Number)
  if (nlTijdstip(datum.value, u ?? 0, m ?? 0).getTime() < Date.now() - 15 * 60_000) return 'Dat moment is al voorbij.'
  const l = props.voorkeuren.lunch
  if (lunchAan.value && minVan(van.value) < minVan(l.start) + l.minuten && minVan(tot.value) > minVan(l.start)) return `Dit valt in je lunch (${lunchLabel.value}). Zet het vinkje uit of kies een ander tijdstip.`
  return ''
})
const start = computed(() => {
  if (keuze.value !== 'eigen') return gekozenVak.value?.start ?? ''
  if (eigenFout.value) return ''
  const [u, m] = van.value.split(':').map(Number)
  return nlTijdstip(datum.value, u ?? 0, m ?? 0).toISOString()
})
const minuten = computed(() => (keuze.value === 'eigen' ? eigenMinuten.value : gekozenVak.value?.minuten ?? vrijeDuur.value))

// ── Plek en verdeling ──────────────────────────────────────────────────
const plek = ref<string>('Kantoor')
watch(gekozenVak, (t) => { if (t?.blok?.plek && (PLEKKEN as readonly string[]).includes(t.blok.plek)) plek.value = t.blok.plek })
const verdeling = computed(() => {
  if (!start.value || !props.gekozen.length) return null
  const eind = new Date(Date.parse(start.value) + minuten.value * 60_000)
  const volgend = volgendVastBlok(props.blokken, eind)
  return verdeelOverBlok(props.gekozen, minuten.value, volgend ? { label: volgend.label, start: volgend.start.toISOString() } : null)
})
const nietPast = computed(() => {
  const v = verdeling.value
  if (!v) return ''
  const n = v.geschoven.length + v.inLijst.length
  if (!n) return ''
  const wat = n === 1 ? '1 gesprek past niet in dit blok' : `${n} gesprekken passen niet in dit blok`
  return v.naar ? `${wat}, ${n === 1 ? 'schuift' : 'schuiven'} door naar je vaste blok van ${v.naar.label}.` : `${wat}, ${n === 1 ? 'blijft' : 'blijven'} in je bellijst.`
})

// ── Lunch (voorkeur, vanaf Gevorderd) ──────────────────────────────────
const bewaarLunch = async (lunch: { start: string; minuten: number }) => {
  try {
    const blokken = props.blokken.map(kaalBlok)
    await $fetch('/api/mij/belblokken', { method: 'PUT', body: { blokken, voorkeuren: { lunch } } })
    emit('ververs')
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const lunchStart = ref(props.voorkeuren.lunch.start)
watch(() => props.voorkeuren.lunch.start, (s) => { lunchStart.value = s })
function wisselLunch(aan: boolean) { bewaarLunch({ start: props.voorkeuren.lunch.start, minuten: aan ? 45 : 0 }) }
function zetLunchStart() { if (/^\d\d:\d\d$/.test(lunchStart.value)) bewaarLunch({ start: lunchStart.value, minuten: props.voorkeuren.lunch.minuten }) }

// ── Plannen ────────────────────────────────────────────────────────────
const bezet = ref(true)
const stil = ref(true)
const bezig = ref(false)
async function plan() {
  if (!start.value || !props.gekozen.length) return
  bezig.value = true
  try {
    const soort = gekozenVak.value?.blok?.soort ?? 'gemengd'
    const r = await $fetch<any>('/api/belblokken/plan', { method: 'POST', body: { start: start.value, minuten: minuten.value, plek: plek.value, soort, verhouding: gekozenVak.value?.blok?.verhouding, accountIds: props.gekozen.map((k) => k.accountId), bezet: bezet.value, stil: stil.value } })
    toast.toon(r.toast)
    if (r.agenda && !r.agenda.ok) toast.toon(`Agenda op bezet: ${r.agenda.reden}.`, 'let-op')
    datum.value = ''; van.value = ''; tot.value = ''
    emit('gepland')
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
</script>

<template>
  <aside class="bp" data-test="planpaneel">
    <div class="bp-kop">
      <h2 class="bp-titel">Belblok plannen</h2>
      <NuxtLink to="/agenda" class="bp-link">Agenda <Icoon naam="ArrowRight" :grootte="14" /></NuxtLink>
    </div>
    <p class="bp-sub" data-test="aantal-gekozen">{{ gekozen.length }} {{ gekozen.length === 1 ? 'gesprek' : 'gesprekken' }} geselecteerd</p>

    <p class="bp-label">Advies uit je agenda</p>
    <p v-if="!agendaGekoppeld" class="bp-noot">Alleen je eigen blokken, je agenda is nog niet gekoppeld.</p>
    <div class="bp-vakken" role="radiogroup" aria-label="Advies uit je agenda">
      <label v-for="t in tijdvakken" :key="t.start" class="bp-vak" :class="{ 'bp-vak--aan': keuze === t.start }">
        <input v-model="keuze" type="radio" name="moment" :value="t.start" class="bp-radio">
        <span class="bp-vak-titel">{{ t.titel }}</span>
        <span class="bp-vak-sub">{{ t.sub }}</span>
      </label>
      <p v-if="!tijdvakken.length" class="bp-noot">Geen vrij moment in de komende twee weken. Kies hieronder je eigen tijdstip.</p>
    </div>

    <label class="bp-vink">
      <input type="checkbox" :checked="lunchAan" :disabled="!kanPlannen" data-test="lunch-vrij" @change="wisselLunch(($event.target as HTMLInputElement).checked)">
      <span>Niet tijdens de lunch ({{ lunchLabel }})</span>
    </label>
    <label v-if="lunchAan && kanPlannen" class="bp-lunch"><span>Lunch begint om</span><input v-model="lunchStart" type="time" class="bp-invoer bp-invoer--klein" aria-label="Begin van je lunch" @change="zetLunchStart"></label>

    <p class="bp-label">Of kies je eigen tijdstip</p>
    <div class="bp-eigen" :class="{ 'bp-eigen--aan': keuze === 'eigen' }">
      <label class="bp-veld bp-veld--datum"><span class="bp-veldlabel">Datum</span><input v-model="datum" type="date" class="bp-invoer" :min="vandaag" data-test="eigen-datum" @focus="eigenAan" @input="eigenAan"></label>
      <label class="bp-veld"><span class="bp-veldlabel">Van</span><input v-model="van" type="time" class="bp-invoer" data-test="eigen-van" @focus="eigenAan" @input="eigenAan"></label>
      <label class="bp-veld"><span class="bp-veldlabel">Tot</span><input v-model="tot" type="time" class="bp-invoer" data-test="eigen-tot" @focus="eigenAan" @input="eigenAan"></label>
    </div>
    <p v-if="eigenFout && (datum || van || tot)" class="bp-fout" role="alert">{{ eigenFout }}</p>

    <label class="bp-veld mt-12"><span class="bp-veldlabel">Plek</span><select v-model="plek" class="bp-invoer"><option v-for="p in PLEKKEN" :key="p">{{ p }}</option></select></label>

    <div class="bp-tel" data-test="rekenblok">
      <div class="bp-tel-rij"><span>Gesprekstijd</span><b class="tnum">{{ gesprekstijd }} min</b></div>
      <div class="bp-tel-rij"><span>Marge voor uitloop</span><b class="tnum">{{ marge(gesprekstijd) }} min</b></div>
      <div class="bp-tel-rij bp-tel-rij--som"><span>Blok</span><b class="tnum">{{ minuten || '?' }} min</b></div>
    </div>
    <p v-if="nietPast" class="bp-waarschuwing" data-test="past-niet">{{ nietPast }}</p>

    <div class="bp-vinken">
      <label class="bp-vink"><input v-model="bezet" type="checkbox"> <span>Zet mijn agenda op bezet</span></label>
      <p v-if="bezet && !agendaGekoppeld" class="bp-noot">Werkt zodra je agenda gekoppeld is.</p>
      <label class="bp-vink"><input v-model="stil" type="checkbox"> <span>Onderdruk meldingen tijdens het blok</span></label>
    </div>
    <button type="button" class="bp-knop" :disabled="!gekozen.length || !start || bezig" data-test="zet-in-agenda" @click="plan">{{ bezig ? 'Bezig…' : 'Zet in mijn agenda' }}</button>
    <p class="bp-voet">{{ gekozen.length === 1 ? 'De taak wordt' : `De ${gekozen.length} taken worden` }} aan het blok gekoppeld. Wat niet past schuift naar je volgende vaste blok. Afvinken doe je straks in het blok zelf.</p>
  </aside>
</template>

<style scoped>
.bp { background: var(--wit); border: 1px solid var(--yellow); border-left-width: 3px; padding: 20px; min-width: 0; }
.bp-kop { display: flex; align-items: baseline; gap: 12px; }
.bp-titel { font-family: var(--font-serif); font-size: 20px; font-weight: 700; margin: 0; margin-right: auto; }
.bp-link { display: inline-flex; align-items: center; gap: 4px; min-height: var(--touch-target-min); font-size: 13px; font-weight: 700; color: var(--ink); text-decoration: none; }
.bp-link:hover { text-decoration: underline; text-decoration-color: var(--yellow); text-decoration-thickness: 2px; }
.bp-sub { margin: 0 0 16px; font-size: 13px; color: var(--muted); }
.bp-label { margin: 16px 0 6px; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.bp-noot { margin: 0 0 6px; font-size: 12px; color: var(--muted); }
.bp-vakken { display: flex; flex-direction: column; gap: 6px; }
.bp-vak {
  position: relative; display: flex; flex-direction: column; gap: 1px; padding: 9px 12px; min-height: var(--touch-target-min);
  border: 1px solid var(--border-strong); background: var(--wit); cursor: pointer;
  transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
}
.bp-vak:hover { border-color: var(--ink); }
/* De radio ligt onzichtbaar over het hele vak: klikken werkt overal en het toetsenbord blijft werken. */
.bp-radio { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
.bp-vak:has(.bp-radio:focus-visible) { outline: 2px solid var(--ink); outline-offset: 2px; }
.bp-vak-titel { font-weight: 700; font-size: 13px; color: var(--ink); }
.bp-vak-sub { font-size: 11px; color: var(--muted); }
.bp-vak--aan { background: var(--ink); border-color: var(--ink); }
.bp-vak--aan .bp-vak-titel { color: var(--yellow); }
.bp-vak--aan .bp-vak-sub { color: rgba(255, 255, 255, 0.72); }
.bp-vink { display: flex; gap: 9px; align-items: flex-start; margin-top: 12px; font-size: 13px; line-height: 1.45; color: var(--ink); cursor: pointer; }
.bp-vink input { margin-top: 2px; width: 16px; height: 16px; flex-shrink: 0; accent-color: var(--ink); }
.bp-vink input:disabled + span { color: var(--muted); }
.bp-lunch { display: flex; align-items: center; gap: 8px; margin: 6px 0 0 25px; font-size: 12px; color: var(--muted); }
.bp-eigen { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr); gap: 6px; padding: 8px; border: 1px solid var(--border); transition: border-color var(--transition-fast); }
.bp-eigen--aan { border-color: var(--ink); }
.bp-veld { display: flex; flex-direction: column; min-width: 0; }
.bp-veldlabel { font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); margin-bottom: 4px; }
.bp-invoer { width: 100%; min-width: 0; min-height: var(--touch-target-min); padding: 8px 8px; border: 1px solid var(--border-strong); background: var(--surface); font: inherit; font-size: 13px; color: var(--ink); }
.bp-invoer--klein { width: auto; min-height: 36px; padding: 4px 8px; }
.bp-fout { margin: 6px 0 0; font-size: 12px; color: var(--red); }
.bp-tel { background: var(--surface); padding: 10px 12px; margin-top: 14px; }
.bp-tel-rij { display: flex; justify-content: space-between; font-size: 13px; padding: 2px 0; }
.bp-tel-rij--som { border-top: 1px solid var(--border-strong); margin-top: 5px; padding-top: 6px; font-weight: 700; }
.bp-waarschuwing { margin: 10px 0 0; padding: 10px 12px; background: rgba(217, 119, 6, 0.1); border-left: 3px solid var(--yellow); font-size: 12px; line-height: 1.45; color: var(--ink); }
.bp-vinken { margin-top: 4px; }
.bp-vinken .bp-noot { margin: 2px 0 0 25px; }
.bp-knop {
  width: 100%; margin-top: 16px; padding: 12px; min-height: var(--touch-target-min); background: var(--ink); color: var(--yellow);
  border: 1px solid var(--ink); font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; transition: opacity var(--transition-fast);
}
.bp-knop:disabled { opacity: 0.45; cursor: not-allowed; }
.bp-voet { margin: 10px 0 0; font-size: 11px; line-height: 1.5; color: var(--muted); }
@media (max-width: 480px) {
  .bp { padding: 16px 12px; }
  .bp-eigen { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .bp-veld--datum { grid-column: 1 / -1; }
}
</style>
