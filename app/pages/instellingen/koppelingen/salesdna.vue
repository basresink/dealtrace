<script setup lang="ts">
// Instellingen, Koppelingen, SalesDNA (P29, F25): koppelen met adres en geheim (alleen een
// vingerafdruk terug), bron per onderdeel met vergelijken en controlelijst, volledig
// synchroniseren, logboek van de laatste 50 berichten en ontkoppelen. Alleen de beheerder.
const { functie } = useMe()
if (!functie('koppeling.salesdna')?.beschikbaar) throw createError({ statusCode: 403, statusMessage: 'Alleen de beheerder koppelt SalesDNA' })
const toast = useToast()
const { data, refresh } = await useFetch<any>('/api/koppelingen/salesdna', { default: () => ({ gekoppeld: false, koppeling: null, onderdelen: [], logboek: [] }) })
const form = reactive({ endpoint: '', geheim: '' })
watch(() => data.value.koppeling?.endpoint, (e) => { if (e && !form.endpoint) form.endpoint = e }, { immediate: true })
const bezig = ref('')
const testUitslag = ref('')
const tijd = (d: string | null) => (d ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(d)) : 'nog niet')

const post = (url: string, body?: unknown): Promise<any> => ($fetch as any)(url, { method: 'POST', body })
async function doe(naam: string, werk: () => Promise<unknown>, klaar?: string) {
  bezig.value = naam
  try { await werk(); if (klaar) toast.toon(klaar); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = '' }
}
async function test() {
  testUitslag.value = ''
  bezig.value = 'test'
  try { const r: any = await post('/api/koppelingen/salesdna/test', form); testUitslag.value = r.tekst } catch (e) { testUitslag.value = foutTekst(e) } finally { bezig.value = '' }
}
const koppel = () => doe('koppel', () => post('/api/koppelingen/salesdna/koppel', form).then(() => { form.geheim = '' }), 'Gekoppeld. De volledige synchronisatie is gedaan.')
const sync = () => doe('sync', () => post('/api/koppelingen/salesdna/sync', {}), 'Volledig gesynchroniseerd.')
const ontkoppelVraag = ref(false)
const ontkoppel = () => doe('ontkoppel', () => post('/api/koppelingen/salesdna/ontkoppel').then(() => { ontkoppelVraag.value = false }), 'SalesDNA ontkoppeld. Alles staat nu in jullie eigen inrichting.')
const terugNaarEigen = (o: string) => doe(`bron-${o}`, () => post('/api/koppelingen/salesdna/bron', { onderdeel: o, bron: 'eigen' }), 'Terug naar eigen inrichting.')

