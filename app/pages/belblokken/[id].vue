<script setup lang="ts">
// De belmodus (F07): schermvullend. Links het script, midden de gesprekskaart, rechts de
// wachtrij. Elke uitkomst rondt af via rondTaakAf en opent direct het volgende gesprek (de
// hele wachtrij is vooraf geladen). Na het laatste gesprek of "Stop blok" het blokresultaat.
import { UITKOMST_KNOPPEN, uitkomstNaarCode, type KnopSleutel } from '~~/shared/belblokken'
import { herkenAntwoord, spreekBelOpening } from '~~/shared/spreek'
import { NEE_REDENEN } from '~~/shared/nbStatus'
import type { ScriptStaat } from '~~/shared/belscripts'
const route = useRoute()
const toast = useToast()
const { toon: toonUitleg } = useNietAangezet()
const id = route.params.id as string
const { data, error } = await useFetch<any>(() => `/api/belblokken/${id}`)
const items = ref<any[]>([])
watch(data, (d) => { if (d && !items.value.length) items.value = [...d.items] }, { immediate: true })
const index = ref(0)
const huidig = computed(() => items.value[index.value] ?? null)
const gedaan = ref<{ accountNaam: string; knop: KnopSleutel }[]>([])
const staat = ref<ScriptStaat | null>(null)
const notitie = ref('')
const gekozenKnop = ref<KnopSleutel | null>(null)
const laterOp = ref('')
const reden = ref('')
const gestart = ref(Date.now())
const resultaat = ref<any>(null)
const handsfree = ref(false)

onMounted(async () => {
  if (data.value?.sessie.status === 'klaar') { resultaat.value = data.value.sessie.resultaat; return }
  try { await $fetch(`/api/belblokken/${id}/start`, { method: 'POST' }) } catch (e) { toast.toon(foutTekst(e), 'fout') }
  gestart.value = Date.now()
})
const resterendMin = computed(() => (data.value ? Math.max(0, Math.round((Date.parse(data.value.sessie.eind) - Date.now()) / 60000)) : 0))
const morgen = new Date(Date.now() + 864e5).toISOString().slice(0, 10)

async function uitkomst(knop: KnopSleutel) {
  const v = uitkomstNaarCode(knop)!
  if ((v.vraagtDatum && !laterOp.value) || (v.vraagtReden && !reden.value)) { gekozenKnop.value = knop; return }
  const item = huidig.value
  if (!item) return
  const body = { taskId: item.taskId, knop, laterOp: v.vraagtDatum ? laterOp.value : null, reden: v.vraagtReden ? reden.value : null, duurSec: Math.round((Date.now() - gestart.value) / 1000), notitie: notitie.value || null, sleutel: crypto.randomUUID(), script: staat.value, vv: { winpuntId: item.winpuntId, concurrentId: item.concurrentId } }
  // Direct door naar het volgende gesprek; de server rondt op de achtergrond af.
  gedaan.value.push({ accountNaam: item.accountNaam, knop })
  volgende()
  try { await $fetch(`/api/belblokken/${id}/gesprek`, { method: 'POST', body }) } catch (e) { toast.toon(`${item.accountNaam}: ${foutTekst(e)}`, 'fout') }
  if (index.value >= items.value.length) await stop()
}
function volgende() {
  index.value++
  gekozenKnop.value = null; laterOp.value = ''; reden.value = ''; notitie.value = ''; gestart.value = Date.now()
  if (handsfree.value) leesVoor()
}
function overslaan() { if (index.value < items.value.length - 1) { items.value.push(items.value.splice(index.value, 1)[0]); gestart.value = Date.now() } }
async function stop() {
  try { resultaat.value = (await $fetch<any>(`/api/belblokken/${id}/stop`, { method: 'POST' })).resultaat } catch (e) { toast.toon(foutTekst(e), 'fout') }
  window.speechSynthesis?.cancel()
}
function leesVoor() {
  const i = huidig.value
  if (!i) return
  const opening = document.querySelector('[data-test="blok-opening"] p, [data-test="blok-poortwachter"] p')?.textContent ?? ''
  vl.lees(spreekBelOpening({ accountNaam: i.accountNaam, contactNaam: i.contactNaam, reden: i.reden, opening }))
}
// Handsfree (P31): na het gesprek (de app komt terug in beeld) vraagt Dealtrace "Hoe ging het?" en
// luistert vier seconden naar gesproken, niet bereikt of terugbellen.
const vl = useVoorlezen()
const opname = useOpname()
const luistert = ref(false)
let weg = false
function zichtbaarheid() {
  if (document.visibilityState === 'hidden') { weg = true; return }
  if (!weg || !handsfree.value || !huidig.value) return
  weg = false
  vl.lees('Hoe ging het? Zeg gesproken, niet bereikt of terugbellen.', () => void luister())
}
async function luister() {
  if (!opname.kan.value) return
  try { await opname.start() } catch { return }
  luistert.value = true
  await new Promise((ok) => setTimeout(ok, 4000))
  const idB = await opname.stop({ soort: 'belblok', id })
  luistert.value = false
  const t = idB ? await opname.tekstVan(idB) : { tekst: null }
  const a = herkenAntwoord(t.tekst)
  if (a === 'niet_bereikt') { vl.lees('Genoteerd: niet bereikt.'); await uitkomst('geen_gehoor') }
  else if (a === 'terugbellen') { gekozenKnop.value = 'later'; vl.lees('Wanneer bel je terug? Kies de datum.') }
  else if (a === 'gesproken') { vl.lees('Gesproken. Kies de uitkomst.'); toast.toon('Gesproken: kies de uitkomst.') }
  else vl.lees('Dat verstond ik niet. Kies de uitkomst op het scherm.')
}
onMounted(() => document.addEventListener('visibilitychange', zichtbaarheid))
onBeforeUnmount(() => document.removeEventListener('visibilitychange', zichtbaarheid))
function wisselHandsfree(aan: boolean) { handsfree.value = aan; if (aan) leesVoor(); else vl.stop() }
const LABEL: Record<string, string> = Object.fromEntries(UITKOMST_KNOPPEN.map((k) => [k.sleutel, k.label]))
const datum = (iso: string) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' }).format(new Date(iso))
const bandTelling = (b: Record<string, { ja: boolean }>) => Object.values(b ?? {}).filter((x) => x?.ja).length
useHead({ title: 'Belmodus · Dealtrace' })
</script>

