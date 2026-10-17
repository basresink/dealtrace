<script setup lang="ts">
// Campagnes (F12) in de opzet van DealDrive: kop met het aantal actieve campagnes, "+ Campagne" (slot
// voor Beginner) en Filters; tellers per status die ook filteren; een filterpaneel met status (meer
// tegelijk), soort en eigenaar; kaarten per campagne met soort, status, eigenaar, winpunt, doel,
// voortgang met de verwachte stand als streep, tempopil en dagen over. Alle filters in de URL, standaard "Van mij".
const { functie } = useMe()
const aan = !!functie('campagnes.meedoen')?.beschikbaar
const maken = !!functie('campagnes.maken')?.beschikbaar
const route = useRoute()
const router = useRouter()
const filter = computed(() => ({ status: (route.query.status as string) || 'alle', soort: (route.query.soort as string) || 'alle', eigenaar: (route.query.eigenaar as string) || 'mij' }))
const { data } = await useFetch<any>('/api/campagnes', { query: filter, immediate: aan, default: () => ({ actief: 0, campagnes: [], perStatus: {} }) })
const { data: ctx } = await useFetch<any>('/api/campagnes/context', { immediate: aan, default: () => ({ soorten: [], verkopers: [] }) })
function zet(k: string, v: string) { router.replace({ query: { ...route.query, [k]: v } }) }
const filtersOpen = ref(false)
const gekozenStatus = computed(() => (filter.value.status === 'alle' ? [] : filter.value.status.split(',')))
function wisselStatus(s: string) {
  const n = gekozenStatus.value.includes(s) ? gekozenStatus.value.filter((x) => x !== s) : [...gekozenStatus.value, s]
  zet('status', n.length && n.length < STATUSSEN.length ? n.join(',') : 'alle')
}
const actieveFilters = computed(() => (filter.value.status !== 'alle' ? 1 : 0) + (filter.value.soort !== 'alle' ? 1 : 0) + (filter.value.eigenaar !== 'mij' ? 1 : 0))
const gefilterd = computed(() => actieveFilters.value > 0)
const STATUS: Record<string, string> = { concept: 'Concept', wacht: 'Wacht op bevestiging', actief: 'Actief', gepauzeerd: 'Gepauzeerd', afgerond: 'Afgerond' }
const STATUSSEN = Object.keys(STATUS)
const TELLERS = [['actief', 'Actief', 'lopen nu'], ['concept', 'Concept', 'nog niet gestart'], ['gepauzeerd', 'Gepauzeerd', 'staan stil'], ['afgerond', 'Afgerond', 'met resultaat']] as const
const soort = (s: string) => ctx.value.soorten.find((x: any) => x.sleutel === s)
const soortNaam = (s: string) => soort(s)?.naam ?? s
// Kleur van de soortpil naar het kanaal van de eerste stap (zoals DealDrive: bel geel, bezoek zwart, mail blauw).
/** Kanaal van de campagnesoort als actielabel (rand met icoon); meerdere kanalen is een taak. */
const KANAAL_ACTIE: Record<string, string> = { bellen: 'bellen', bezoek: 'bezoek', mail: 'mailen', linkedin: 'linkedin', mix: 'taak' }
const soortKleur = (s: string) => { const k = soort(s)?.kanalen ?? []; return k.length > 1 ? 'mix' : (k[0] ?? 'bellen') }
const TEMPO: Record<string, string> = { 'Voor op schema': 'voor', 'Op schema': 'op', 'Achter op schema': 'achter' }
const tempoSleutel = (p: string) => TEMPO[p] ?? (p.startsWith('Achter') ? 'achter' : 'op')
const doelNodig = (c: any) => (c.doel ? (c.doel.type === 'procent' ? Math.ceil((c.accounts * c.doel.waarde) / 100) : c.doel.waarde) : null)
const doelTekst = (c: any) => (c.doel ? (c.doel.type === 'afspraken' ? `${c.doel.waarde} ${c.doel.waarde === 1 ? 'afspraak' : 'afspraken'}` : `${c.doel.waarde}% afspraken`) : 'Geen doel')
const voortgang = (c: any) => c.tempo?.voortgang ?? (c.accounts ? Math.round((c.klaar / c.accounts) * 100) : 0)
useHead({ title: 'Campagnes · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="campagnes.meedoen" />
    <template v-else>
      <PaginaKop :kicker="`Campagnes · ${data.actief} actief`" titel="Eén lijst, één doel, elke dag een stap." uitleg="Een campagne is geen lijst om af te vinken maar een reeks gesprekken: elke stap die je vandaag zet, scheelt er morgen twee." helpartikel="campagnes">
        <template #acties>
          <FunctieLink v-if="maken" to="/campagnes/nieuw" class="dd-actie dd-actie--primair" data-test="campagne-nieuw"><Icoon naam="Plus" class="dd-actie-icoon" />Campagne</FunctieLink>
          <button type="button" class="dd-actie dd-actie--secundair" :class="{ 'co-filters--aan': filtersOpen || actieveFilters }" :aria-expanded="filtersOpen" data-test="campagne-filters" @click="filtersOpen = !filtersOpen">
            <Icoon naam="SlidersHorizontal" class="dd-actie-icoon" />Filters<span v-if="actieveFilters" class="co-teller">{{ actieveFilters }}</span><Icoon naam="ChevronDown" :grootte="14" class="co-pijl" :class="{ 'co-pijl--open': filtersOpen }" />
          </button>
        </template>
      </PaginaKop>

      <section v-if="filtersOpen" class="co-filter-sectie">
        <div class="container">
          <div class="co-paneel" data-test="campagne-filterbalk">
            <div class="co-paneel-kop">
              <span class="filter-label">Status</span>
              <div class="co-mini"><button type="button" class="co-mini-knop" @click="zet('status', 'alle')">Alles aan</button></div>
            </div>
            <div class="co-vinkjes" data-test="filter-status">
              <label v-for="s in STATUSSEN" :key="s" class="co-vinkje" :class="{ 'co-vinkje--aan': !gekozenStatus.length || gekozenStatus.includes(s) }">
                <input type="checkbox" :checked="!gekozenStatus.length || gekozenStatus.includes(s)" :data-test="`status-${s}`" @change="gekozenStatus.length ? wisselStatus(s) : zet('status', STATUSSEN.filter((x) => x !== s).join(','))">
                <span class="co-vinkje-label">{{ STATUS[s] }}</span><span class="co-vinkje-telling tnum">{{ data.perStatus[s] ?? 0 }}</span>
              </label>
            </div>
            <div class="co-rij">
              <label class="veld"><span class="veld-label">Soort</span>
                <select class="invoer" :value="filter.soort" data-test="filter-soort" @change="zet('soort', ($event.target as HTMLSelectElement).value)"><option value="alle">Alle</option><option v-for="s in ctx.soorten" :key="s.sleutel" :value="s.sleutel">{{ s.naam }}</option></select></label>
              <label class="veld"><span class="veld-label">Eigenaar</span>
                <select class="invoer" :value="filter.eigenaar" data-test="filter-eigenaar" @change="zet('eigenaar', ($event.target as HTMLSelectElement).value)"><option value="mij">Van mij</option><option value="alle">Iedereen</option><option v-for="v in ctx.verkopers" :key="v.id" :value="v.id">{{ v.naam }}</option></select></label>
              <button v-if="gefilterd" type="button" class="dd-act co-reset" @click="router.replace({ query: {} })">Reset filters</button>
            </div>
          </div>
        </div>
      </section>

      <section class="co-stats">
        <div class="container">
          <div class="stat-grid stat-grid--4">
            <button v-for="[k, l, voet] in TELLERS" :key="k" type="button" class="stat-card" :class="{ 'stat-card--actief': filter.status === k }" :aria-pressed="filter.status === k" :data-test="`campagne-stat-${k}`" @click="zet('status', filter.status === k ? 'alle' : k)">
              <span class="stat-label">{{ l }}</span><span class="stat-num tnum">{{ data.perStatus[k] ?? 0 }}</span><span class="stat-foot">{{ voet }}</span>
            </button>
          </div>
        </div>
      </section>

      <section class="section section--laatste">
        <div class="container">
          <LegeStaat v-if="!data.campagnes.length" :titel="gefilterd || data.actief ? 'Geen campagnes voor dit filter.' : 'Er lopen geen campagnes.'" :tekst="gefilterd || data.actief ? (filter.eigenaar === 'mij' ? 'Je doet nog niet mee aan een campagne.' : 'Kies een ander filter.') : 'Een campagne bundelt 20 tot 80 accounts rond één doel.'">
            <button v-if="gefilterd || data.actief" type="button" class="dd-act" data-test="toon-alles" @click="router.replace({ query: { eigenaar: 'alle' } })">Toon alles</button>
          </LegeStaat>
          <ul v-else class="co-lijst" role="list" data-test="campagne-lijst">
            <li v-for="c in data.campagnes" :key="c.id" class="co-kaart" :class="`co-kaart--${c.status}`">
              <FunctieLink :to="`/campagnes/${c.id}`" class="co-link" :data-test="`campagne-${c.id}`">
                <header class="co-kop">
                  <div class="co-pillen">
                    <Label class="co-soort" soort="actie" :waarde="KANAAL_ACTIE[soortKleur(c.soort)] ?? 'taak'" :tekst="soortNaam(c.soort)" />
                    <Label class="co-status" soort="campagne" :waarde="c.status" :tekst="STATUS[c.status]" />
                  </div>
                  <span class="co-eigenaar">{{ c.eigenaar ?? 'Geen eigenaar' }}</span>
                </header>
                <h3 class="co-naam">{{ c.naam }}</h3>
                <p v-if="c.winpunt" class="co-tekst">Winpunt: {{ c.winpunt }}</p>
                <p class="co-doel"><strong>Doel:</strong> {{ doelTekst(c) }}</p>
                <div class="co-voortgang">
                  <div class="co-cijfers">
                    <div class="co-cijfer"><span class="co-num tnum">{{ c.accounts }}</span><span class="co-label">accounts</span></div>
                    <div class="co-cijfer"><span class="co-num tnum">{{ c.klaar }}</span><span class="co-label">klaar</span></div>
                    <div class="co-cijfer"><span class="co-num tnum">{{ c.afspraken }}</span><span class="co-label">afspraken</span></div>
                    <div class="co-cijfer"><span class="co-num tnum">{{ voortgang(c) }}%</span><span class="co-label">voortgang</span></div>
                  </div>
                  <div class="co-balk" role="progressbar" :aria-valuenow="voortgang(c)" aria-valuemin="0" aria-valuemax="100" :aria-label="`Voortgang ${voortgang(c)} procent`">
                    <div class="co-vul" :style="{ width: `${voortgang(c)}%` }" />
                    <div v-if="c.tempo" class="co-verwacht" :style="{ left: `${c.tempo.verwacht}%` }" title="Verwachte stand" />
                  </div>
                  <div v-if="c.tempo || c.doel || c.dagenOver !== null" class="co-tempo-rij">
                    <Label v-if="c.tempo" soort="tempo" :waarde="tempoSleutel(c.tempo.pil)" :tekst="c.tempo.pil" data-test="tempopil" />
                    <span v-if="c.doel" class="co-doel-stand tnum">{{ c.gehaald }} van {{ doelNodig(c) }} gehaald{{ c.gehaald >= (doelNodig(c) ?? Infinity) ? ', behaald' : '' }}</span>
                    <span v-if="c.dagenOver !== null" class="co-dagen tnum">nog {{ c.dagenOver }} {{ c.dagenOver === 1 ? 'dag' : 'dagen' }}</span>
                  </div>
                </div>
                <span class="co-open">Open campagnebord <Icoon naam="ArrowRight" :grootte="14" /></span>
              </FunctieLink>
            </li>
          </ul>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.co-filters--aan { background: var(--ink); color: var(--yellow); border-color: var(--ink); }
.co-teller { display: inline-flex; align-items: center; height: 18px; padding: 0 7px; margin-left: 2px; background: var(--yellow); color: var(--ink); font-size: 11px; font-weight: 800; border-radius: 2px; }
.co-pijl { transition: transform var(--transition-fast); }
.co-pijl--open { transform: rotate(180deg); }
.co-filter-sectie { padding: 16px 0 0; }
.co-paneel { background: var(--wit); border: 1px solid var(--border); padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; }
.co-paneel-kop { display: flex; justify-content: space-between; align-items: center; }
.co-mini-knop { background: transparent; border: 0; color: var(--muted); font-size: 12px; font-weight: 600; text-decoration: underline; cursor: pointer; min-height: 36px; }
.co-mini-knop:hover { color: var(--ink); }
.co-vinkjes { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 6px; }
.co-vinkje { display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 12px; border: 1px solid var(--border); cursor: pointer; font-size: 13px; font-weight: 600; }
.co-vinkje:hover { border-color: var(--ink); }
.co-vinkje--aan { background: var(--yellow-zacht); border-color: var(--yellow-dark); }
.co-vinkje input { accent-color: var(--yellow-dark); }
.co-vinkje-label { flex: 1; }
.co-vinkje-telling { font-size: 11px; font-weight: 700; color: var(--muted); padding: 1px 6px; background: var(--surface); }
.co-rij { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; }
.co-rij .veld { min-width: 200px; }
.co-reset { margin-left: auto; }
.co-stats { padding: 16px 0 0; }
.co-lijst { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr; gap: var(--kaart-gap); }
@media (min-width: 720px) { .co-lijst { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.co-kaart { background: var(--wit); border: 1px solid var(--border); border-left: 4px solid var(--border-strong); min-width: 0; }
.co-kaart--actief { border-left-color: var(--green); }
.co-kaart--concept { border-left-color: var(--yellow); }
.co-kaart--wacht { border-left-color: var(--orange); }
.co-kaart--afgerond { border-left-color: var(--blue); }
.co-kaart--gepauzeerd { border-left-color: var(--muted); }
.co-link { display: flex; flex-direction: column; height: 100%; padding: var(--kaart-padding); color: var(--ink); text-decoration: none; border: 0; }
.co-link:hover { background: var(--surface); }
.co-kop { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 8px; }
.co-pillen { display: flex; flex-wrap: wrap; gap: 6px; }
.co-eigenaar { font-size: 11px; font-weight: 600; color: var(--muted); text-align: right; }
.co-naam { font-family: var(--font-serif); font-size: 18px; font-weight: 700; margin: 4px 0 0; overflow-wrap: anywhere; }
.co-tekst { margin: 6px 0 0; font-size: 13px; color: var(--ink-soft); line-height: 1.45; }
.co-doel { margin: 6px 0 0; font-size: 12px; color: var(--ink-soft); }
.co-voortgang { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border); }
.co-cijfers { display: flex; flex-wrap: wrap; gap: 8px 20px; }
.co-cijfer { display: flex; flex-direction: column; }
.co-num { font-family: var(--font-serif); font-size: 18px; font-weight: 700; line-height: 1; }
.co-label { font-size: var(--fs-label); font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
.co-balk { position: relative; margin-top: 8px; height: 6px; background: var(--surface); }
.co-vul { height: 100%; background: var(--green); transition: width var(--transition-base); }
.co-verwacht { position: absolute; top: -4px; bottom: -4px; width: 2px; background: var(--red); }
.co-tempo-rij { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 10px; }
.co-doel-stand { font-size: 11px; font-weight: 600; color: var(--ink-soft); }
.co-dagen { margin-left: auto; font-size: 11px; color: var(--muted); }
.co-open { margin-top: auto; padding-top: 12px; display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; color: var(--muted); }
.co-link:hover .co-open { color: var(--ink); }
@media (max-width: 719px) {
  .co-rij .veld { min-width: 0; flex: 1 1 100%; }
  .co-vinkje { min-height: var(--touch-target-min); }
  .co-mini-knop { min-height: var(--touch-target-min); }
}
</style>
