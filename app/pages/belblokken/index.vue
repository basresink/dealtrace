<script setup lang="ts">
// Belblokken (F07): links de bellijst (Top 5, 10, 15 of zelf kiezen; zelfde rangorde als
// belmodus en vuller), rechts het blok plannen, daaronder de geplande en de vaste blokken.
import { blokduur, BLOK_SOORTEN, marge, PLEKKEN, SOORT_LABEL, soortLabel, blokMoment, type VastBlok } from '~~/shared/belblokken'
const { functie } = useMe()
const aan = !!functie('belblok.uitvoeren')?.beschikbaar
const toast = useToast()
const { toon: toonUitleg } = useNietAangezet()
const { data, refresh } = await useFetch<any>('/api/belblokken', { immediate: aan, default: () => ({ bellijst: [], blokken: [], gepland: [], advies: [], kan: { top: [5] }, voorkeuren: { lunch: { start: '12:00', minuten: 45 } }, agenda: {} }) })
const top = ref<number | 'zelf'>(5)
const zelf = ref<Set<string>>(new Set())
const lijst = computed(() => (top.value === 'zelf' ? data.value.bellijst : data.value.bellijst.slice(0, top.value)))
const gekozen = computed(() => (top.value === 'zelf' ? data.value.bellijst.filter((k: any) => zelf.value.has(k.accountId)) : lijst.value).filter((k: any) => !k.belblokId))
function kies(id: string) { const n = new Set(zelf.value); n.has(id) ? n.delete(id) : n.add(id); zelf.value = n }