// Vergelijken en overstappen
const vergelijking = ref<any>(null)
const akkoord = ref(false)
const mapping = ref<Record<string, string | null>>({})
async function vergelijk(o: string) {
  try {
    const url: string = `/api/koppelingen/salesdna/vergelijk/${o}`
    vergelijking.value = await ($fetch as any)(url)
    akkoord.value = false
    mapping.value = Object.fromEntries((vergelijking.value.controlelijst ?? []).map((r: any) => [r.eigenId, r.salesdnaId]))
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const wordBron = () => doe('bron', () => post('/api/koppelingen/salesdna/bron', { onderdeel: vergelijking.value.onderdeel, bron: 'salesdna', controlelijstBevestigd: akkoord.value, mapping: mapping.value }).then(() => { vergelijking.value = null }), 'SalesDNA is nu de bron.')
const VELDEN: Record<string, [string, string][]> = {
  golden_circle: [['waarom', 'Waarom'], ['hoe', 'Hoe'], ['wat', 'Wat']], bedrijfsverhaal: [['wieZijnWij', 'Wie zijn wij'], ['kernzin', 'Kernzin']],
  ambitie: [['ambitie', 'Ambitie'], ['visie', 'Visie'], ['missie', 'Missie']], waarde: [['kernbelofte', 'Kernbelofte'], ['waardestatement', 'Waardestatement']],
}
const regels = (c: any) => (c?.items ?? []).map((x: any) => x.naam ?? x.titel ?? x.reden).filter(Boolean)
const RESULTAAT: Record<string, string> = { verwerkt: 'Verwerkt', dubbel: 'Dubbel genegeerd', oud: 'Oude versie genegeerd', geweigerd: 'Geweigerd', fout: 'Fout', wacht: 'Wacht', synchronisatie: 'Via synchronisatie' }
const statusTekst = computed(() => {
  const k = data.value.koppeling
  if (!k || k.status === 'uit') return 'Niet gekoppeld'
  if (k.status === 'fout') return 'Er ging iets mis bij de laatste synchronisatie. Bekijk het logboek of koppel opnieuw.'
  return `Gekoppeld · laatste bericht ${tijd(k.laatsteEvent)} · laatste volledige synchronisatie ${tijd(k.laatsteVolledigeSync)}`
})
useHead({ title: 'SalesDNA · Koppelingen · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Instellingen · Koppelingen" titel="SalesDNA" uitleg="Het verkoopverhaal automatisch uit SalesDNA. Dealtrace leest alleen bevestigde versies en schrijft niets terug." helpartikel="koppelingen" />
    <section class="section section--laatste">
      <div class="container stapel">
        <p class="alleen-groot-melding kaart kaart--geel">Beter op een groot scherm.</p>
        <article class="kaart" data-test="sd-status">
          <h2 class="kaart-titel">Status</h2>
          <p class="kaart-meta" role="status">{{ statusTekst }}</p>
          <p v-if="data.koppeling?.vingerafdruk" class="meta mt-8">Geheim met vingerafdruk <code data-test="sd-vingerafdruk">{{ data.koppeling.vingerafdruk }}</code></p>
          <p v-if="data.webhookPad && data.gekoppeld" class="meta mt-8">Webhook-adres voor SalesDNA: <code>{{ data.webhookPad }}</code></p>
        </article>

        <form class="kaart" data-test="sd-koppel" @submit.prevent="koppel">
          <h2 class="kaart-titel">{{ data.gekoppeld ? 'Opnieuw koppelen' : 'Koppelen' }}</h2>
          <div class="vv-velden mt-8">
            <label class="veld"><span class="veld-label">Adres van SalesDNA</span><input v-model="form.endpoint" class="invoer" placeholder="https://salesdna.voorbeeld.test" data-test="sd-adres"></label>
            <label class="veld"><span class="veld-label">Geheim</span><input v-model="form.geheim" type="password" autocomplete="off" class="invoer" :placeholder="data.koppeling?.vingerafdruk ? 'Bewaard; laat leeg om te houden' : ''" data-test="sd-geheim"></label>
          </div>
          <p class="meta mt-8">Lokaal en in de testomgeving werkt het adres <code>mock</code>: dan levert Dealtrace zelf de voorbeeldinhoud van Voltvast.</p>
          <div class="mt-8">
            <button type="button" class="dd-act" :disabled="!!bezig" data-test="sd-test" @click="test">Test verbinding</button>
            <button type="submit" class="dd-act dd-act--primair" :disabled="!!bezig || !form.endpoint" data-test="sd-koppelen">Koppelen</button>
            <span v-if="testUitslag" class="meta" role="status" data-test="sd-testuitslag"> {{ testUitslag }}</span>
          </div>
        </form>

        <article v-if="data.gekoppeld" class="kaart" data-test="sd-onderdelen">
          <header class="rij-tussen"><h2 class="kaart-titel">Bron per onderdeel</h2>
            <button type="button" class="dd-act" :disabled="!!bezig" data-test="sd-sync" @click="sync">Nu volledig synchroniseren</button></header>
          <div class="tabel-wrap mt-8">
            <table class="tabel tabel--kaarten">
              <thead><tr><th>Onderdeel</th><th>Bron</th><th>In SalesDNA</th><th /></tr></thead>
              <tbody>
                <tr v-for="o in data.onderdelen" :key="o.onderdeel" :data-test="`sd-rij-${o.onderdeel}`">
                  <td data-label="Onderdeel">{{ o.label }}</td>
                  <td data-label="Bron">{{ o.bron === 'salesdna' ? 'SalesDNA' : 'Eigen inrichting' }}</td>
                  <td data-label="In SalesDNA">
                    <template v-if="o.spiegel?.status === 'bevestigd'">Bevestigd · versie {{ o.spiegel.versie }}<span v-if="o.spiegel.verouderd" class="pil pil--oranje"> Mogelijk verouderd</span></template>
                    <template v-else-if="o.spiegel">{{ o.spiegel.status === 'leeg' ? 'Leeg' : 'Overgeslagen' }}</template>
                    <span v-else class="meta">Nog niets ontvangen</span>
                  </td>
                  <td>
                    <button v-if="o.bron === 'salesdna'" type="button" class="dd-act" :disabled="!!bezig" :data-test="`sd-eigen-${o.onderdeel}`" @click="terugNaarEigen(o.onderdeel)">Terug naar eigen inrichting</button>
                    <button v-else-if="o.spiegel?.status === 'bevestigd'" type="button" class="dd-act" :data-test="`sd-vergelijk-${o.onderdeel}`" @click="vergelijk(o.onderdeel)">Eerst vergelijken</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>

        <article v-if="data.logboek.length" class="kaart" data-test="sd-logboek">
          <h2 class="kaart-titel">Logboek</h2>
          <div class="tabel-wrap mt-8">
            <table class="tabel tabel--kaarten">
              <thead><tr><th>Tijd</th><th>Soort</th><th>Onderdeel</th><th>Versie</th><th>Resultaat</th></tr></thead>
              <tbody>
                <tr v-for="e in data.logboek" :key="e.id" data-test="sd-logregel">
                  <td data-label="Tijd">{{ tijd(e.op) }}</td><td data-label="Soort">{{ e.soort }}</td><td data-label="Onderdeel">{{ e.onderwerpId ?? '' }}</td><td data-label="Versie">{{ e.versie ?? '' }}</td>
                  <td data-label="Resultaat">{{ RESULTAAT[e.resultaat] ?? e.resultaat }}<span v-if="e.fout" class="meta"> · {{ e.fout }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>

        <article v-if="data.gekoppeld" class="kaart">
          <h2 class="kaart-titel">Ontkoppelen</h2>
          <p class="kaart-meta">De laatst bevestigde inhoud uit SalesDNA blijft staan in jullie eigen inrichting.</p>
          <button v-if="!ontkoppelVraag" type="button" class="dd-act mt-8" data-test="sd-ontkoppel" @click="ontkoppelVraag = true">Ontkoppelen</button>
          <div v-else class="kaart kaart--geel mt-8" role="alertdialog" data-test="sd-ontkoppel-vraag">
            <p>SalesDNA ontkoppelen? De laatst bevestigde inhoud wordt gekopieerd naar jullie eigen inrichting. Daarna kun je hem zelf bewerken.</p>
            <div class="mt-8"><button type="button" class="dd-act dd-act--primair" :disabled="!!bezig" data-test="sd-ontkoppel-ja" @click="ontkoppel">Ontkoppelen</button> <button type="button" class="dd-act" @click="ontkoppelVraag = false">Annuleren</button></div>
          </div>
        </article>
      </div>
    </section>

    <div v-if="vergelijking" class="fo-overlay" @click.self="vergelijking = null">
      <section class="fo-panel fo-panel--hulp" role="dialog" aria-modal="true" data-test="sd-vergelijk">
        <header class="fo-head"><div class="fo-head-tekst"><span class="fo-kicker">Vergelijken</span><h2 class="fo-titel">{{ vergelijking.label }}</h2></div><button type="button" class="fo-sluit" aria-label="Sluiten" @click="vergelijking = null"><Icoon naam="X" /></button></header>
        <div class="fo-body">
          <div class="vv-velden">
            <div><h3 class="kaart-titel">Eigen inrichting</h3>
              <template v-if="VELDEN[vergelijking.onderdeel]"><p v-for="[k, l] in VELDEN[vergelijking.onderdeel]" :key="k" class="mt-8"><strong>{{ l }}</strong><br>{{ vergelijking.eigen?.[k] || '(leeg)' }}</p></template>
              <ul v-else class="mt-8"><li v-for="n in regels(vergelijking.eigen)" :key="n">{{ n }}</li></ul></div>
            <div><h3 class="kaart-titel">SalesDNA · versie {{ vergelijking.spiegel?.versie }}</h3>
              <template v-if="VELDEN[vergelijking.onderdeel]"><p v-for="[k, l] in VELDEN[vergelijking.onderdeel]" :key="k" class="mt-8"><strong>{{ l }}</strong><br>{{ vergelijking.salesdna?.[k] || '(leeg)' }}</p></template>
              <ul v-else class="mt-8"><li v-for="n in regels(vergelijking.salesdna)" :key="n">{{ n }}</li></ul></div>
          </div>
          <template v-if="vergelijking.controlelijst.length">
            <h3 class="kaart-titel mt-16">Controlelijst</h3>
            <div v-for="r in vergelijking.controlelijst" :key="r.eigenId" class="vv-regel" data-test="sd-controle">
              <span><strong>{{ r.eigenNaam }}</strong><span v-if="r.accounts" class="meta"> · {{ r.accounts }} accounts</span></span>
              <select v-model="mapping[r.eigenId]" class="invoer"><option :value="null">Niet koppelen</option><option v-for="x in vergelijking.salesdna.items" :key="x.id" :value="x.id">{{ x.naam ?? x.titel }} ({{ x.id }})</option></select>
              <span class="meta">{{ r.op === 'id' ? 'Zelfde id' : r.op === 'naam' ? 'Gekoppeld op naam' : 'Geen match gevonden' }}</span>
            </div>
          </template>
          <label class="mt-16 rijtje"><input v-model="akkoord" type="checkbox" data-test="sd-akkoord"> Ik heb de verschillen{{ vergelijking.controlelijst.length ? ' en de controlelijst' : '' }} gecontroleerd. De eigen inhoud gaat naar het archief.</label>
        </div>
        <footer class="fo-foot dd-acties"><button type="button" class="dd-act dd-act--primair" :disabled="!akkoord || !!bezig" data-test="sd-word-bron" @click="wordBron">SalesDNA wordt de bron</button><span class="dd-acties-vul fo-foot-vul" /><button type="button" class="dd-act" @click="vergelijking = null">Annuleren</button></footer>
      </section>
    </div>
  </div>
</template>
