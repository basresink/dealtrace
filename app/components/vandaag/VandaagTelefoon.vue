<script setup lang="ts">
// Vandaag op de telefoon (P32, 8.5.1): groet en "Lees voor", focuskaart, signaal, tip, telstrip en
// stapels met de handeling in de regel; na 16:00 de recap bovenaan. Alles komt uit dezelfde
// rekenkern als de laptop (shared/dag, dagritme, signalen, recap); hier wordt niets berekend
// behalve de voorleestekst uit diezelfde uitkomst.
import { plusDagen, volgendeWerkdag } from '~~/shared/datum'
import { spreekDag } from '~~/shared/spreek'
const props = defineProps<{ t: any; kan: { voorlezen?: boolean; week?: boolean } }>()
const emit = defineEmits<{ open: [taakId: string]; ververs: [] }>()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { rondAf } = useAfronden()
const { voegToe } = useSyncQueue()

const d = computed(() => props.t.dag)
const vandaag = computed(() => props.t.dag.isVandaag ? props.t.dag.dag : null)
const datumKort = (iso: string) => new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`))
const STAPEL: Record<string, string> = { afspraken: 'Afspraken', bellen: 'Bellen', acties: 'Acties', eersteAfspraken: 'Eerste afspraken' }

// Dagkiezer en vegen op de groet.
const echteVandaag = computed(() => (route.query.dag ? null : props.t.dag.dag))
function naarDag(dag: string | null) { router.replace({ query: { ...route.query, dag: dag ?? undefined } }) }
const basis = computed(() => echteVandaag.value ?? (route.query.dag as string))
const morgen = computed(() => plusDagen(props.t.vandaag ?? basis.value, 1))
const week = computed(() => { const l = [morgen.value]; while (l.length < 4) l.push(volgendeWerkdag(l.at(-1)!)); return l.slice(1) })
let veegStart = 0
function veeg(e: TouchEvent, start: boolean) {
  const x = e.changedTouches[0]?.clientX ?? 0
  if (start) { veegStart = x; return }
  const dx = x - veegStart
  if (Math.abs(dx) < 60) return
  naarDag(dx < 0 ? plusDagen(d.value.dag, 1) : (plusDagen(d.value.dag, -1) === props.t.vandaag ? null : plusDagen(d.value.dag, -1)))
}

// Voorlezen met de spraaksynthese van het toestel (nl-NL).
const spreekt = ref(false)
function leesVoor() {
  if (!import.meta.client || !('speechSynthesis' in window)) { toast.toon('Voorlezen werkt niet in deze browser.', 'fout'); return }
  if (spreekt.value) { window.speechSynthesis.cancel(); spreekt.value = false; return }
  const u = new SpeechSynthesisUtterance(spreekDag(d.value, props.t.focus, props.t.groet, { signaal: props.t.signaal, recap: props.t.recap }))
  u.lang = 'nl-NL'
  u.onend = () => { spreekt.value = false }
  spreekt.value = true
  window.speechSynthesis.speak(u)
}
onBeforeUnmount(() => { if (import.meta.client && spreekt.value) window.speechSynthesis.cancel() })

// Signaal: Gedaan, Later, Weg (online direct, offline via de wachtrij).
const weg = ref<string | null>(null)
async function besluit(b: 'gedaan' | 'later' | 'weg') {
  const s = props.t.signaal
  weg.value = s.sleutel
  const tekst = b === 'later' ? 'Signaal op later gezet.' : b === 'weg' ? 'Signaal weggezet voor vandaag.' : 'Signaal gedaan.'
  try {
    if (import.meta.client && !navigator.onLine) {
      await voegToe({ tabel: 'signaal_besluiten', op: 'patch', recordId: s.sleutel, patch: { soort: 'signaal.besluit', besluit: b, op: new Date().toISOString() } })
      toast.toon(`${tekst} Wordt verstuurd zodra je verbinding hebt.`)
      return
    }
    const r: any = await $fetch('/api/vandaag/signaal', { method: 'POST', body: { signaalSleutel: s.sleutel, besluit: b } })
    toast.toon(b === 'later' ? `${tekst} Komt terug op ${r.stilTot}.` : tekst)
    emit('ververs')
  } catch (e) { weg.value = null; toast.toon(foutTekst(e), 'fout') }
}

async function afgehandeld(r: any) {
  // Een afspraak uit de agenda (P13) rond je af in de afspraakflyout.
  if (String(r.taakId ?? '').startsWith('afspraak:')) { emit('open', r.taakId); return }
  if (r.contactTaak) { emit('open', r.taakId); return }
  if (await rondAf(r.taakId, { uitkomst: 'gedaan' }, { mobiel: true })) emit('ververs')
}
async function bevestig(r: any) { if (r.taakId && await rondAf(r.taakId, { uitkomst: 'gedaan' }, { mobiel: true })) emit('ververs') }
function focusKnop() {
  const f = props.t.focus
  if (f.knop.soort === 'verslag' && f.verslagVan) emit('open', f.verslagVan)
  else if (f.knop.href?.startsWith('/')) navigateTo(f.knop.href)
}
function springNaar(stapel: string | null) {
  if (!stapel) return
  document.getElementById(`stapel-${stapel}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
