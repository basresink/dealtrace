<script setup lang="ts">
// Agents en mandaten (F14, 11.3). De beheerder zet het mandaat per agent binnen het
// platformmaximum, de dagplafonds en de stopknop "Agents pauzeren". Gevorderd en hoger
// lezen mee; een Expert zet zijn eigen mandaat binnen dat van de organisatie. De
// Waarnemer-instellingen en bronnen komen met P19.
import { MANDAAT_LABEL, MANDATEN, type Mandaat } from '~~/shared/mandaat'
const { functie } = useMe()
const aan = !!functie('agents.lezen')?.beschikbaar || !!functie('agents.beheer')?.beschikbaar
const toast = useToast()
const { data, refresh } = await useFetch<any>('/api/agents', { immediate: aan, default: () => ({ agents: [], pauze: null, tegengehouden: [], kan: {} }) })
const { data: credits, refresh: ververs } = await useFetch<any>('/api/agents/credits', { immediate: aan && (!!functie('verbruik.lezen')?.beschikbaar || !!functie('agents.beheer')?.beschikbaar), default: () => null })
const klein = ref(false)
onMounted(() => { klein.value = window.matchMedia('(max-width: 767px)').matches })
const beheer = computed(() => !!data.value.kan.beheer && !klein.value)

const status = ref('')
const timers: Record<string, any> = {}
function bewaarLater(sleutel: string, werk: () => Promise<unknown>) {
  status.value = 'Opslaan…'
  clearTimeout(timers[sleutel])
  timers[sleutel] = setTimeout(async () => {
    try { await werk(); status.value = 'Opgeslagen'; await refresh() } catch (e) { status.value = 'Opslaan mislukt'; toast.toon(foutTekst(e), 'fout'); await refresh() }
  }, 600)
}
function zetAgent(a: any) {
  bewaarLater(a.sleutel, () => $fetch<any>(`/api/agents/${a.sleutel}/mandaat`, { method: 'PUT', body: { mandaat: a.mandaat, dagplafond: a.dagplafond === '' || a.dagplafond === null ? null : Number(a.dagplafond), aan: a.aan } }))
}
function zetEigen(a: any, mandaat: string) {
  bewaarLater(`eigen-${a.sleutel}`, () => $fetch<any>(`/api/agents/${a.sleutel}/mandaat`, { method: 'PUT', body: { eigen: true, mandaat } }))
}
function zetCreditsPlafond(s: any) {
  bewaarLater(`credits-${s.soort}`, async () => { await $fetch('/api/agents/credits', { method: 'PUT', body: { soort: s.soort, dagplafond: s.dagplafond === '' || s.dagplafond === null ? null : Number(s.dagplafond) } }); await ververs() })
}

const pauzeVraag = ref(false)
async function pauzeer(pauze: boolean) {
  pauzeVraag.value = false
  try { await $fetch('/api/agents/pauzeer', { method: 'POST', body: { pauze } }); toast.toon(pauze ? 'Agents gepauzeerd.' : 'Agents hervat.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const sinds = computed(() => data.value.pauze ? new Intl.DateTimeFormat('nl-NL', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Amsterdam' }).format(new Date(data.value.pauze.sinds)) : '')
