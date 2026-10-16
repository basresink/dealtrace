<script setup lang="ts">
// Signaalradar (F5, /signaalradar): een raster van branches uit het verkoopverhaal maal signaalsoorten
// over de inzichten met bron van de laatste 30 dagen, vergeleken met normaal (het gemiddelde van de zes
// perioden ervoor). Een golf (vanaf 1,5 keer normaal en minstens 5 accounts) wordt met één klik een
// belronde of gaat in je volgende belblok. Mijn regio (of mijn team, mijn accounts) of de hele organisatie.
// De keuze en de gekozen cel staan in de URL (?reikwijdte=org&cel=br-01|vacatures).
import { factorTekst, getal } from '~~/shared/signaalradar'

const { functie } = useMe()
const aan = !!functie('nav.signaalradar')?.beschikbaar
const route = useRoute()
const router = useRouter()
const reikwijdte = computed<'mij' | 'org'>(() => (route.query.reikwijdte === 'org' ? 'org' : 'mij'))
const { data, refresh } = await useFetch<any>('/api/signaalradar', { query: computed(() => ({ reikwijdte: reikwijdte.value })), immediate: aan, default: () => null })

const celVan = (brancheId: string | null, soort: string) => data.value?.cellen.find((c: any) => c.brancheId === brancheId && c.soort === soort)
// De gekozen cel; zonder keuze de sterkste golf.
const gekozen = computed<{ brancheId: string | null; soort: string } | null>(() => {
  const q = typeof route.query.cel === 'string' ? route.query.cel : ''
  if (q.includes('|')) { const [b, s] = q.split('|'); return { brancheId: b === 'zonder' ? null : b!, soort: s! } }
  const g = data.value?.golven?.[0]
  return g ? { brancheId: g.brancheId, soort: g.soort } : null
})
const isGekozen = (brancheId: string | null, soort: string) => gekozen.value?.brancheId === brancheId && gekozen.value?.soort === soort
const detailRef = ref<HTMLElement | null>(null)
function kies(brancheId: string | null, soort: string) {
  router.replace({ query: { ...route.query, cel: `${brancheId ?? 'zonder'}|${soort}` } })
  // Op de telefoon staat het detail onder het raster.
  if (import.meta.client && window.matchMedia('(max-width: 1023px)').matches) nextTick(() => detailRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}
function zetReikwijdte(r: 'mij' | 'org') { router.replace({ query: { ...route.query, reikwijdte: r === 'org' ? 'org' : undefined } }) }

const titel = computed(() => {
  const n = data.value?.golven?.length ?? 0
  const markt = reikwijdte.value === 'org' ? 'de hele organisatie' : 'jouw markt'
  return n ? `${n} ${n === 1 ? 'golf' : 'golven'} in ${markt}.` : `Geen golf in ${markt}.`
})
const uitleg = computed(() => data.value ? `Vergeleken met de zes perioden ervoor. ${data.value.signalen} ${data.value.signalen === 1 ? 'signaal' : 'signalen'} met bron bij ${data.value.accounts} accounts in de laatste 30 dagen.` : '')
const LEGENDA = [
  { niveau: 'normaal', tekst: 'normaal' },
  { niveau: 'verhoogd', tekst: 'verhoogd, geen golf' },
  { niveau: 'golf', tekst: 'golf: 1,5 keer en 5 accounts' },
  { niveau: 'sterk', tekst: 'sterke golf: 3 keer' },
]
const celLabel = (rij: any, k: any) => {
  const c = celVan(rij.id, k.sleutel)
  if (!c?.aantal) return `${rij.naam}, ${k.label}: geen signalen`
  return `${rij.naam}, ${k.label}: ${c.aantal} ${c.aantal === 1 ? 'account' : 'accounts'}, normaal ${getal(c.normaal)}${c.golf ? `, golf, ${factorTekst(c.factor)}` : ''}`
}
const mobielRijen = computed(() => (data.value?.rijen ?? []).map((r: any) => ({ ...r, cellen: data.value.kolommen.map((k: any) => ({ ...k, cel: celVan(r.id, k.sleutel) })).filter((x: any) => x.cel?.aantal) })))
useHead({ title: 'Signaalradar · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="nav.signaalradar" />
    <template v-else>
      <PaginaKop kicker="Signaalradar · laatste 30 dagen" :titel="data ? titel : 'Signaalradar'" :uitleg="uitleg" helpartikel="signaalradar">
        <template #acties>
          <div class="keuzegroep" role="group" aria-label="Reikwijdte" data-test="sr-reikwijdte">
            <button type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': reikwijdte === 'mij' }" :aria-pressed="reikwijdte === 'mij'" data-test="sr-mij" @click="zetReikwijdte('mij')">{{ data?.mijLabel ?? 'Mijn regio' }}</button>
            <button type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': reikwijdte === 'org' }" :aria-pressed="reikwijdte === 'org'" data-test="sr-org" @click="zetReikwijdte('org')">Hele organisatie</button>
          </div>
        </template>
      </PaginaKop>

      <section class="section section--laatste">
        <div class="container">
          <LegeStaat v-if="data && data.zonderBranches" kicker="Nog niets" titel="Je verkoopverhaal heeft nog geen branches." tekst="De radar telt per branche. Zet de branches en hun SBI-codes in het verkoopverhaal; daarna verschijnen hier de signalen per branche." data-test="sr-geen-branches">
            <NuxtLink to="/richting" class="dd-actie dd-actie--secundair">Naar Richting</NuxtLink>
          </LegeStaat>
          <LegeStaat v-else-if="data && data.leeg" kicker="Nog niets" titel="Nog geen signalen met bron." :tekst="`De Waarnemer zoekt per account naar vacatures, nieuws en vergunningen. Zodra er inzichten met bron zijn in ${reikwijdte === 'org' ? 'je organisatie' : data.mijLabel.toLowerCase()}, telt de radar ze hier op per branche en soort.`" data-test="sr-leeg">
            <button v-if="reikwijdte === 'mij'" type="button" class="dd-actie dd-actie--secundair" @click="zetReikwijdte('org')">Bekijk de hele organisatie</button>
            <NuxtLink v-else to="/inzichten" class="dd-actie dd-actie--secundair">Naar Inzichten</NuxtLink>
          </LegeStaat>
          <div v-else-if="data" class="sr-indeling">
            <div class="sr-raster-kaart">
              <table class="sr-raster" data-test="sr-raster">
                <caption class="sr-verborgen">Accounts met een signaal per branche en signaalsoort, laatste 30 dagen</caption>
                <thead>
                  <tr>
                    <th scope="col" class="sr-hoek">Branche</th>
                    <th v-for="k in data.kolommen" :key="k.sleutel" scope="col" class="sr-kolom" :title="k.label"><abbr v-if="k.kort !== k.label" :title="k.label" class="sr-afk">{{ k.kort }}</abbr><template v-else>{{ k.label }}</template></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="r in data.rijen" :key="r.id ?? 'zonder'">
                    <th scope="row" class="sr-rij">{{ r.naam }}</th>
                    <td v-for="k in data.kolommen" :key="k.sleutel">
                      <button type="button" class="sr-cel" :class="[`sr-cel--${celVan(r.id, k.sleutel)?.niveau ?? 'leeg'}`, { 'sr-cel--aan': isGekozen(r.id, k.sleutel) }]" :aria-pressed="isGekozen(r.id, k.sleutel)" :aria-label="celLabel(r, k)" :data-test="`sr-cel-${r.id ?? 'zonder'}-${k.sleutel}`" @click="kies(r.id, k.sleutel)">
                        <span class="tnum">{{ celVan(r.id, k.sleutel)?.aantal || '·' }}</span>
                        <span v-if="celVan(r.id, k.sleutel)?.golf" class="sr-cel-factor">{{ celVan(r.id, k.sleutel).factor === null ? 'nieuw' : `${getal(celVan(r.id, k.sleutel).factor)}x` }}</span>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div class="sr-mobiel" data-test="sr-mobiel">
                <div v-for="r in mobielRijen" :key="r.id ?? 'zonder'" class="sr-mobiel-rij">
                  <p class="sr-mobiel-naam">{{ r.naam }}</p>
                  <p v-if="!r.cellen.length" class="sr-mobiel-leeg">Geen signalen.</p>
                  <div v-else class="sr-mobiel-cellen">
                    <button v-for="k in r.cellen" :key="k.sleutel" type="button" class="sr-mcel" :class="[`sr-cel--${k.cel.niveau}`, { 'sr-cel--aan': isGekozen(r.id, k.sleutel) }]" :aria-pressed="isGekozen(r.id, k.sleutel)" :aria-label="celLabel(r, k)" :data-test="`sr-mcel-${r.id ?? 'zonder'}-${k.sleutel}`" @click="kies(r.id, k.sleutel)">
                      <span>{{ k.label }}</span><span class="tnum sr-mcel-n">{{ k.cel.aantal }}</span>
                    </button>
                  </div>
                </div>
              </div>

              <ul class="sr-legenda" aria-label="Legenda">
                <li v-for="l in LEGENDA" :key="l.niveau"><span class="sr-legenda-vak" :class="`sr-cel--${l.niveau}`" aria-hidden="true" />{{ l.tekst }}</li>
              </ul>
              <p class="sr-uitleg">Het getal is het aantal accounts met dat signaal in de laatste 30 dagen. Normaal is het gemiddelde van de zes perioden van 30 dagen daarvoor.</p>
            </div>

            <aside ref="detailRef" class="sr-detail-kaart" aria-live="polite">
              <RadarDetail v-if="gekozen" :key="`${reikwijdte}-${gekozen.brancheId}-${gekozen.soort}`" :reikwijdte="reikwijdte" :branche-id="gekozen.brancheId" :soort="gekozen.soort" @gewijzigd="refresh" />
              <div v-else class="sr-geen-keuze" data-test="sr-geen-keuze">
                <p class="sr-geen-keuze-titel">Geen golf op dit moment.</p>
                <p class="sr-uitleg">Kies een cel om te zien welke accounts erin zitten en waarom het geen golf is. Een golf begint bij 1,5 keer normaal en minstens 5 accounts.</p>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.sr-indeling { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--kaart-gap); align-items: start; }
@media (min-width: 1024px) { .sr-indeling { grid-template-columns: minmax(0, 1fr) minmax(320px, 380px); } }
.sr-raster-kaart { overflow-x: auto; }
.sr-raster-kaart, .sr-detail-kaart { min-width: 0; padding: 24px; background: var(--wit); border: 1px solid var(--border); }
@media (min-width: 1024px) { .sr-detail-kaart { position: sticky; top: 16px; } }
.sr-raster { width: 100%; border-collapse: separate; border-spacing: 3px; table-layout: fixed; }
.sr-verborgen { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.sr-hoek { width: 27%; text-align: left; font-size: var(--fs-label); font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); vertical-align: bottom; padding: 0 6px 6px 0; }
.sr-kolom { padding: 0 1px 6px; font-size: 10px; font-weight: 700; line-height: 1.25; color: var(--ink-soft); text-align: center; vertical-align: bottom; overflow-wrap: normal; word-break: keep-all; }
.sr-afk { text-decoration: none; cursor: help; }
.sr-rij { padding-right: 8px; font-size: 12px; font-weight: 600; line-height: 1.3; text-align: left; color: var(--ink); overflow-wrap: anywhere; hyphens: auto; }
.sr-cel { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; width: 100%; min-height: 48px; padding: 4px 2px; border: 1px solid var(--border); background: var(--wit); color: var(--ink); font: inherit; font-size: 16px; font-weight: 700; cursor: pointer; transition: border-color var(--transition-fast); }
.sr-cel:hover { border-color: var(--ink); }
.sr-cel:focus-visible, .sr-mcel:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
.sr-cel-factor { font-size: 10px; font-weight: 700; letter-spacing: 0.04em; }
.sr-cel--leeg { background: var(--bg); color: var(--muted-light); font-weight: 400; }
.sr-cel--normaal { background: var(--wit); }
.sr-cel--verhoogd { background: var(--yellow-teller); border-color: var(--yellow-dark-zacht); }
.sr-cel--golf { background: var(--yellow); border-color: var(--yellow); }
.sr-cel--sterk { background: var(--ink); border-color: var(--ink); color: var(--yellow); }
.sr-cel--aan { outline: 2px solid var(--purple); outline-offset: 1px; border-color: var(--purple); }
.sr-mobiel { display: none; }
.sr-legenda { display: flex; flex-wrap: wrap; gap: 8px 16px; margin: 14px 0 0; padding: 0; list-style: none; font-size: 12px; color: var(--muted); }
.sr-legenda li { display: inline-flex; align-items: center; gap: 6px; }
.sr-legenda-vak { display: inline-block; width: 14px; height: 14px; border: 1px solid var(--border); }
.sr-uitleg { margin: 8px 0 0; font-size: 12px; color: var(--muted); }
.sr-geen-keuze-titel { margin: 0; font-family: var(--font-serif); font-size: var(--fs-kaarttitel); font-weight: 700; }
@media (max-width: 719px) {
  .sr-raster-kaart, .sr-detail-kaart { padding: 16px; }
  .sr-raster { display: none; }
  .sr-mobiel { display: flex; flex-direction: column; gap: 14px; }
  .sr-mobiel-naam { margin: 0 0 6px; font-size: 13px; font-weight: 700; color: var(--ink); }
  .sr-mobiel-leeg { margin: 0; font-size: 12px; color: var(--muted); }
  .sr-mobiel-cellen { display: flex; flex-wrap: wrap; gap: 6px; }
  .sr-mcel { display: inline-flex; align-items: center; gap: 8px; min-height: var(--touch-target-min); padding: 0 12px; border: 1px solid var(--border); background: var(--wit); color: var(--ink); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
  .sr-mcel-n { font-weight: 800; }
  .sr-mcel.sr-cel--verhoogd { background: var(--yellow-teller); }
  .sr-mcel.sr-cel--golf { background: var(--yellow); border-color: var(--yellow); }
  .sr-mcel.sr-cel--sterk { background: var(--ink); border-color: var(--ink); color: var(--yellow); }
}
</style>
