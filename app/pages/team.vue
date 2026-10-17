<script setup lang="ts">
// Team (P21, F20, 8.12) in de opzet van de app: controle in tien minuten. De kop zegt hoeveel
// accountmanagers op tempo liggen en wie het verst achter; vier klikbare cijfers (op tempo, afspraken,
// taken over tijd, concepten) tonen per persoon wat erachter zit en openen de records. Daaronder de
// aandachtspunten, de tabel met klikbare cellen, werkverdeling met Verplaats, goedkeuringen en het niveau
// per persoon. Filters (team en periode, standaard deze week) staan in de link. Op de telefoon drie
// stapels en per persoon één regel die de cijfers in een flyout opent.
import { NIVEAU_LABEL, NIVEAUS } from '~~/shared/types'
import { kortNaam, teamKop, teamLede } from '~~/shared/managerOverzicht'
import type { MfGroep } from '~/components/team/ManagerFilters.vue'
import type { FilterChip } from '~/components/team/FilterChips.vue'
import type { CijferRegel } from '~/components/team/CijferFlyout.vue'

const { functie } = useMe()
const aan = computed(() => !!functie('nav.team')?.beschikbaar)
const route = useRoute()
const router = useRouter()
const toast = useToast()
const scherm = useSchermklasse()
const q = (k: string) => (typeof route.query[k] === 'string' ? (route.query[k] as string) : '')
const STANDAARD_PERIODE = 'week'
const periode = computed(() => q('periode') || STANDAARD_PERIODE)
const query = computed(() => ({ team: q('team') || undefined, periode: periode.value }))
const { data, refresh } = await useFetch<any>('/api/team', { query, immediate: aan.value, default: () => ({ rijen: [], teams: [], aandachtspunten: [], werkverdeling: [], goedkeuringen: [], stapels: { zonderVerslag: [], nietOvergedragen: [], achterOpRitme: [] } }) })
function zet(p: Record<string, string | undefined>) { const n: Record<string, any> = { ...route.query, ...p }; for (const k of Object.keys(n)) if (!n[k]) delete n[k]; router.replace({ query: n }) }

// ── Filters ─────────────────────────────────────────────────────────────────
const PERIODES = [['vandaag', 'Vandaag'], ['week', 'Deze week'], ['maand', 'Deze maand'], ['kwartaal', 'Kwartaal']] as const
const groepen = computed<MfGroep[]>(() => [
  ...(data.value.teams.length > 1 ? [{ id: 'team', label: 'Team', opties: data.value.teams.map((t: any) => ({ k: t.id, l: t.naam, n: t.leden })) }] : []),
  { id: 'periode', label: 'Periode', opties: PERIODES.map(([k, l]) => ({ k, l })) },
])
const isAan = (g: string, k: string) => (g === 'team' ? data.value.team?.id === k : periode.value === k)
function zetFilter(g: string, k: string) { if (g === 'team') zet({ team: k === data.value.teams[0]?.id ? undefined : k }); else zet({ periode: k === STANDAARD_PERIODE ? undefined : k }) }
const chips = computed<FilterChip[]>(() => [
  ...(q('team') && data.value.team ? [{ sleutel: 'team', label: 'Team', tekst: data.value.team.naam, wis: () => zet({ team: undefined }) }] : []),
  ...(q('periode') ? [{ sleutel: 'periode', label: 'Periode', tekst: PERIODES.find(([k]) => k === periode.value)?.[1] ?? periode.value, wis: () => zet({ periode: undefined }) }] : []),
])
const wisAlles = () => zet({ team: undefined, periode: undefined })
const filtersOpen = ref(false)