// Planpaneel
const moment = ref<string>('')
const eigenDatum = ref('')
const plek = ref<string>('Kantoor')
const bezet = ref(true)
const stil = ref(true)
const gesprekstijd = computed(() => gekozen.value.reduce((s: number, k: any) => s + k.duur, 0))
const minuten = computed(() => blokduur(gesprekstijd.value))
watch(() => data.value.advies, (a) => { if (!moment.value && a?.[0]) moment.value = a[0].start }, { immediate: true })
const start = computed(() => (moment.value === 'eigen' ? (eigenDatum.value ? new Date(eigenDatum.value).toISOString() : '') : moment.value))
const bezig = ref(false)
async function plan() {
  if (!start.value || !gekozen.value.length) return
  bezig.value = true
  try {
    const r = await $fetch<any>('/api/belblokken/plan', { method: 'POST', body: { start: start.value, minuten: minuten.value, plek: plek.value, soort: 'gemengd', accountIds: gekozen.value.map((k: any) => k.accountId), bezet: bezet.value, stil: stil.value } })
    toast.toon(r.toast)
    if (r.agenda && !r.agenda.ok) toast.toon(`Agenda op bezet: ${r.agenda.reden}.`, 'let-op')
    zelf.value = new Set()
    await refresh()
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
const nu = Date.now()
const volgende = computed(() => data.value.gepland.find((s: any) => s.open > 0 && Date.parse(s.eind) > nu))
const tijd = (iso: string) => new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(new Date(iso))

// Vaste blokken
const blokken = ref<VastBlok[]>([])
watch(() => data.value.blokken, (b) => { blokken.value = JSON.parse(JSON.stringify((b ?? []).map(({ moment, soortLabel, ...x }: any) => x))) }, { immediate: true })
const status = ref('')
let timer: any
function bewaarBlokken() {
  status.value = 'Opslaan…'
  clearTimeout(timer)
  timer = setTimeout(async () => {
    try { await $fetch('/api/mij/belblokken', { method: 'PUT', body: { blokken: blokken.value, voorkeuren: data.value.voorkeuren } }); status.value = 'Opgeslagen'; await refresh() } catch (e) { status.value = 'Opslaan mislukt'; toast.toon(foutTekst(e), 'fout') }
  }, 600)
}
function nieuwBlok() { blokken.value.push({ id: `vb-${Date.now()}`, dagen: [2], start: '10:00', minuten: 60, plek: 'Kantoor', soort: 'koud', automatisch: false }); bewaarBlokken() }
function verwijder(i: number) { blokken.value.splice(i, 1); bewaarBlokken() }
function wisselDag(b: VastBlok, d: number) { b.dagen = b.dagen.includes(d) ? b.dagen.filter((x) => x !== d) : [...b.dagen, d].sort(); if (b.dagen.length) bewaarBlokken() }
const DAGEN = ['ma', 'di', 'wo', 'do', 'vr']
useHead({ title: 'Belblokken · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="belblok.uitvoeren" />
    <template v-else>
      <PaginaKop kicker="Werk · Bellen" titel="Een blok is een blok. Wie het vult, kies jij." :uitleg="volgende ? `Volgende blok ${tijd(volgende.start)} · ${volgende.open} gesprekken` : 'Plan een blok vanuit je bellijst.'" helpartikel="belblokken">
        <template #acties>
          <span v-if="status" class="meta" role="status">{{ status }}</span>
          <NuxtLink v-if="volgende" :to="`/belblokken/${volgende.id}`" class="dd-actie dd-actie--primair" data-test="start-belblok"><Icoon naam="Phone" class="dd-actie-icoon" />Start belblok</NuxtLink>
        </template>
      </PaginaKop>
      <section class="section">
        <div class="container">
          <div class="raster raster--2">
            <div>
              <div class="kop-rij">
                <h2 class="kop-blok" data-test="bellijst-kop">{{ data.kop }}</h2>
                <div class="keuzegroep keuzegroep--klein" role="group" aria-label="Lengte bellijst">
                  <button v-for="n in [5, 10, 15]" :key="n" type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': top === n, 'knop-slot': !data.kan.top.includes(n) }" :aria-pressed="top === n" :data-test="`top-${n}`"
                    @click="data.kan.top.includes(n) ? (top = n) : toonUitleg('belblok.plannen')"><Icoon v-if="!data.kan.top.includes(n)" naam="Lock" :grootte="14" /> Top {{ n }}</button>
                  <button type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': top === 'zelf' }" :aria-pressed="top === 'zelf'" data-test="zelf-kiezen" @click="top = 'zelf'">Zelf kiezen</button>
                </div>
              </div>
              <LegeStaat v-if="!data.bellijst.length" titel="Er staat niemand op je bellijst." tekst="De motor zet nieuwe belpogingen klaar zodra ze aan de beurt zijn." />
              <div v-else class="lijst" data-test="bellijst">
                <div v-for="(k, i) in lijst" :key="k.accountId" class="rij rij--compact" :data-test="`bel-${k.accountId}`">
                  <label v-if="top === 'zelf'" class="vink"><input type="checkbox" :checked="zelf.has(k.accountId)" :aria-label="`Kies ${k.accountNaam}`" @change="kies(k.accountId)"></label>
                  <span v-else class="cijfer">{{ Number(i) + 1 }}</span>
                  <div class="rij-info">
                    <h3 class="rij-titel"><NuxtLink :to="`/accounts/${k.accountId}`">{{ k.accountNaam }}</NuxtLink> <span class="pil" :class="k.pil === 'Urgent' ? 'pil--rood' : k.pil === 'Kans' ? 'pil--paars' : ''">{{ k.pil }}</span><span v-if="k.belblokId" class="pil pil--leeg">in een blok</span></h3>
                    <div class="rij-sub">{{ k.contactNaam ?? 'geen contact' }} · {{ k.reden }} · {{ k.duur }} min</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="kaart kaart--geel" data-test="planpaneel">
              <h2 class="kop-blok">Belblok plannen</h2>
              <p class="bloklabel mt-16">Advies uit je agenda<template v-if="!data.agenda.gekoppeld"> · alleen je eigen blokken, je agenda is nog niet gekoppeld</template></p>
              <div class="stapel mt-8">
                <label v-for="a in data.advies" :key="a.start" class="vink"><input v-model="moment" type="radio" name="moment" :value="a.start"> {{ a.label }}</label>
                <label class="vink"><input v-model="moment" type="radio" name="moment" value="eigen"> Eigen moment</label>
                <input v-if="moment === 'eigen'" v-model="eigenDatum" type="datetime-local" class="invoer" aria-label="Eigen moment">
              </div>
              <div class="formulier-raster mt-16">
                <label class="veld"><span class="veld-label">Plek</span><select v-model="plek" class="invoer"><option v-for="p in PLEKKEN" :key="p">{{ p }}</option></select></label>
                <label class="veld"><span class="veld-label">Niet tijdens de lunch</span><input v-model="data.voorkeuren.lunch.start" class="invoer" type="time" :disabled="!data.kan.plannen"></label>
              </div>
              <div class="stuurstrip mt-16" data-test="rekenblok">
                <div><span class="bloklabel">Gesprekstijd</span><br><span class="tnum">{{ gesprekstijd }} min</span></div>
                <div><span class="bloklabel">Marge</span><br><span class="tnum">{{ marge(gesprekstijd) }} min</span></div>
                <div><span class="bloklabel">Blok</span><br><span class="tnum">{{ minuten }} min</span></div>
              </div>
              <p class="meta mt-8">{{ gekozen.length }} {{ gekozen.length === 1 ? 'gesprek' : 'gesprekken' }}. Wat niet past, schuift naar je volgende vaste blok.</p>
              <div class="stapel mt-12">
                <label class="vink"><input v-model="bezet" type="checkbox"> Zet mijn agenda op bezet</label>
                <p v-if="bezet && !data.agenda.gekoppeld" class="meta">Werkt zodra je agenda gekoppeld is.</p>
                <label class="vink"><input v-model="stil" type="checkbox"> Onderdruk meldingen tijdens het blok</label>
              </div>
              <button type="button" class="dd-actie dd-actie--taak mt-16" :disabled="!gekozen.length || !start || bezig" data-test="zet-in-agenda" @click="plan">Zet in mijn agenda</button>
            </div>
          </div>
        </div>
      </section>
      <section v-if="data.gepland.length" class="section">
        <div class="container">
          <h2 class="kop-blok">Geplande blokken</h2>
          <div class="lijst mt-8" data-test="gepland">
            <div v-for="s in data.gepland" :key="s.id" class="rij rij--compact">
              <div class="rij-info"><h3 class="rij-titel">{{ tijd(s.start) }}</h3><div class="rij-sub">{{ s.open }} van {{ s.gesprekken }} gesprekken open · {{ s.plek ?? 'Kantoor' }}{{ s.status === 'bezig' ? ' · loopt' : '' }}</div></div>
              <NuxtLink :to="`/belblokken/${s.id}`" class="dd-act dd-act--vast" :data-test="`open-blok-${s.id}`">{{ s.status === 'bezig' ? 'Verder bellen' : 'Start' }}</NuxtLink>
            </div>
          </div>
        </div>
      </section>
      <section class="section section--alt section--laatste">
        <div class="container">
          <div class="kop-rij"><h2 class="kop-blok">Vaste belblokken</h2>
            <button v-if="data.kan.plannen" type="button" class="dd-actie dd-actie--secundair" data-test="nieuw-vast-blok" @click="nieuwBlok"><Icoon naam="Plus" class="dd-actie-icoon" />Vast blok</button></div>
          <div class="raster raster--2" data-test="vaste-blokken">
            <article v-for="(b, i) in blokken" :key="b.id" class="kaart">
              <header class="kaart-kop"><h3 class="kaart-titel">{{ blokMoment(b) }}</h3><span class="pil pil--zwart">{{ soortLabel(b) }}</span></header>
              <template v-if="data.kan.plannen">
                <div class="rijtje mt-8"><button v-for="(d, j) in DAGEN" :key="d" type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': b.dagen.includes(j + 1) }" @click="wisselDag(b, j + 1)">{{ d }}</button></div>
                <div class="formulier-raster mt-8">
                  <label class="veld"><span class="veld-label">Begin</span><input v-model="b.start" type="time" class="invoer" @change="bewaarBlokken"></label>
                  <label class="veld"><span class="veld-label">Minuten</span><input v-model.number="b.minuten" type="number" min="30" max="240" step="15" class="invoer" @change="bewaarBlokken"></label>
                  <label class="veld"><span class="veld-label">Soort</span><select v-model="b.soort" class="invoer" @change="bewaarBlokken"><option v-for="s in BLOK_SOORTEN" :key="s" :value="s">{{ SOORT_LABEL[s] }}</option></select></label>
                  <label class="veld"><span class="veld-label">Plek</span><select v-model="b.plek" class="invoer" @change="bewaarBlokken"><option v-for="p in PLEKKEN" :key="p">{{ p }}</option></select></label>
                  <label v-if="b.soort === 'gemengd' && data.kan.automatisch" class="veld"><span class="veld-label">Koud (procent)</span><input v-model.number="b.verhouding" type="number" min="0" max="100" step="10" class="invoer" @change="bewaarBlokken"></label>
                </div>
              </template>
              <div v-else class="kaart-meta"><span>{{ b.plek }}</span></div>
              <div class="rijtje mt-12">
                <Schakelaar v-if="data.kan.automatisch" :aan="b.automatisch" label="Vult zichzelf" @wissel="b.automatisch = $event; bewaarBlokken()" />
                <button v-else type="button" class="dd-act knop-slot" @click="toonUitleg('belblok.automatisch')"><Icoon naam="Lock" :grootte="14" /> Vult zichzelf</button>
                <span class="meta">{{ b.automatisch ? 'Vult zichzelf' : 'Ik vul zelf' }}</span>
                <button v-if="data.kan.plannen" type="button" class="dd-act dd-act--gevaar" @click="verwijder(Number(i))">Verwijderen</button>
              </div>
            </article>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
