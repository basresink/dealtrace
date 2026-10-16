<script setup lang="ts">
// Tabblad Jaarplanning (F13) in de opzet van DealDrive Prospectplanning: tellers, "Wat knelt er nu"
// met inplannen in belblokken en indelen, de jaarkalender (jaar of kwartaal) met legenda per
// potentie, het maanddetail met wat aan de beurt is en wat is blijven liggen, en de prospects
// buiten de planning. De rekenregels staan in shared/planning.ts; hier alleen de weergave.
import { telLink } from '~/utils/accountWeergave'
import { POTENTIES, POTENTIE_LABEL, maandInJaar, type Potentie } from '~~/shared/planning'
const toast = useToast()
const route = useRoute()
const router = useRouter()
const scope = computed(() => (route.query.scope === 'team' ? 'team' : 'mij'))
const { data, refresh } = await useFetch<any>('/api/planning/jaar', { query: computed(() => ({ scope: scope.value })), default: () => null })
const { data: inst } = await useFetch<any>('/api/settings', { default: () => ({}) })
const klassen = computed(() => ((inst.value?.klassen ?? []) as any[]).filter((k) => k.tabblad !== 'Klanten'))
const vandaag = new Date().toISOString().slice(0, 10)
const huidig = computed(() => (data.value ? Math.min(12, Math.max(1, maandInJaar(vandaag, data.value.jaar.start))) : 1))
const maandNaam = (m: number) => data.value?.stand.maanden.find((x: any) => x.maand === m)?.label ?? ''

// Groepen per potentie met hun venster (maand van en tot; klein is doorlopend).
const NOEMER: Record<Potentie, [string, string]> = { groot: ['grote prospect', 'grote prospects'], middel: ['middelgrote prospect', 'middelgrote prospects'], klein: ['kleine prospect', 'kleine prospects'] }
const VOLGORDE: Record<string, number> = { 'Nog niet benaderd': 0, Benaderd: 1, Gesproken: 2, Afspraak: 3 }
const benaderd = (a: any) => a.status !== 'Nog niet benaderd'
const groepen = computed(() => POTENTIES.map((p) => {
  const rijen = (data.value?.accounts ?? []).filter((a: any) => a.potentie === p)
    .sort((a: any, b: any) => VOLGORDE[a.status]! - VOLGORDE[b.status]! || a.naam.localeCompare(b.naam, 'nl'))
  const tot = p === 'klein' ? 12 : Number(data.value?.instelling?.vensters?.[p] ?? (p === 'groot' ? 2 : 5))
  const nB = rijen.filter(benaderd).length
  return { potentie: p, label: POTENTIE_LABEL[p], van: 1, tot, doorlopend: p === 'klein' || tot >= 12, rijen, totaal: rijen.length, benaderd: nB, open: rijen.length - nB, procent: rijen.length ? Math.round((nB / rijen.length) * 100) : 0 }
}))
type Groep = (typeof groepen.value)[number]
const hoofd = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
const vensterTekst = (g: Groep) => (g.doorlopend ? 'doorlopend' : g.van === g.tot ? maandNaam(g.tot) : `${maandNaam(g.van)} tot en met ${maandNaam(g.tot)}`)
const isActief = (g: Groep, m: number) => g.totaal > 0 && m >= g.van && m <= g.tot
const isTeLaat = (g: Groep, m: number) => !g.doorlopend && m > g.tot && g.open > 0

// Twaalf maanden: wat aan de beurt is, en wat daarvoor had gemoeten (te laat).
const maanden = computed(() => Array.from({ length: 12 }, (_, i) => {
  const nr = i + 1
  const actief = groepen.value.filter((g) => isActief(g, nr))
  const laat = groepen.value.filter((g) => isTeLaat(g, nr))
  return {
    nr, naam: maandNaam(nr), isHuidig: nr === huidig.value, voorbij: nr < huidig.value, actief,
    blokken: [...laat.map((g) => ({ key: `laat-${g.potentie}`, groep: g, teLaat: true })), ...actief.map((g) => ({ key: `nu-${g.potentie}`, groep: g, teLaat: false }))],
    totaal: actief.reduce((s, g) => s + g.totaal, 0), benaderd: actief.reduce((s, g) => s + g.benaderd, 0), achterstand: laat.reduce((s, g) => s + g.open, 0),
  }
}))
const maand = ref<number | null>(null)
const gekozen = computed(() => maand.value ?? huidig.value)
const detail = computed(() => maanden.value[gekozen.value - 1]!)
const detailTitel = computed(() => (detail.value.actief.length ? `Aan de beurt in ${detail.value.naam}` : detail.value.blokken.length ? `Blijven liggen in ${detail.value.naam}` : `Niets gepland in ${detail.value.naam}`))
const toonBenaderde = ref(false)
const benaderdInMaand = computed(() => detail.value.blokken.reduce((s, b) => s + b.groep.benaderd, 0))
const zichtbaar = (g: Groep) => (toonBenaderde.value ? g.rijen : g.rijen.filter((a: any) => !benaderd(a)))