const stapels = computed(() => d.value.volgorde.filter((k: string) => d.value.stapels[k].length))
</script>

<template>
  <div class="vt" data-test="vandaag-telefoon">
    <header class="vt-groet" data-test="vt-groet" @touchstart.passive="veeg($event, true)" @touchend.passive="veeg($event, false)">
      <p class="vt-groet-tekst"><strong>{{ d.isVandaag ? t.groet : `${datumKort(d.dag)}` }}</strong><span v-if="d.isVandaag" class="meta"> · {{ datumKort(d.dag) }}</span></p>
      <button v-if="kan.voorlezen && d.isVandaag" type="button" class="vt-icoonknop" :aria-pressed="spreekt" :aria-label="spreekt ? 'Stop voorlezen' : 'Lees voor'" data-test="vt-lees-voor" @click="leesVoor"><Icoon :naam="spreekt ? 'VolumeX' : 'Volume2'" /></button>
    </header>
    <nav class="vt-dagkiezer" aria-label="Dag kiezen" data-test="vt-dagkiezer">
      <button v-if="!d.isVandaag" type="button" class="vt-chip" @click="naarDag(null)">Vandaag</button>
      <button v-if="d.dag !== morgen" type="button" class="vt-chip" data-test="vt-morgen" @click="naarDag(morgen)">Morgen</button>
      <template v-if="kan.week"><button v-for="w in week" :key="w" type="button" class="vt-chip" :class="{ 'vt-chip--actief': w === d.dag }" @click="naarDag(w)">{{ datumKort(w) }}</button></template>
    </nav>

    <details v-if="t.recap" class="kaart vt-recap" data-test="vt-recap">
      <summary><span class="kicker">{{ t.recap.titel }}</span> <span class="vt-recap-kort">{{ [...t.recap.regels, ...t.recap.risicos].slice(0, 2).join(' · ') }}</span></summary>
      <ul class="vt-recap-lijst"><li v-for="r in t.recap.regels" :key="r">{{ r }}</li><li v-for="r in t.recap.risicos" :key="r" class="tekst-rood">{{ r }}</li><li v-if="t.recap.week">{{ t.recap.week }}</li></ul>
    </details>

    <article v-if="t.focus" class="kaart vt-focus" data-test="vt-focus">
      <span class="kicker">Je eerste zet</span>
      <h2 class="vt-focus-wat">{{ t.focus.wat }}</h2>
      <p class="vt-focus-waarom">{{ t.focus.waarom }}</p>
      <a v-if="t.focus.knop.href && !t.focus.knop.href.startsWith('/')" :href="t.focus.knop.href" class="dd-act dd-act--primair vt-knop" data-test="vt-focus-knop" :target="t.focus.knop.soort === 'navigeer' ? '_blank' : undefined" rel="noopener">{{ t.focus.knop.tekst }}</a>
      <button v-else type="button" class="dd-act dd-act--primair vt-knop" data-test="vt-focus-knop" @click="focusKnop">{{ t.focus.knop.tekst }}</button>
    </article>
    <div class="vt-telstrip" role="list" data-test="vt-telstrip">
      <button v-for="s in d.telstrip" :key="s.sleutel" type="button" role="listitem" class="vt-tegel" :class="{ 'vt-tegel--rood': s.achterstand }" :disabled="!s.stapel || !s.aantal" :data-test="`vt-tel-${s.sleutel}`" @click="springNaar(s.stapel)">
        <strong class="tnum">{{ s.aantal }}</strong><span>{{ s.label }}</span>
      </button>
    </div>

    <p v-if="t.tip" class="vt-tip" data-test="vt-tip">{{ t.tip }}</p>

    <article v-if="t.signaal && weg !== t.signaal.sleutel" class="kaart vt-signaal" data-test="vt-signaal">
      <span class="kicker">{{ t.signaal.bron }}</span>
      <p class="vt-signaal-titel"><NuxtLink v-if="t.signaal.link" :to="t.signaal.link">{{ t.signaal.titel }}</NuxtLink><template v-else>{{ t.signaal.titel }}</template></p>
      <p class="meta">{{ t.signaal.bewijs }}</p>
      <div class="vt-knoppen"><button type="button" class="dd-act" data-test="vt-gedaan" @click="besluit('gedaan')">Gedaan</button><button type="button" class="dd-act" data-test="vt-later" @click="besluit('later')">Later</button><button type="button" class="dd-act" data-test="vt-weg" @click="besluit('weg')">Weg</button></div>
    </article>


    <section v-for="k in stapels" :id="`stapel-${k}`" :key="k" class="vt-stapel" :data-test="`vt-stapel-${k}`">
      <h2 class="kicker kicker--streep">{{ STAPEL[k] }} <span class="tnum">{{ d.stapels[k].length }}</span></h2>
      <ul class="vt-regels">
        <li v-for="r in d.stapels[k]" :key="r.id" class="vt-regel" :class="{ 'vt-regel--achter': r.achterstallig || r.zonderVerslag }">
          <button type="button" class="vt-regel-tekst" @click="r.taakId ? emit('open', r.taakId) : r.accountId && navigateTo(`/accounts/${r.accountId}`)">
            <span class="meta tnum">{{ r.zonderVerslag ? 'verslag' : r.achterstallig ? 'over tijd' : r.tijd ?? '' }}</span>
            <strong>{{ r.accountNaam ?? r.titel }}</strong>
            <span v-if="r.accountNaam && r.soort !== 'eersteAfspraken'" class="meta">{{ r.titel }}</span>
          </button>
          <div class="vt-regel-acties">
            <template v-if="k === 'afspraken'">
              <a v-if="r.navigeer" :href="r.navigeer" target="_blank" rel="noopener" class="dd-act vt-knop" data-test="vt-navigeer">Navigeer</a>
              <button v-else type="button" class="dd-act vt-knop" disabled title="Geen adres bekend">Navigeer</button>
              <button v-if="r.zonderVerslag" type="button" class="dd-act dd-act--primair vt-knop" @click="emit('open', r.taakId)">Verslag</button>
            </template>
            <template v-else-if="k === 'bellen'">
              <a v-if="r.contact?.tel" :href="r.contact.tel" class="dd-act dd-act--primair vt-knop" data-test="vt-bel">{{ r.contact.naam && r.contact.naam !== r.accountNaam ? `Bel ${r.contact.naam.split(' ')[0]}` : 'Bel' }}</a>
              <button v-else type="button" class="dd-act vt-knop" disabled :title="r.contact?.reden ?? 'Geen telefoonnummer bekend'">Geen nummer</button>
              <button type="button" class="dd-act vt-knop" data-test="vt-uitkomst" @click="emit('open', r.taakId)">Uitkomst</button>
            </template>
            <template v-else-if="k === 'acties'">
              <a v-if="r.contactTaak && r.contact?.tel && r.actionType === 'bellen'" :href="r.contact.tel" class="dd-act vt-knop">Bel</a>
              <button type="button" class="dd-act vt-knop" data-test="vt-afgehandeld" @click="afgehandeld(r)">{{ r.contactTaak ? 'Uitkomst' : 'Afgehandeld' }}</button>
            </template>
            <template v-else>
              <button v-if="r.knop === 'bevestig'" type="button" class="dd-act dd-act--primair vt-knop" data-test="vt-bevestig" @click="bevestig(r)">Bevestig</button>
              <NuxtLink v-else :to="`/accounts/${r.accountId}`" class="dd-act vt-knop">Open</NuxtLink>
            </template>
          </div>
          <p v-if="k === 'bellen' && r.contact?.tel" class="meta vt-nummer">{{ r.contact.naam }}</p>
        </li>
      </ul>
    </section>
    <p v-if="!stapels.length && !d.isVandaag" class="meta mt-16">Niets gepland op deze dag.</p>
  </div>
</template>