const tijd = (iso: string) => new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(new Date(iso))
const AGENT_NAAM = computed<Record<string, string>>(() => Object.fromEntries(data.value.agents.map((a: any) => [a.sleutel, a.naam])))
const eigenAgents = computed(() => data.value.agents.filter((a: any) => !a.altijdAan && a.opties.length > 1))
function eigenOpties(a: any): Mandaat[] { return MANDATEN.filter((x) => a.opties.includes(x) && MANDATEN.indexOf(x) >= MANDATEN.indexOf(a.mandaat)) }
const aiSoorten = computed(() => (credits.value?.soorten ?? []).filter((s: any) => s.aan))
// Filter op de tabel Agents: aan, uit of nog niet gebouwd.
const stand = ref<'' | 'aan' | 'uit' | 'later'>('')
const agents = computed(() => data.value.agents.filter((a: any) => !stand.value || (stand.value === 'later' ? !a.gebouwd : stand.value === 'aan' ? (a.altijdAan || a.aan) && a.gebouwd : !a.altijdAan && !a.aan && a.gebouwd)))
const titel = computed(() => {
  // Alleen de gebouwde agents tellen mee, zoals op de hub; wat later komt staat wel in de tabel.
  const gebouwd = data.value.agents.filter((x: any) => x.gebouwd)
  const n = gebouwd.length
  if (!n) return 'Agents en mandaten'
  const a = gebouwd.filter((x: any) => x.altijdAan || x.aan).length
  return data.value.pauze ? `Agents gepauzeerd, ${a} van ${n} staan aan` : `${a} van ${n} agents aan`
})
useHead({ title: 'Agents en mandaten · Instellingen · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="agents.lezen" />
    <template v-else>
      <InstellingenKop groep="Data en AI" :titel="titel" uitleg="Agents en mandaten: wat de agents zelf mogen doen, wat eerst langs jou gaat, en wat de Bewaker tegenhield. Elke wijziging bewaart zichzelf." helpartikel="agents-en-mandaten" :filters="data.agents.length ? (stand ? 1 : 0) : null" @reset="stand = ''">
        <template #onder><p class="mt-8"><OpslagStatus :status="status" test="opslagstatus" /></p></template>
        <template #acties>
          <button v-if="beheer && !data.pauze" type="button" class="dd-actie dd-actie--gevaar" data-test="agents-pauzeren" @click="pauzeVraag = true"><Icoon naam="Pause" class="dd-actie-icoon" />Agents pauzeren</button>
        </template>
        <template #filters>
          <div class="ifp-groep" role="group" aria-label="Stand"><span class="filter-label">Agents</span>
            <button v-for="[k, l] in [['', 'Alle'], ['aan', 'Aan'], ['uit', 'Uit'], ['later', 'Komt later']]" :key="k" type="button" class="filter-pil" :class="{ 'filter-pil--aan': stand === k }" :aria-pressed="stand === k" @click="stand = k as typeof stand">{{ l }}</button>
          </div>
        </template>
      </InstellingenKop>
      <section class="section section--laatste">
        <div class="container">
          <div v-if="data.pauze" class="kaart kaart--geel pauzestrook" role="status" data-test="pauzestrook">
            <span>Agents staan op pauze sinds {{ sinds }}.</span>
            <button v-if="beheer" type="button" class="dd-act" data-test="hervat" @click="pauzeer(false)">Hervat</button>
          </div>
          <p class="alleen-groot-melding kaart kaart--geel mt-8">Beter op een groot scherm.</p>
          <p v-if="!data.kan.beheer" class="kaart kaart--geel mt-8" data-test="meekijken">Je kunt meekijken. Alleen een beheerder zet de mandaten.</p>

          <article class="kaart mt-16" data-test="vier-niveaus">
            <h2 class="kaart-titel">Mandaten in vier niveaus</h2>
            <ul class="mandaat-uitleg mt-8">
              <li v-for="m in MANDATEN" :key="m"><Label soort="klasse" :waarde="m" :titel="`Mandaat ${m}`" /><span>{{ MANDAAT_LABEL[m] }}</span></li>
            </ul>
            <p class="kaart-meta mt-8">Harde grenzen: D blijft D. Nooit zonder toestemming of in een afkoelperiode, nooit buiten het ritme, nooit een template, regel of verhaal wijzigen. Alles is herleidbaar, en met "Agents pauzeren" stopt alles wat zonder jou gaat.</p>
          </article>

          <article class="kaart mt-16">
            <h2 class="kaart-titel">Agents</h2>
            <div class="tabel-schuif">
              <table class="tabel agents-tabel mt-8" data-test="agents-tabel">
                <thead><tr><th>Agent</th><th>Mandaat</th><th>Dagplafond</th><th>Vandaag</th><th>Aan</th></tr></thead>
                <tbody>
                  <tr v-if="!agents.length"><td colspan="5" class="meta">Geen agents in dit filter.</td></tr>
                  <tr v-for="a in agents" :key="a.sleutel" :data-test="`agent-${a.sleutel}`">
                    <td><strong>{{ a.naam }}</strong><br><span class="meta">{{ a.omschrijving }}</span></td>
                    <td>
                      <select v-if="beheer && !a.altijdAan" v-model="a.mandaat" class="invoer" :aria-label="`Mandaat ${a.naam}`" :data-test="`mandaat-${a.sleutel}`" @change="zetAgent(a)">
                        <option v-for="m in a.opties" :key="m" :value="m">{{ m }} · {{ MANDAAT_LABEL[m as 'A'] }}</option>
                      </select>
                      <Label v-else soort="klasse" :waarde="a.mandaat" :titel="`Mandaat ${a.mandaat}`" />
                    </td>
                    <td>
                      <input v-if="beheer && !a.altijdAan" v-model="a.dagplafond" type="number" min="0" class="invoer invoer--smal" placeholder="geen" :aria-label="`Dagplafond ${a.naam}`" @input="zetAgent(a)">
                      <span v-else class="meta">{{ a.dagplafond ?? 'geen' }}</span>
                    </td>
                    <td><InstellingLabel v-if="!a.gebouwd" stand="concept" tekst="Komt later" /><span v-else class="tnum">{{ a.vandaagGedaan }}<template v-if="a.vandaagTegengehouden"> · {{ a.vandaagTegengehouden }} tegengehouden</template></span></td>
                    <td>
                      <InstellingLabel v-if="a.altijdAan" stand="aan" tekst="Altijd aan" />
                      <Schakelaar v-else-if="beheer" :aan="a.aan" :label="`${a.naam} aan`" @wissel="a.aan = $event; zetAgent(a)" />
                      <InstellingLabel v-else :stand="a.aan ? 'aan' : 'uit'" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>

          <article v-if="data.kan.eigenMandaat" class="kaart mt-16" data-test="eigen-mandaat">
            <h2 class="kaart-titel">Je eigen mandaat</h2>
            <p class="kaart-meta">Strenger dan de organisatie mag altijd, ruimer niet.</p>
            <div class="formulier-raster mt-8">
              <label v-for="a in eigenAgents" :key="a.sleutel" class="veld">
                <span class="veld-label">{{ a.naam }}</span>
                <select class="invoer" :value="a.eigen?.mandaat ?? a.mandaat" :data-test="`eigen-${a.sleutel}`" @change="zetEigen(a, ($event.target as HTMLSelectElement).value)">
                  <option v-for="m in eigenOpties(a)" :key="m" :value="m">{{ m }} · {{ MANDAAT_LABEL[m] }}</option>
                </select>
              </label>
            </div>
          </article>

          <article v-if="data.kan.beheer || data.kan.waaromNiet" class="kaart mt-16" data-test="tegengehouden">
            <h2 class="kaart-titel">Vandaag tegengehouden door de Bewaker</h2>
            <p v-if="!data.tegengehouden.length" class="kaart-meta">De Bewaker heeft vandaag niets tegengehouden.</p>
            <ul v-else class="schakel-lijst mt-8">
              <li v-for="r in data.tegengehouden" :key="r.id" class="schakel-rij">
                <span><strong>{{ r.reden }}</strong><br><span class="meta">{{ AGENT_NAAM[r.agent] ?? r.agent }} · {{ r.handeling }}<template v-if="r.account"> · <NuxtLink :to="`/accounts/${r.accountId}`">{{ r.account }}</NuxtLink></template></span></span>
                <span class="meta tnum">{{ tijd(r.op) }}</span>
              </li>
            </ul>
          </article>

          <article v-if="credits" class="kaart mt-16" data-test="agent-credits">
            <header class="kaart-kop"><h2 class="kaart-titel">AI-credits van de agents deze maand</h2><Label v-if="credits.stand.letOp" soort="richting" waarde="controleren" tekst="Let op" /></header>
            <p class="kaart-meta"><span class="tnum">{{ credits.stand.verbruikt.toLocaleString("nl-NL") }}</span> van <span class="tnum">{{ credits.stand.pot.toLocaleString("nl-NL") }}</span> credits verbruikt, <span class="tnum">{{ credits.stand.over.toLocaleString("nl-NL") }}</span> over. Onder 10 procent van de pot staan de agents stil, zodat er credits overblijven voor wat jullie zelf vragen.</p>
            <div class="tabel-schuif">
              <table class="tabel mt-8">
                <thead><tr><th>AI-soort</th><th>Per handeling</th><th>Deze maand</th><th>Vandaag</th><th>Dagplafond agents</th></tr></thead>
                <tbody>
                  <tr v-for="s in aiSoorten" :key="s.soort">
                    <td>{{ s.naam }}</td><td class="tnum">{{ s.credits }}</td><td class="tnum">{{ s.maand }}</td><td class="tnum">{{ s.vandaag }}</td>
                    <td><input v-if="beheer" v-model="s.dagplafond" type="number" min="0" class="invoer invoer--smal" placeholder="geen" :aria-label="`Dagplafond ${s.naam}`" @input="zetCreditsPlafond(s)"><span v-else class="meta">{{ s.dagplafond ?? 'geen' }}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>
        </div>
      </section>
      <BevestigVenster :open="pauzeVraag" titel="Alle agents pauzeren?" tekst="Alle B-handelingen stoppen direct. Lopende ritmes gaan als taak naar de mens." bevestig="Pauzeren" gevaar @geannuleerd="pauzeVraag = false" @bevestigd="pauzeer(true)" />
    </template>
  </div>
</template>