// ── Tabel ───────────────────────────────────────────────────────────────────
// Sorteren op elke kolom; standaard achter op tempo eerst.
const sortering = ref<{ k: string; op: boolean }>({ k: 'tempo', op: true })
const waarde = (r: any, k: string) => (k === 'tempo' ? r.tempo.procent : k === 'naam' ? r.naam : k.startsWith('kpi.') ? r.kpi[k.slice(4)] : r[k])
const rijen = computed(() => [...data.value.rijen].sort((a: any, b: any) => { const x = waarde(a, sortering.value.k); const y = waarde(b, sortering.value.k); const c = typeof x === 'string' ? x.localeCompare(y) : (x ?? -1) - (y ?? -1); return sortering.value.op ? c : -c }))
function sorteer(k: string) { sortering.value = { k, op: sortering.value.k === k ? !sortering.value.op : k === 'tempo' } }
const KOLOMMEN: { k: string; label: string; cel: string }[] = [
  { k: 'afgerondProcent', label: 'Taken op de dag', cel: 'afgerondOpDag' }, { k: 'achterstallig', label: 'Achterstallig', cel: 'achterstallig' },
  { k: 'kpi.pogingen', label: 'Pogingen', cel: 'pogingen' }, { k: 'kpi.gesprekken', label: 'Gesprekken', cel: 'gesprekken' }, { k: 'kpi.beslisser', label: 'Beslisser', cel: 'beslisser' },
  { k: 'kpi.afspraken', label: 'Afspraken', cel: 'afspraken' }, { k: 'afsprakenGehouden', label: 'Gehouden', cel: 'afsprakenGehouden' }, { k: 'overgedragen', label: 'Overgedragen', cel: 'overgedragen' },
  { k: 'belblokkenGehouden', label: 'Belblokken', cel: 'belblokkenGehouden' }, { k: 'conceptenWachten', label: 'Concepten', cel: 'concepten' },
]
const tekstCel = (r: any, k: string) => (k === 'afgerondProcent' ? (r.afgerondProcent == null ? '-' : `${r.afgerondProcent}%`) : k === 'kpi.pogingen' ? `${r.kpi.pogingen} / ${r.tempo.norm}` : k === 'belblokkenGehouden' ? `${r.belblokkenGehouden} / ${r.belblokkenGepland}` : String(waarde(r, k) ?? 0))
const tempoLabel = (r: any) => (r.tempo.stand === 'geen' ? { waarde: 'op', tekst: 'Geen werkdag' } : r.tempo.stand === 'op schema' ? { waarde: 'op', tekst: `Op tempo ${r.tempo.procent}%` } : { waarde: 'achter', tekst: `Achter ${r.tempo.procent}%` })