// Jaar of kwartaal: het kwartaal volgt de gekozen maand.
const weergave = ref<'jaar' | 'kwartaal'>('jaar')
const kwartaal = computed(() => Math.ceil(gekozen.value / 3))
const kwartalen = computed(() => [1, 2, 3, 4].map((q) => {
  const ms = maanden.value.slice((q - 1) * 3, q * 3)
  const ps = new Set(ms.flatMap((m) => m.actief.map((g) => g.potentie)))
  const gs = groepen.value.filter((g) => ps.has(g.potentie))
  return { q, label: `Q${q}`, maanden: `${ms[0]!.naam} tot ${ms[2]!.naam}`, totaal: gs.reduce((s, g) => s + g.totaal, 0), benaderd: gs.reduce((s, g) => s + g.benaderd, 0), achterstand: Math.max(...ms.map((m) => m.achterstand)) }
}))
const zichtbareMaanden = computed(() => (weergave.value === 'jaar' ? maanden.value : maanden.value.slice((kwartaal.value - 1) * 3, kwartaal.value * 3)))
function kiesKwartaal(q: number) { maand.value = Math.ceil(huidig.value / 3) === q ? huidig.value : q * 3 - 2 }

// Tellers boven de planning.
const tellers = computed(() => {
  const ingedeeld = groepen.value.reduce((s, g) => s + g.totaal, 0)
  const nB = groepen.value.reduce((s, g) => s + g.benaderd, 0)
  const teLaat = groepen.value.filter((g) => isTeLaat(g, huidig.value)).reduce((s, g) => s + g.open, 0)
  return [
    { k: 'ingedeeld', label: 'Ingedeeld', waarde: `${ingedeeld}/${data.value?.stand.totaal ?? 0}` },
    { k: 'open', label: 'Nog niet benaderd', waarde: String(ingedeeld - nB) },
    { k: 'telaat', label: 'Te laat', waarde: String(teLaat), rood: teLaat > 0 },
    { k: 'benaderd', label: 'Benaderd', waarde: `${ingedeeld ? Math.round((nB / ingedeeld) * 100) : 0}%` },
  ]
})

