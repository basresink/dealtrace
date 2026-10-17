<script setup lang="ts">
// Platformbeheer · AI-koppeling (F23, 11.4): oplosketen organisatie, platform, omgeving, mock. Claude is de
// standaard. De sleutel is schrijf-alleen en verschijnt als vingerafdruk van acht tekens; een nieuwe sleutel
// vraagt herbevestiging. Modellen per soort en de modelprijzen met peildatum.
import { AGENTS, MANDATEN, MANDAAT_LABEL, strengste, type Mandaat } from '~~/shared/mandaat'
const { me } = useMe()
if (me.value?.echteRol !== 'founder') throw createError({ statusCode: 404, statusMessage: 'Deze pagina bestaat niet' })
const toast = useToast()
const { metHerbevestiging } = useHerbevestig()
const { data, refresh } = await useFetch<any>('/api/platform/ai', { default: () => ({ platform: null, klanten: [], soorten: [], prijzen: [] }) })
const f = reactive({ sleutel: '', regio: 'EU', geenTraining: true, modellen: {} as Record<string, string> })
watch(data, (d) => { if (d?.platform) Object.assign(f, { regio: d.platform.regio, geenTraining: d.platform.geenTraining, modellen: { ...d.platform.modellen } }) }, { immediate: true })
async function bewaar() {
  try { const r: any = await metHerbevestiging(() => $fetch('/api/platform/ai', { method: 'PUT', body: { provider: 'claude', ...(f.sleutel ? { sleutel: f.sleutel } : {}), regio: f.regio, geenTraining: f.geenTraining, modellen: f.modellen } })); f.sleutel = ''; toast.toon(r.tekst); await refresh() } catch (e: any) { if (!e?.geannuleerd) toast.toon(foutTekst(e), 'fout') }
}
// Platformmaximum per agent (F23, 11.3): nooit ruimer dan de standaard uit shared/mandaat.ts; de strengste
// van platform, organisatie, niveau en eigen mandaat telt. A is het meest autonoom, D altijd mens.
const { data: maxima, refresh: herlaadMaxima } = await useFetch<{ agent: string; naam: string; standaard: Mandaat; max: Mandaat }[]>('/api/platform/agentmaxima', { default: () => [] })
const omschrijving = (s: string) => AGENTS.find((a) => a.sleutel === s)?.omschrijving ?? ''
const gebouwd = (s: string) => AGENTS.find((a) => a.sleutel === s)?.gebouwd ?? true
const ruimer = (m: Mandaat, standaard: Mandaat) => strengste(m, standaard) !== m
const verlaagd = computed(() => maxima.value.filter((a) => a.max !== a.standaard).length)
async function zetMax(agent: string, naam: string, max: Mandaat) {
  try {
    await $fetch('/api/platform/agentmaxima', { method: 'PUT', body: { agent, max } })
    toast.toon(`${naam}: hooguit ${max} (${MANDAAT_LABEL[max]}).`)
    await herlaadMaxima()
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function test() { try { const r: any = await $fetch('/api/platform/ai/test', { method: 'POST', body: {} }); toast.toon(r.melding, r.ok ? undefined : 'fout') } catch (e) { toast.toon(foutTekst(e), 'fout') } }
useHead({ title: 'AI-koppeling · Platformbeheer · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Platformbeheer" titel="AI-koppeling" uitleg="Eerst de koppeling van de klant, dan die van het platform, dan de omgeving, anders de mock. Webonderzoek loopt alleen via Claude." />
    <section class="section section--laatste">
      <div class="container stapel">
        <article class="kaart" data-test="ai-platform">
          <header class="kaart-kop"><h2 class="kaart-titel">Platform · Claude</h2><span class="pil" :class="data.modus === 'mock' ? 'pil--leeg' : 'pil--groen'">{{ data.modus === 'mock' ? 'Mock (AI_PROVIDER=mock)' : 'Echt' }}</span></header>
          <p class="kaart-meta">Sleutel: {{ data.platform?.vingerafdruk ? `bewaard (${data.platform.vingerafdruk})` : data.omgeving ? 'uit de omgeving' : 'geen' }}. Verwerking in de EU, geen training op jullie gegevens.</p>
          <div class="formulier-raster mt-8">
            <label class="veld"><span class="veld-label">Nieuwe sleutel</span><input v-model="f.sleutel" class="invoer" type="password" autocomplete="off" placeholder="Plak de sleutel" data-test="ai-sleutel"></label>
            <label class="veld"><span class="veld-label">Verwerkingsregio</span><select v-model="f.regio" class="invoer"><option value="EU">EU</option></select></label>
            <label class="veld veld--rij"><input v-model="f.geenTraining" type="checkbox"> <span>Geen training op gegevens</span></label>
          </div>
          <details class="mt-8"><summary>Model per soort (standaard {{ data.standaardModel }})</summary>
            <div class="formulier-raster mt-8"><label v-for="s in data.soorten" :key="s.soort" class="veld"><span class="veld-label">{{ s.naam }}</span><input v-model="f.modellen[s.soort]" class="invoer" :placeholder="data.standaardModel"></label></div>
          </details>
          <div class="dd-acties mt-8"><button type="button" class="dd-act" data-test="ai-test" @click="test">Test verbinding</button><button type="button" class="dd-act dd-act--primair" data-test="ai-bewaar" @click="bewaar">Opslaan</button></div>
        </article>
        <article v-if="data.klanten.length" class="kaart"><h2 class="kaart-titel">Per klant</h2><p class="kaart-meta">Een eigen koppeling richt je in vanuit de klantflyout bij Klanten.</p>
          <ul class="schakel-lijst"><li v-for="k in data.klanten" :key="k.organisatieId" class="schakel-rij"><span>{{ k.klant }}</span><span class="meta">{{ k.provider }} · {{ k.vingerafdruk ?? 'geen sleutel' }}</span></li></ul></article>
        <article class="kaart" data-test="agentmaxima">
          <header class="kaart-kop"><h2 class="kaart-titel">Agentmaxima</h2><span class="meta">{{ verlaagd ? `${verlaagd} van ${maxima.length} verlaagd` : 'Alles op de standaard' }}</span></header>
          <p class="kaart-meta">Het hoogste mandaat dat een agent bij welke klant dan ook krijgt. A is autonoom, B binnen een goedgekeurd kader, C per stuk goedkeuren, D altijd mens. Ruimer dan de standaard kan niet; de klant kiest daarbinnen zijn eigen maximum.</p>
          <ul class="schakel-lijst mt-8">
            <li v-for="a in maxima" :key="a.agent" class="schakel-rij am-rij" :data-agent="a.agent">
              <div class="am-tekst">
                <span class="schakel-naam">{{ a.naam }}<span v-if="!gebouwd(a.agent)" class="pil pil--leeg">Komt later</span></span>
                <span class="veld-uitleg">{{ omschrijving(a.agent) }} Standaard {{ a.standaard }}<template v-if="a.max !== a.standaard">, nu verlaagd naar {{ a.max }}</template>.</span>
              </div>
              <div class="keuzegroep" role="group" :aria-label="`Maximum voor ${a.naam}`">
                <button
                  v-for="m in MANDATEN" :key="m" type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': a.max === m }"
                  :aria-pressed="a.max === m" :disabled="ruimer(m, a.standaard)" :title="ruimer(m, a.standaard) ? `Ruimer dan de standaard (${a.standaard})` : MANDAAT_LABEL[m]"
                  :data-test="`max-${a.agent}-${m}`" @click="a.max !== m && zetMax(a.agent, a.naam, m)"
                >{{ m }}</button>
              </div>
            </li>
          </ul>
        </article>
        <article class="kaart"><h2 class="kaart-titel">Modelprijzen</h2><p class="kaart-meta">In centen per miljoen tokens, met peildatum.</p>
          <table class="tabel tabel--kaarten mt-8"><thead><tr><th>Model</th><th>Invoer</th><th>Uitvoer</th><th>Peildatum</th></tr></thead>
            <tbody><tr v-for="p in data.prijzen" :key="p.model + p.peildatum"><td data-label="Model">{{ p.model }}</td><td data-label="Invoer" class="tnum">{{ p.invoer }}</td><td data-label="Uitvoer" class="tnum">{{ p.uitvoer }}</td><td data-label="Peildatum">{{ p.peildatum }}</td></tr></tbody></table></article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.am-rij { flex-wrap: wrap; }
.am-tekst { flex: 1 1 260px; min-width: 0; }
.keuzegroep-knop:disabled { cursor: not-allowed; opacity: 0.45; }
</style>