// ── Wat er achter een getal zit ─────────────────────────────────────────────
const venster = ref<{ kicker: string; titel: string; meta?: string; regels: CijferRegel[]; leeg?: string } | null>(null)
async function openCel(r: any, metriek: string, label: string) {
  try {
    const x = await $fetch<any>('/api/team/cel', { query: { gebruiker: r.id, metriek, periode: periode.value, team: q('team') || undefined } })
    venster.value = { kicker: `${x.records.length} ${x.records.length === 1 ? 'record' : 'records'} · ${data.value.periode?.label ?? ''}`, titel: `${kortNaam(r.naam)}: ${label}`, regels: x.records.map((y: any) => ({ id: y.id, label: y.titel, meta: y.meta, link: y.link })), leeg: 'Geen records in deze periode.' }
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
function openPersoon(r: any) {
  venster.value = { kicker: `Cijfers · ${data.value.periode?.label ?? ''}`, titel: kortNaam(r.naam), meta: tempoLabel(r).tekst, regels: KOLOMMEN.map((k) => ({ id: k.k, label: k.label, waarde: tekstCel(r, k.k), klik: () => openCel(r, k.cel, k.label) })) }
}
const perPersoon = (metriek: string, label: string, getal: (r: any) => number, tekst?: (r: any) => string): CijferRegel[] =>
  [...data.value.rijen].sort((a: any, b: any) => getal(b) - getal(a)).map((r: any) => ({ id: r.id, label: kortNaam(r.naam), meta: `${NIVEAU_LABEL[r.niveau as 'beginner']} · ${r.werkplek}`, waarde: tekst ? tekst(r) : String(getal(r)), klik: () => openCel(r, metriek, label) }))
const tegels = computed(() => {
  const R = data.value.rijen as any[]
  const meetbaar = R.filter((r) => r.tempo.stand !== 'geen')
  const op = meetbaar.filter((r) => r.tempo.stand === 'op schema').length
  const som = (f: (r: any) => number) => R.reduce((s, r) => s + f(r), 0)
  const P = data.value.periode?.label?.toLowerCase() ?? ''
  return [
    { k: 'tempo', label: 'Op tempo', num: meetbaar.length ? `${op} van ${meetbaar.length}` : '-', voet: 'pogingen tegen de norm van de werkplek', rood: meetbaar.length > 0 && op < meetbaar.length,
      open: () => ({ kicker: `Tempo · ${P}`, titel: 'Pogingen tegen de norm', regels: [...R].sort((a, b) => a.tempo.procent - b.tempo.procent).map((r): CijferRegel => ({ id: r.id, label: kortNaam(r.naam), meta: `${r.kpi.pogingen} van ${r.tempo.norm} pogingen · ${r.werkplek}`, waarde: r.tempo.stand === 'geen' ? '-' : `${r.tempo.procent}%`, rood: r.tempo.stand === 'achter', klik: () => openCel(r, 'pogingen', 'Pogingen') })) }) },
    { k: 'afspraken', label: 'Afspraken gemaakt', num: som((r) => r.kpi.afspraken), voet: `uit ${som((r) => r.kpi.gesprekken)} gesprekken`, rood: false,
      open: () => ({ kicker: `Afspraken · ${P}`, titel: 'Afspraken per accountmanager', regels: perPersoon('afspraken', 'Afspraken', (r) => r.kpi.afspraken) }) },
    { k: 'achterstallig', label: 'Taken over tijd', num: som((r) => r.achterstallig), voet: 'open taken over hun vervaldag', rood: som((r) => r.achterstallig) > 0,
      open: () => ({ kicker: 'Nu', titel: 'Taken over tijd per accountmanager', regels: perPersoon('achterstallig', 'Achterstallig', (r) => r.achterstallig) }) },
    { k: 'concepten', label: 'Concepten wachten', num: som((r) => r.conceptenWachten), voet: 'van agents, nog niet beoordeeld', rood: false,
      open: () => ({ kicker: 'Nu', titel: 'Concepten die wachten', regels: perPersoon('concepten', 'Concepten', (r) => r.conceptenWachten) }) },
  ]
})

// ── Werkverdeling en Verplaats ──────────────────────────────────────────────
const verplaats = ref<{ van: string; fase: string; label?: string } | null>(null)
const naar = ref('')
const reden = ref('')
async function doeVerplaats() {
  try {
    const r = await $fetch<any>('/api/accounts/verplaats', { method: 'POST', body: { van: { gebruiker: verplaats.value!.van, fase: verplaats.value!.fase }, naarGebruiker: naar.value, reden: reden.value } })
    toast.toon(`${r.aantal} accounts verplaatst.`); verplaats.value = null; reden.value = ''; await refresh()
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
// Niveau per persoon (4.2): geen voorstellen, de salesmanager kiest.
const niveauVraag = ref<{ id: string; naam: string; van: string; naar: string } | null>(null)
async function zetNiveau(reden?: string) {
  const n = niveauVraag.value!
  try { await $fetch(`/api/gebruikers/${n.id}/niveau`, { method: 'POST', body: { niveau: n.naar, reden } }); toast.toon(`${n.naam} staat nu op ${NIVEAU_LABEL[n.naar as 'beginner'].toLowerCase()}.`); niveauVraag.value = null; await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
// P23: de wekelijkse bundel suggesties naar SalesDNA, als regel onder de goedkeuringen.
const suggestiesAan = computed(() => !!functie('salesdna.suggesties.vrijgeven')?.beschikbaar)
const { data: sg, refresh: verversSg } = await useFetch<any>('/api/salesdna/suggesties', { immediate: aan.value && suggestiesAan.value, default: () => null })
const sgOpen = computed({ get: () => route.query.suggesties === '1', set: (v: boolean) => zet({ suggesties: v ? '1' : undefined }) })
const sgRegel = computed(() => sg.value ? `Suggesties naar SalesDNA · week ${Number(String(sg.value.week).split('-W')[1])} · ${sg.value.open} ${sg.value.open === 1 ? 'suggestie' : 'suggesties'}` : null)

// ── Coachingsgesprek plannen ────────────────────────────────────────────────
const plan = ref(false)
const planLeden = computed(() => [...data.value.rijen].sort((a: any, b: any) => a.tempo.procent - b.tempo.procent).map((r: any) => ({ id: r.id, naam: r.naam, reden: r.tempo.stand === 'achter' ? `${tempoLabel(r).tekst} van de pogingennorm${r.achterstallig ? `, ${r.achterstallig} taken over tijd` : ''}.` : undefined })))
const STAPELS = [['zonderVerslag', 'Gesprekken zonder verslag'], ['nietOvergedragen', 'Eerste afspraken nog niet overgedragen'], ['achterOpRitme', 'Achter op het ritme']] as const
useHead({ title: 'Team · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="nav.team" />
    <template v-else>
      <PaginaKop :titel="data.team ? teamKop(data.rijen) : 'Team'" :uitleg="data.team ? teamLede(data.rijen) : undefined" helpartikel="team-controleren">
        <template #kicker><span class="kicker kicker--streep" data-test="team-kicker">{{ data.team ? `Team ${data.team.naam} · ${data.periode?.label ?? ''} · ${data.rijen.length} ${data.rijen.length === 1 ? 'accountmanager' : 'accountmanagers'}` : 'Team' }}</span></template>
        <template v-if="data.team" #acties>
          <button v-if="$aan('nav.coaching') && data.rijen.length" type="button" class="dd-actie dd-actie--primair" data-test="team-plan-coaching" @click="plan = true"><Icoon naam="CalendarCheck" class="dd-actie-icoon" />Plan gesprek</button>
          <button type="button" class="dd-actie dd-actie--secundair" :class="{ 'mp-filterknop--aan': filtersOpen || chips.length }" :aria-expanded="filtersOpen" data-test="team-filters" @click="filtersOpen = !filtersOpen">
            <Icoon naam="SlidersHorizontal" class="dd-actie-icoon" />Filters<span v-if="chips.length" class="mp-teller">{{ chips.length }}</span>
          </button>
        </template>
      </PaginaKop>

      <ManagerFilters v-if="filtersOpen && data.team" test="tf" :groepen="groepen" :aan="isAan" :blad="scherm === 'telefoon'" :wisbaar="chips.length > 0" :toon="`Toon ${data.team.naam}`" @zet="zetFilter" @wis="wisAlles" @sluit="filtersOpen = false" />

      <section class="section section--laatste">
        <div class="container">
          <LegeStaat v-if="!data.team" kicker="Nog geen team" titel="Je bent nog geen eigenaar van een team." tekst="Hier zie je straks per accountmanager het tempo, de afspraken en wat er blijft liggen. Vraag je beheerder om je als salesmanager aan een team te koppelen." data-test="team-leeg" />
          <LegeStaat v-else-if="!data.rijen.length" kicker="Leeg team" :titel="`Er zit nog niemand in ${data.team.naam}.`" tekst="Zodra er accountmanagers in dit team zitten, zie je hier hun cijfers." />
          <template v-else>
            <FilterChips v-if="chips.length" test="team" :aantal="data.rijen.length" een="accountmanager" meer="accountmanagers" :chips="chips" class="mb-16" @wis="wisAlles" />
            <div class="stat-grid stat-grid--4" data-test="team-cijfers">
              <button v-for="t in tegels" :key="t.k" type="button" class="stat-card" :data-test="`team-cijfer-${t.k}`" @click="venster = t.open()">
                <span class="stat-label">{{ t.label }}</span><span class="stat-num tnum" :class="{ 'tekst-rood': t.rood }">{{ t.num }}</span><span class="stat-foot">{{ t.voet }}</span>
              </button>
            </div>

            <div class="mp-blok" data-test="aandachtspunten">
              <header class="mp-blokkop"><h2 class="mp-bloktitel">Wat valt op</h2><span class="meta">Hoogstens vijf punten, het zwaarste eerst.</span></header>
              <LegeStaat v-if="!data.aandachtspunten.length" titel="Niets dat opvalt in deze periode." tekst="Geen grote achterstand, geen gemiste belblokken en niemand die te vroeg stopt met bellen." />
              <ul v-else class="kaart mp-lijst">
                <li v-for="a in data.aandachtspunten" :key="a.tekst">
                  <div class="item-rij mp-rij">
                    <span class="item-icoon" :class="{ 'item-icoon--urgent': a.ernst >= 4 }"><Icoon :naam="a.ernst >= 3 ? 'TriangleAlert' : 'Lightbulb'" /></span>
                    <span class="item-body"><span class="item-naam">{{ a.tekst }}.</span></span>
                    <span class="item-acties">
                      <FunctieLink v-if="a.gebruikerId" :to="`/coaching/${a.gebruikerId}`" class="dd-act">Coachingkaart</FunctieLink>
                      <FunctieLink v-else-if="a.soort === 'terug'" to="/terug-in-beeld" class="dd-act">Bekijk</FunctieLink>
                    </span>
                  </div>
                </li>
              </ul>
            </div>

            <div class="alleen-telefoon mp-blok" data-test="team-stapels">
              <header class="mp-blokkop"><h2 class="mp-bloktitel">Wat blijft liggen</h2></header>
              <article v-for="[k, titel] in STAPELS" :key="k" class="kaart mt-8">
                <h3 class="kaart-titel">{{ titel }}</h3>
                <p v-if="!data.stapels[k].length" class="kaart-meta">Niets.</p>
                <ul v-else class="schakel-lijst"><li v-for="p in data.stapels[k]" :key="p.id" class="schakel-rij"><span>{{ kortNaam(p.naam) }}</span><span class="pil pil--leeg">{{ p.aantal }}</span></li></ul>
              </article>
            </div>

            <div class="mp-blok">
              <header class="mp-blokkop"><h2 class="mp-bloktitel">Cijfers per accountmanager</h2><span class="meta alleen-groot-blok">Klik op een getal voor de records erachter; klik op een kop om te sorteren.</span></header>
              <div class="tabel-schuif alleen-groot-blok">
                <table class="tabel tm-tabel" data-test="team-tabel">
                  <thead><tr>
                    <th><button type="button" class="tm-sorteer" @click="sorteer('naam')">Naam</button></th>
                    <th><button type="button" class="tm-sorteer" @click="sorteer('tempo')">Tempo</button></th>
                    <th v-for="k in KOLOMMEN" :key="k.k"><button type="button" class="tm-sorteer" @click="sorteer(k.k)">{{ k.label }}</button></th>
                  </tr></thead>
                  <tbody>
                    <tr v-for="r in rijen" :key="r.id" :data-test="`team-rij-${r.id}`">
                      <td><FunctieLink als-tekst :to="`/coaching/${r.id}`" class="tm-naam">{{ kortNaam(r.naam) }}</FunctieLink><br><span class="meta">{{ NIVEAU_LABEL[r.niveau as 'beginner'] }} · {{ r.werkplek }}</span></td>
                      <td><Label soort="tempo" :waarde="tempoLabel(r).waarde" :tekst="tempoLabel(r).tekst" /></td>
                      <td v-for="k in KOLOMMEN" :key="k.k" class="tnum"><button type="button" class="tm-cel" :class="{ 'tekst-rood': k.k === 'achterstallig' && r.achterstallig >= 10 }" :data-test="`cel-${r.id}-${k.cel}`" @click="openCel(r, k.cel, k.label)">{{ tekstCel(r, k.k) }}</button></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <ul class="alleen-telefoon kaart mp-lijst" data-test="team-lijst">
                <li v-for="r in rijen" :key="r.id">
                  <button type="button" class="item-rij mp-rij" @click="openPersoon(r)">
                    <span class="item-icoon" :class="{ 'item-icoon--urgent': r.tempo.stand === 'achter' }"><Icoon naam="User" /></span>
                    <span class="item-body"><span class="item-naam">{{ kortNaam(r.naam) }}</span><span class="item-meta">{{ r.kpi.pogingen }} pogingen · {{ r.kpi.afspraken }} afspraken · {{ r.achterstallig }} over tijd</span><span class="pil-tags"><Label soort="tempo" :waarde="tempoLabel(r).waarde" :tekst="tempoLabel(r).tekst" /></span></span>
                  </button>
                </li>
              </ul>
            </div>

            <div class="raster raster--2 mp-blok">
              <article class="kaart" data-test="werkverdeling">
                <header class="kaart-kop"><h2 class="kaart-titel">Werkverdeling</h2></header>
                <p class="kaart-meta">Prospects per fase. Klik op een fase om die accounts naar een collega te verplaatsen.</p>
                <ul class="schakel-lijst">
                  <li v-for="p in data.werkverdeling" :key="p.id" class="schakel-rij tm-verdeling"><strong>{{ kortNaam(p.naam) }}</strong>
                    <span class="chips"><button v-for="f in p.fases" :key="`${f.fase}-${f.status}`" type="button" class="chip" :title="`Verplaats ${f.label ?? f.fase}`" @click="verplaats = { van: p.id, fase: f.fase, label: f.label }">{{ f.label ?? f.fase }} · {{ f.aantal }}</button></span></li>
                </ul>
              </article>
              <article class="kaart" data-test="goedkeuringen">
                <header class="kaart-kop"><h2 class="kaart-titel">Wacht op jouw goedkeuring</h2></header>
                <LegeStaat v-if="!data.goedkeuringen.length && !(suggestiesAan && sg?.open)" titel="Niets om goed te keuren." tekst="Nieuwe reisversies en campagnes boven de capaciteit komen hier te staan." />
                <ul v-else class="mp-lijst">
                  <li v-if="suggestiesAan && sgRegel && sg?.open" data-test="suggesties-regel"><button type="button" class="item-rij mp-rij" @click="sgOpen = true"><span class="item-icoon"><Icoon naam="Lightbulb" /></span><span class="item-body"><span class="item-naam">{{ sgRegel }}</span><span class="item-meta">SalesDNA</span></span></button></li>
                  <li v-for="g in data.goedkeuringen" :key="g.id"><div class="item-rij mp-rij"><span class="item-icoon"><Icoon naam="ClipboardCheck" /></span><span class="item-body"><FunctieLink als-tekst :to="g.link" class="item-naam">{{ g.titel }}</FunctieLink><span class="item-meta">{{ g.soort }}</span></span><span class="item-acties"><FunctieLink :to="g.link" class="dd-act">Bekijk</FunctieLink></span></div></li>
                </ul>
              </article>
            </div>

            <article id="niveaus" class="kaart mp-blok" data-test="niveaus">
              <header class="kaart-kop"><h2 class="kaart-titel">Niveau per persoon</h2></header>
              <p class="kaart-meta">Een hoger niveau is jouw besluit. Dealtrace doet daar geen voorstel voor.</p>
              <ul class="schakel-lijst">
                <li v-for="r in data.rijen" :key="r.id" class="schakel-rij"><span>{{ kortNaam(r.naam) }}</span>
                  <select class="invoer invoer--klein tm-niveau" :value="r.niveau" :aria-label="`Niveau van ${kortNaam(r.naam)}`" :data-test="`niveau-${r.id}`" @change="niveauVraag = { id: r.id, naam: kortNaam(r.naam), van: r.niveau, naar: ($event.target as HTMLSelectElement).value }"><option v-for="n in NIVEAUS" :key="n" :value="n">{{ NIVEAU_LABEL[n] }}</option></select></li>
              </ul>
            </article>
          </template>
        </div>
      </section>

      <CijferFlyout :open="!!venster" :kicker="venster?.kicker ?? ''" :titel="venster?.titel ?? ''" :meta="venster?.meta" :regels="venster?.regels ?? []" :leeg="venster?.leeg" @sluit="venster = null" />
      <FlyoutShell v-if="verplaats" open titel-id="fs-team1" breedte="smal" @sluit="verplaats = null">
        <template #kop><span class="fo-kicker">Verplaats</span><h2 id="fs-team1" class="fo-titel">Accounts in {{ verplaats.label ?? verplaats.fase }}</h2></template>
        <form id="tv-form" class="fs-form" @submit.prevent="doeVerplaats">
          <div class="fo-body fo-body--formulier">
            <label class="veld"><span class="veld-label">Naar</span><select v-model="naar" class="invoer" required data-test="verplaats-naar"><option value="" disabled>Kies een collega</option><option v-for="r in data.rijen.filter((x: any) => x.id !== verplaats!.van)" :key="r.id" :value="r.id">{{ kortNaam(r.naam) }}</option></select></label>
            <label class="veld"><span class="veld-label">Reden</span><input v-model="reden" class="invoer" required placeholder="Bijvoorbeeld: verlof" data-test="verplaats-reden"></label>
          </div>
        </form>
        <template #voet>
          <footer class="fo-foot fs-voet">
            <button type="submit" form="tv-form" class="dd-actie dd-actie--zwart fs-hoofdactie" :disabled="!naar || !reden.trim()"><Icoon naam="Check" :grootte="16" />Verplaats</button>
            <span class="fo-foot-vul" />
          </footer>
        </template>
      </FlyoutShell>
      <PlanCoachingFlyout :open="plan" :leden="planLeden" :voorkeur="planLeden[0]?.id" @sluit="plan = false" @gepland="plan = false" />
      <BevestigVenster :open="!!niveauVraag" :titel="`Niveau van ${niveauVraag?.naam ?? ''} wijzigen?`" :tekst="`Van ${NIVEAU_LABEL[(niveauVraag?.van ?? 'beginner') as 'beginner']} naar ${NIVEAU_LABEL[(niveauVraag?.naar ?? 'beginner') as 'beginner']}. Functies die aangaan, krijgen een melding met uitleg.`" bevestig="Wijzig niveau" :met-reden="!!niveauVraag && NIVEAUS.indexOf(niveauVraag.naar as any) < NIVEAUS.indexOf(niveauVraag.van as any)" @bevestigd="zetNiveau" @geannuleerd="niveauVraag = null; refresh()" />
    </template>
    <SuggestiesFlyout :open="sgOpen" @sluit="sgOpen = false" @gewijzigd="verversSg()" />
  </div>
</template>

<style scoped>
.mp-filterknop--aan { background: var(--ink); color: var(--yellow); border-color: var(--ink); }
.mp-teller { display: inline-flex; align-items: center; height: 18px; padding: 0 7px; margin-left: 2px; background: var(--yellow); color: var(--ink); font-size: 11px; font-weight: 800; border-radius: 2px; }
.mb-16 { margin-bottom: 16px; }
.mp-blok { margin-top: 32px; }
.mp-blokkop { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 16px; margin: 0 0 12px; padding-bottom: 8px; border-bottom: 2px solid var(--ink); }
.mp-bloktitel { margin: 0; font-family: var(--font-serif); font-size: 20px; }
.mp-lijst { list-style: none; margin: 0; padding-top: 4px; padding-bottom: 4px; }
.mp-rij { grid-template-columns: 36px minmax(0, 1fr) auto; align-items: center; }
.tm-tabel th, .tm-tabel td { white-space: nowrap; }
.tm-naam { font-weight: 600; }
.tm-sorteer, .tm-cel { all: unset; cursor: pointer; min-height: 32px; display: inline-flex; align-items: center; }
.tm-cel { text-decoration: underline dotted; }
.tm-cel:focus-visible, .tm-sorteer:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
.tm-verdeling { flex-wrap: wrap; gap: 8px; }
.tm-niveau { width: auto; min-width: 160px; flex: 0 0 auto; }
@media (max-width: 767px) { .alleen-groot-blok { display: none; } }
@media (max-width: 599px) { .mp-rij { grid-template-columns: 36px minmax(0, 1fr); } .mp-rij > .item-acties { grid-column: 2; } }
</style>