// Wat knelt er nu (uit de server, met de tonen van DealDrive) en de acties.
const TOON: Record<string, string> = { urgent: 'urgent', letop: 'let-op', info: 'info', goed: 'goed' }
const teLaatIds = (p?: string) => (data.value?.accounts ?? []).filter((a: any) => (!p || a.potentie === p) && a.potentie && a.status === 'Nog niet benaderd' && a.venster && a.venster.tot < vandaag).map((a: any) => a.id)
const bevestig = ref<{ ids: string[]; tekst: string } | null>(null)
async function vraagInplannen(p?: string) {
  const ids = teLaatIds(p)
  try {
    const r = await $fetch<any>('/api/planning/inplannen', { method: 'POST', body: { accountIds: ids, doel: 'belblokken', proef: true } })
    bevestig.value = { ids, tekst: `${r.tekst}.${r.over ? ` ${r.over} passen niet in de komende weken.` : ''}${r.inRitme ? ` ${r.inRitme} staan al in een ritme en blijven daar.` : ''}` }
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function planIn() {
  const ids = bevestig.value!.ids
  bevestig.value = null
  try {
    const r = await $fetch<any>('/api/planning/inplannen', { method: 'POST', body: { accountIds: ids, doel: 'belblokken' } })
    toast.toon(r.ingepland ? `${r.ingepland} belpogingen ingepland.` : r.tekst, r.ingepland ? 'succes' : 'let-op')
    await refresh()
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function bekijk(p?: Potentie) {
  maand.value = huidig.value
  if (!import.meta.client) return
  await nextTick()
  const blok = detail.value.blokken.find((b) => b.groep.potentie === p)
  const doel = (blok && document.getElementById(`groep-${blok.key}`)) || document.getElementById('maand-detail')
  doel?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
const indelen = ref(false)
const zonderKlasse = computed(() => (data.value?.accounts ?? []).filter((a: any) => !a.potentie))
async function deelIn(a: any, klasse: string) {
  try { await $fetch(`/api/accounts/${a.id}`, { method: 'PUT', body: { klasse } }); toast.toon(`${a.naam} is ingedeeld.`); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const bezoek = ref<{ id: string; naam: string } | null>(null)
</script>

<template>
  <div v-if="data" data-test="tab-jaar">
    <div class="pj-rij">
      <span class="kicker kicker--streep" data-test="jaar-kicker">Verkoopjaar {{ data.jaar.jaar }} · {{ data.stand.ingedeeld }} van {{ data.stand.totaal }} prospects ingedeeld</span>
      <div v-if="data.kan.team" class="keuzegroep keuzegroep--klein" role="group" aria-label="Wie">
        <button type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': scope === 'mij' }" @click="router.replace({ query: { ...route.query, scope: undefined } })">Van mij</button>
        <button type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': scope === 'team' }" data-test="scope-team" @click="router.replace({ query: { ...route.query, scope: 'team' } })">Team</button>
      </div>
    </div>

    <LegeStaat v-if="!data.stand.totaal" class="mt-16" titel="Er zijn nog geen prospects met een klasse." tekst="Deel ze in om de jaarplanning te vullen." />
    <template v-else>
      <div class="pj-tellers mt-16" data-test="plan-tellers">
        <div v-for="t in tellers" :key="t.k" class="pj-teller" :class="{ 'pj-teller--rood': t.rood }" :data-test="`teller-${t.k}`"><span class="pj-teller-num tnum">{{ t.waarde }}</span><span class="pj-teller-label">{{ t.label }}</span></div>
      </div>

      <section class="pj-blok">
        <header class="pj-kop"><span class="pj-eyebrow">Het is {{ maandNaam(huidig) }}, maand {{ huidig }} van het verkoopjaar</span><h2 class="pj-titel">Wat knelt er nu</h2></header>
        <ul class="pj-sig" data-test="knelt">
          <li v-for="k in data.knelt" :key="k.titel" class="sig" :class="`sig--${TOON[k.niveau]}`" :data-niveau="k.niveau">
            <div class="sig-body">
              <span class="sig-kicker">{{ k.titel }}</span>
              <p class="sig-tekst">{{ k.tekst }}</p>
              <div v-if="k.actie?.soort === 'indelen' && indelen" class="pj-indelen" data-test="indelen">
                <div v-for="a in zonderKlasse" :key="a.id" class="pj-indeel-rij">
                  <span><strong>{{ a.naam }}</strong> <span class="meta">{{ a.plaats }}</span></span>
                  <select class="invoer invoer--klein pj-select" :aria-label="`Klasse voor ${a.naam}`" @change="deelIn(a, ($event.target as HTMLSelectElement).value)"><option value="">Kies klasse</option><option v-for="kl in klassen" :key="kl.id" :value="kl.id">{{ kl.naam }}</option></select>
                </div>
              </div>
            </div>
            <div v-if="k.actie" class="sig-acties">
              <button v-if="k.actie.soort === 'inplannen' && data.kan.inplannen" type="button" class="dd-act dd-act--primair" :data-test="`plan-${k.actie.potentie}`" @click="vraagInplannen(k.actie.potentie)">Plan {{ k.actie.aantal }} in belblokken</button>
              <button v-if="k.actie.soort === 'inplannen'" type="button" class="dd-act" @click="bekijk(k.actie.potentie)">Bekijk de lijst</button>
              <button v-if="k.actie.soort === 'indelen' && data.kan.indelen" type="button" class="dd-act" data-test="deel-in" :aria-expanded="indelen" @click="indelen = !indelen">Deel in</button>
            </div>
          </li>
        </ul>
      </section>

      <section class="pj-blok">
        <header class="pj-kop pj-kop--rij">
          <div>
            <span class="pj-eyebrow">Twaalf maanden · klik een maand voor de prospects</span>
            <h2 class="pj-titel">Jaarkalender {{ data.jaar.jaar }}</h2>
            <ul class="pj-legenda">
              <li v-for="g in groepen.filter((x) => x.totaal)" :key="g.potentie"><span class="groep-pil" :class="`groep-pil--${g.potentie}`">{{ g.label }}</span><span class="meta"><strong>{{ NOEMER[g.potentie][1] }}</strong> · {{ vensterTekst(g) }} <span class="tnum">({{ g.totaal }})</span></span></li>
            </ul>
          </div>
          <div class="keuzegroep keuzegroep--klein" role="group" aria-label="Weergave">
            <button type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': weergave === 'jaar' }" data-test="weergave-jaar" @click="weergave = 'jaar'">Jaar</button>
            <button type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': weergave === 'kwartaal' }" data-test="weergave-kwartaal" @click="weergave = 'kwartaal'">Kwartaal</button>
          </div>
        </header>
        <div v-if="weergave === 'kwartaal'" class="pj-kwartalen" data-test="kwartalen">
          <button v-for="q in kwartalen" :key="q.q" type="button" class="pj-kw" :class="{ 'pj-kw--aan': q.q === kwartaal }" :aria-pressed="q.q === kwartaal" :data-test="`kwartaal-${q.q}`" @click="kiesKwartaal(q.q)">
            <span class="pj-kw-naam">{{ q.label }} <span class="meta">{{ q.maanden }}</span></span>
            <span class="pj-kw-stat tnum">{{ q.benaderd }}/{{ q.totaal }} benaderd</span>
            <span v-if="q.achterstand" class="pj-laat tnum">{{ q.achterstand }} te laat</span>
          </button>
        </div>
        <div class="pj-maanden" :class="{ 'pj-maanden--kwartaal': weergave === 'kwartaal' }" data-test="kalender">
          <button v-for="m in zichtbareMaanden" :key="m.nr" type="button" class="maandtegel pj-maand" :class="{ 'pj-maand--nu': m.isHuidig, 'pj-maand--aan': m.nr === gekozen, 'pj-maand--voorbij': m.voorbij }" :aria-pressed="m.nr === gekozen" :data-maand="m.nr" @click="maand = m.nr">
            <span class="pj-maand-top"><span class="pj-maand-nr tnum">{{ m.nr }}</span><span class="pj-maand-naam">{{ m.naam }}</span><span v-if="m.isHuidig" class="pj-nu">Nu</span></span>
            <span class="pj-maand-pillen"><span v-for="g in m.actief" :key="g.potentie" class="groep-pil" :class="`groep-pil--${g.potentie}`">{{ g.label }}</span><span v-if="!m.actief.length" class="meta">Niets aan de beurt</span></span>
            <span v-if="m.totaal" class="pj-maand-stat"><span class="tnum">{{ m.benaderd }}/{{ m.totaal }}</span> benaderd</span>
            <span v-if="m.achterstand" class="pj-laat tnum">{{ m.achterstand }} te laat</span>
          </button>
        </div>
      </section>

      <section id="maand-detail" class="pj-blok pj-blok--vlak">
        <header class="pj-kop pj-kop--rij">
          <div><span class="pj-eyebrow">Maand {{ detail.nr }} van verkoopjaar {{ data.jaar.jaar }}<template v-if="detail.isHuidig"> · deze maand</template></span><h2 class="pj-titel" data-test="maand-titel">{{ detailTitel }}</h2></div>
          <button v-if="benaderdInMaand" type="button" class="filter-pil" :class="{ 'filter-pil--aan': toonBenaderde }" :aria-pressed="toonBenaderde" data-test="toon-benaderde" @click="toonBenaderde = !toonBenaderde">{{ toonBenaderde ? 'Verberg benaderde' : 'Toon ook benaderde' }} <span class="pil-teller">{{ benaderdInMaand }}</span></button>
        </header>
        <article v-for="b in detail.blokken" :id="`groep-${b.key}`" :key="b.key" class="pj-groep" :class="{ 'pj-groep--laat': b.teLaat }" :data-groep="b.groep.potentie">
          <header class="pj-groep-kop">
            <div class="pj-groep-intro">
              <span v-if="b.teLaat" class="groep-pil groep-pil--laat">Te laat</span><span v-else class="groep-pil" :class="`groep-pil--${b.groep.potentie}`">{{ b.groep.label }}</span>
              <h3 class="pj-groep-titel">{{ hoofd(NOEMER[b.groep.potentie][1]) }}</h3>
              <p class="pj-groep-regel">{{ b.teLaat ? `Het venster (${vensterTekst(b.groep)}) is voorbij en ${b.groep.open} van de ${b.groep.totaal} ${b.groep.open === 1 ? 'is' : 'zijn'} nog niet benaderd.` : b.groep.doorlopend ? 'Doorlopend: plan er wekelijks een paar tussendoor.' : `Benaderen in ${vensterTekst(b.groep)}.` }}</p>
            </div>
            <div class="pj-meter"><span class="pj-meter-num tnum">{{ b.groep.benaderd }}/{{ b.groep.totaal }}</span><span class="pj-meter-label">benaderd</span><span class="pj-meter-bar" aria-hidden="true"><span :class="{ 'pj-meter-vul--laat': b.teLaat }" :style="{ width: `${b.groep.procent}%` }" /></span></div>
          </header>
          <ul class="pj-rijen">
            <li v-for="a in zichtbaar(b.groep)" :key="a.id" class="pj-prospect plan-rij" :data-account="a.naam">
              <NuxtLink :to="`/accounts/${a.id}`" class="pj-naam">{{ a.naam }}<span class="pj-meta">{{ a.klasse ?? 'geen klasse' }} · {{ a.plaats ?? 'plaats onbekend' }}</span></NuxtLink>
              <span class="pj-status" :class="benaderd(a) ? 'pj-status--ja' : 'pj-status--nee'">{{ a.status }}</span>
              <span class="pj-contact tnum">{{ a.pogingen }} {{ a.pogingen === 1 ? 'contactmoment' : 'contactmomenten' }}</span>
              <span class="pj-acties">
                <a v-if="a.telefoon" class="dd-act" :href="telLink(a.telefoon)" data-test="bel"><Icoon naam="Phone" />Bel</a>
                <NuxtLink v-else class="dd-act" :to="`/accounts/${a.id}`" data-test="bel"><Icoon naam="Phone" />Bel</NuxtLink>
                <button type="button" class="dd-act" data-test="plan-bezoek" @click="bezoek = { id: a.id, naam: a.naam }">Plan bezoek</button>
              </span>
            </li>
          </ul>
          <p v-if="!zichtbaar(b.groep).length" class="pj-alles">Alle {{ b.groep.totaal }} zijn benaderd.</p>
        </article>
        <p v-if="!detail.blokken.length" class="pj-leeg">In {{ detail.naam }} staat geen prospectgroep gepland en is er niets blijven liggen.</p>
      </section>

      <section v-if="zonderKlasse.length" class="pj-blok">
        <div class="pj-buiten" data-test="buiten-planning">
          <span class="pj-eyebrow pj-eyebrow--oranje">Buiten de planning</span>
          <h3 class="pj-groep-titel">{{ zonderKlasse.length }} prospects zonder klasse</h3>
          <p class="pj-groep-regel">Zonder klasse is er geen potentie en dus geen maand waarin ze aan de beurt zijn. Deel ze hierboven in bij "Wat knelt er nu" of op de prospectkaart.</p>
          <ul class="pj-buiten-lijst"><li v-for="a in zonderKlasse" :key="a.id"><NuxtLink :to="`/accounts/${a.id}`">{{ a.naam }}<span v-if="a.plaats" class="meta"> · {{ a.plaats }}</span></NuxtLink></li></ul>
        </div>
      </section>
    </template>
    <BevestigVenster :open="!!bevestig" titel="Inplannen in belblokken?" :tekst="bevestig?.tekst ?? ''" bevestig="Plan in" @geannuleerd="bevestig = null" @bevestigd="planIn" />
    <NieuweTaakFlyout :open="!!bezoek" :account="bezoek" actiesoort="bezoek" @sluit="bezoek = null" @gemaakt="bezoek = null" />
  </div>
</template>

<style scoped>
.pj-rij { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.pj-blok { margin-top: 32px; }
.pj-blok--vlak { margin-left: calc(-1 * var(--pagina-marge)); margin-right: calc(-1 * var(--pagina-marge)); padding: 24px var(--pagina-marge); background: var(--surface); }
.pj-kop { margin-bottom: 16px; }
.pj-kop--rij { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 16px; }
.pj-eyebrow { font-size: var(--fs-label); font-weight: 700; letter-spacing: .18em; text-transform: uppercase; color: var(--muted); }
.pj-eyebrow--oranje { color: var(--orange-dark); }
.pj-titel { margin: 4px 0 0; font-family: var(--font-serif); font-size: var(--fs-venstertitel); font-weight: 700; color: var(--ink); }

/* Tellers */
.pj-tellers { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; padding: 16px 20px; background: var(--ink); color: var(--wit); }
@media (min-width: 720px) { .pj-tellers { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.pj-teller { display: flex; flex-direction: column; gap: 2px; padding-top: 6px; border-top: 1px solid var(--yellow); }
.pj-teller--rood { border-top-color: var(--red-light); }
.pj-teller-num { font-family: var(--font-serif); font-size: 24px; font-weight: 700; color: var(--wit); }
.pj-teller--rood .pj-teller-num { color: var(--red-light); }
.pj-teller-label { font-size: var(--fs-label); font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--wit-70); }

/* Wat knelt er nu */
.pj-sig { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.sig { display: flex; align-items: center; flex-wrap: wrap; gap: 12px 16px; padding: 14px 18px; background: var(--wit); border: 1px solid var(--border); border-left: 4px solid var(--border-strong); }
.sig--urgent { border-left-color: var(--red); }
.sig--let-op { border-left-color: var(--orange); }
.sig--info { border-left-color: var(--blue); }
.sig--goed { border-left-color: var(--green); }
.sig-body { flex: 1 1 320px; min-width: 0; }
.sig-kicker { display: block; font-size: var(--fs-label); font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.sig--urgent .sig-kicker { color: var(--red); }
.sig--let-op .sig-kicker { color: var(--orange-dark); }
.sig--goed .sig-kicker { color: var(--green); }
.sig-tekst { margin: 3px 0 0; font-size: var(--fs-body); line-height: 1.5; color: var(--ink); }
.sig-acties { display: flex; flex-wrap: wrap; gap: 6px; }
.pj-indelen { display: grid; gap: 6px; margin-top: 12px; }
.pj-indeel-rij { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; padding: 8px 10px; background: var(--surface); }
.pj-select { width: auto; }

/* Legenda en groeppillen */
.pj-legenda { list-style: none; margin: 12px 0 0; padding: 0; display: grid; gap: 4px; }
.pj-legenda li { display: flex; align-items: baseline; gap: 8px; }
.groep-pil { display: inline-block; padding: 2px 6px; background: var(--ink); color: var(--wit); font-size: var(--fs-label); font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.groep-pil--groot { background: var(--purple); }
.groep-pil--middel { background: var(--blue); }
.groep-pil--klein { background: var(--muted); }
.groep-pil--laat { background: var(--red); }

/* Kwartalen */
.pj-kwartalen { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-bottom: 12px; }
@media (min-width: 720px) { .pj-kwartalen { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.pj-kw { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; min-height: 48px; padding: 10px 12px; background: var(--wit); border: 1px solid var(--border-strong); border-radius: var(--radius); font: inherit; text-align: left; cursor: pointer; }
.pj-kw:hover { border-color: var(--ink); }
.pj-kw--aan { background: var(--ink); border-color: var(--ink); color: var(--yellow); }
.pj-kw--aan .meta, .pj-kw--aan .pj-kw-stat { color: var(--wit-70); }
.pj-kw-naam { font-weight: 800; }
.pj-kw-stat { font-size: var(--fs-meta); color: var(--muted); }

/* Jaarkalender */
.pj-maanden { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--kaart-gap); }
@media (min-width: 640px) { .pj-maanden { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (min-width: 900px) { .pj-maanden:not(.pj-maanden--kwartaal) { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
@media (min-width: 1100px) { .pj-maanden:not(.pj-maanden--kwartaal) { grid-template-columns: repeat(6, minmax(0, 1fr)); } }
.pj-maanden--kwartaal .pj-maand { min-height: 120px; }
.pj-maand { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; min-height: var(--touch-target-comfortable); padding: 12px; background: var(--wit); border: 1px solid var(--border); font: inherit; color: var(--ink); text-align: left; cursor: pointer; }
.pj-maand:hover { border-color: var(--border-strong); }
.pj-maand--voorbij { background: var(--surface); color: var(--muted); }
.pj-maand--aan { border: 2px solid var(--ink); padding: 11px; }
.pj-maand--nu { border-left: 4px solid var(--yellow); }
.pj-maand--nu.pj-maand--aan { padding-left: 9px; }
.pj-maand-top { display: flex; align-items: baseline; gap: 6px; width: 100%; }
.pj-maand-nr { font-family: var(--font-serif); font-size: 18px; font-weight: 700; line-height: 1; }
.pj-maand-naam { font-size: var(--fs-meta); font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.pj-nu { margin-left: auto; padding: 2px 5px; background: var(--yellow); color: var(--ink); font-size: var(--fs-label); font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
.pj-maand-pillen { display: flex; flex-wrap: wrap; gap: 4px; }
.pj-maand-stat { font-size: var(--fs-label); color: var(--muted); }
.pj-laat { padding: 2px 6px; background: var(--red); color: var(--wit); font-size: var(--fs-label); font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }

/* Maanddetail */
.pj-groep { margin-bottom: 16px; padding: 20px 24px; background: var(--wit); border: 1px solid var(--border); border-top: 3px solid var(--border-strong); }
.pj-groep--laat { border-top-color: var(--red); }
.pj-groep-kop { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px 24px; margin-bottom: 16px; }
.pj-groep-intro { flex: 1 1 280px; }
.pj-groep-titel { margin: 6px 0 4px; font-family: var(--font-serif); font-size: 20px; font-weight: 700; }
.pj-groep-regel { margin: 0; max-width: 560px; font-size: var(--fs-meta); line-height: 1.5; color: var(--muted); }
.pj-meter { min-width: 150px; }
.pj-meter-num { font-family: var(--font-serif); font-size: 24px; font-weight: 700; }
.pj-meter-label { margin-left: 6px; font-size: var(--fs-label); font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.pj-meter-bar { display: block; height: 6px; margin-top: 6px; background: var(--surface); border: 1px solid var(--border); }
.pj-meter-bar span { display: block; height: 100%; background: var(--green); }
.pj-meter-bar .pj-meter-vul--laat { background: var(--orange); }
.pj-rijen { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--border); }
.pj-prospect { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 12px; padding: 10px 0; border-bottom: 1px solid var(--border); }
.pj-naam { flex: 1 1 240px; display: flex; flex-direction: column; justify-content: center; min-height: var(--touch-target-min); font-size: var(--fs-body); font-weight: 700; color: var(--ink); text-decoration: none; }
.pj-naam:hover { text-decoration: underline; text-underline-offset: 3px; }
.pj-meta { margin-top: 2px; font-size: var(--fs-label); font-weight: 400; color: var(--muted); }
.pj-status { padding: 3px 8px; border: 1px solid var(--border-strong); font-size: var(--fs-label); font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.pj-status--ja { background: var(--green); border-color: var(--green); color: var(--wit); }
.pj-status--nee { background: var(--surface); color: var(--ink-soft); }
.pj-contact { min-width: 120px; font-size: var(--fs-label); color: var(--muted); }
.pj-acties { display: flex; gap: 6px; }
.pj-alles, .pj-leeg { margin: 12px 0 0; font-size: var(--fs-meta); font-style: italic; color: var(--muted); }
.pj-leeg { padding: 28px; background: var(--wit); border: 1px dashed var(--border-strong); text-align: center; }

/* Buiten de planning */
.pj-buiten { padding: 20px 24px; background: var(--wit); border: 1px dashed var(--border-strong); }
.pj-buiten-lijst { list-style: none; margin: 14px 0 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 6px; }
.pj-buiten-lijst a { display: block; padding: 13px 10px; background: var(--surface); font-size: var(--fs-klein); color: var(--ink); text-decoration: none; }
.pj-buiten-lijst a:hover { background: var(--ink); color: var(--yellow); }

@media (max-width: 720px) {
  .pj-blok--vlak { margin-left: -16px; margin-right: -16px; padding: 20px 16px; }
  .keuzegroep-knop { min-height: 44px; }
  .pj-groep { padding: 16px; }
  .pj-acties { width: 100%; }
  .pj-acties .dd-act { flex: 1 1 0; min-height: 44px; justify-content: center; }
  .sig-acties .dd-act { min-height: 44px; }
}
</style>