<template>
  <div class="belmodus" role="dialog" aria-modal="true" aria-label="Belmodus" data-test="belmodus">
    <div class="belmodus-kop">
      <strong>Belmodus</strong>
      <span v-if="data">{{ new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(new Date(data.sessie.start)) }} · <span data-test="teller">gesprek {{ Math.min(index + 1, items.length) }} van {{ items.length }}</span> · nog {{ resterendMin }} min</span>
      <label v-if="data?.kan.handsfree" class="rijtje"><Schakelaar :aan="handsfree" label="Handsfree" @wissel="wisselHandsfree" /><span>Handsfree</span></label>
      <button v-else type="button" class="dd-act knop-slot" data-test="handsfree-slot" @click="toonUitleg('bellen.handsfree')"><Icoon naam="Lock" :grootte="14" /> Handsfree</button>
      <button v-if="!resultaat" type="button" class="dd-act" data-test="stop-blok" @click="stop">Stop blok</button>
      <NuxtLink to="/belblokken" class="dd-act" aria-label="Sluiten"><Icoon naam="X" class="dd-act-icoon" />Sluiten</NuxtLink>
    </div>
    <div v-if="error" class="belmodus-raster"><div><p>Dit belblok bestaat niet (meer).</p></div></div>
    <div v-else-if="resultaat" class="belmodus-raster belmodus-raster--resultaat">
      <article class="fo-blok fo-blok--accent" data-test="blokresultaat">
        <header class="fo-blok-kop"><h3 class="fo-blok-titel">Blokresultaat</h3></header>
        <p class="fo-tekst">{{ resultaat.gevoerd }} gesprekken gevoerd · {{ resultaat.bereikt }} bereikt · {{ resultaat.beslisserBereikt }} beslisser bereikt · {{ resultaat.afspraken }} {{ resultaat.afspraken === 1 ? 'afspraak' : 'afspraken' }} · {{ resultaat.terugbellen }} terugbellen · gemiddeld {{ Math.round(resultaat.gemiddeldeDuurSec / 60) }} min, geschat {{ Math.round(resultaat.geschatSec / 60) }} min.</p>
        <NuxtLink to="/belblokken" class="dd-act mt-8">Plan resterende in</NuxtLink>
      </article>
    </div>
    <template v-else-if="huidig">
      <div class="belmodus-raster">
        <div id="bm-script">
          <BelScript v-model:staat="staat" :scripts="data.scripts" :voorstel="huidig.voorstel" :waarden="huidig.waarden" :extra-bezwaren="huidig.extraBezwaren" :meldingen="huidig.meldingen" :account-id="huidig.accountId" :contact-id="huidig.contactId" :ai-aan="data.kan.ai" />
        </div>
        <div data-test="gesprekskaart">
          <span class="bloklabel">Gesprekskaart</span>
          <h2 class="kop-blok mt-4"><NuxtLink :to="`/accounts/${huidig.accountId}`" target="_blank">{{ huidig.kaart.account.naam }}</NuxtLink></h2>
          <p class="meta">{{ [huidig.kaart.account.plaats, huidig.kaart.account.fase, huidig.kaart.account.klasse ? `klasse ${huidig.kaart.account.klasse}` : null].filter(Boolean).join(' · ') }}</p>
          <p v-if="huidig.kaart.contact" class="tekst tekst--inkt mt-12"><strong>{{ huidig.kaart.contact.naam }}</strong>{{ huidig.kaart.contact.functie ? ` · ${huidig.kaart.contact.functie}` : '' }} · {{ huidig.kaart.contact.rol }}</p>
          <a v-if="huidig.telefoon" class="dd-actie dd-actie--primair mt-8" :href="`tel:${huidig.telefoon}`" data-test="bel-link"><Icoon naam="Phone" class="dd-actie-icoon" />Bel {{ huidig.telefoon }}</a>
          <p v-else class="meta mt-8">Geen telefoonnummer bekend.</p>
          <p class="rij-aanleiding mt-16" :class="{ 'rij-aanleiding--heet': huidig.heet }">{{ huidig.reden }}</p>
          <dl class="defs mt-12">
            <div class="def-rij"><dt>Laatste uitkomsten</dt><dd>{{ huidig.kaart.laatste.length ? huidig.kaart.laatste.map((l: any) => `${datum(l.op)} ${l.uitkomst}`).join(' · ') : 'nog geen' }}</dd></div>
            <div v-if="huidig.waarden['concurrent.naam']" class="def-rij"><dt>Huidige leverancier</dt><dd>{{ huidig.waarden['concurrent.naam'] }}</dd></div>
            <div class="def-rij"><dt>BAND</dt><dd>{{ bandTelling(huidig.kaart.account.band) }} van 4</dd></div>
            <div v-for="(w, k) in huidig.kaart.account.eigenVelden" :key="k" class="def-rij"><dt>{{ k }}</dt><dd>{{ w }} <span class="meta">eigen veld</span></dd></div>
          </dl>
          <label class="veld mt-16"><span class="veld-label">Notitie bij dit gesprek</span><textarea v-model="notitie" class="invoer" rows="3" placeholder="Wat moet je onthouden?" /></label>
        </div>
        <div>
          <span class="bloklabel">Wachtrij · nog {{ resterendMin }} min</span>
          <div class="mt-8" data-test="wachtrij">
            <div v-for="g in gedaan" :key="g.accountNaam" class="wachtrij-item meta">✓ {{ g.accountNaam }} · {{ LABEL[g.knop] }}</div>
            <div v-for="(w, i) in items.slice(index)" :key="w.taskId" class="wachtrij-item" :class="{ 'wachtrij-item--nu': i === 0 }">{{ index + Number(i) + 1 }} · {{ w.accountNaam }}</div>
          </div>
          <button type="button" class="dd-act mt-16" :disabled="index >= items.length - 1" @click="overslaan">Overslaan</button>
        </div>
      </div>
      <div class="belmodus-voet">
        <div v-if="gekozenKnop" class="rijtje mb-8" data-test="uitkomst-extra">
          <template v-if="uitkomstNaarCode(gekozenKnop)?.vraagtDatum"><label class="veld"><span class="veld-label">{{ LABEL[gekozenKnop] }}: wanneer?</span><input v-model="laterOp" type="date" :min="morgen" class="invoer" data-test="later-op"></label></template>
          <template v-if="uitkomstNaarCode(gekozenKnop)?.vraagtReden"><label class="veld"><span class="veld-label">Reden</span><select v-model="reden" class="invoer" data-test="nee-reden"><option value="" disabled>Kies een reden</option><option v-for="r in NEE_REDENEN" :key="r">{{ r }}</option></select></label></template>
          <button type="button" class="dd-act dd-act--primair" data-test="uitkomst-bevestig" @click="uitkomst(gekozenKnop)">Afronden</button>
          <button type="button" class="dd-act" @click="gekozenKnop = null">Annuleren</button>
        </div>
        <div class="uitkomstraster" data-test="uitkomsten">
          <button v-for="k in UITKOMST_KNOPPEN" :key="k.sleutel" type="button" class="uitkomst" :class="{ 'uitkomst--aan': gekozenKnop === k.sleutel }" :data-test="`uitkomst-${k.sleutel}`" @click="uitkomst(k.sleutel)">{{ k.label }}</button>
        </div>
      </div>
    </template>
    <div v-else class="belmodus-raster belmodus-raster--resultaat"><div><p>Er staan geen gesprekken meer in dit blok.</p><button type="button" class="dd-act mt-8" @click="stop">Toon het blokresultaat</button></div></div>
  </div>
</template>
