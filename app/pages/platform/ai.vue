<script setup lang="ts">
// Platformbeheer · AI-koppeling (F23, 11.4): oplosketen organisatie, platform, omgeving, mock. Claude is de
// standaard. De sleutel is schrijf-alleen en verschijnt als vingerafdruk van acht tekens; een nieuwe sleutel
// vraagt herbevestiging. Modellen per soort en de modelprijzen met peildatum.
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
        <article v-if="data.klanten.length" class="kaart"><h2 class="kaart-titel">Per klant</h2>
          <ul class="schakel-lijst"><li v-for="k in data.klanten" :key="k.organisatieId" class="schakel-rij"><span>{{ k.klant }}</span><span class="meta">{{ k.provider }} · {{ k.vingerafdruk ?? 'geen sleutel' }}</span></li></ul></article>
        <article class="kaart"><h2 class="kaart-titel">Modelprijzen</h2><p class="kaart-meta">In centen per miljoen tokens, met peildatum.</p>
          <table class="tabel tabel--kaarten mt-8"><thead><tr><th>Model</th><th>Invoer</th><th>Uitvoer</th><th>Peildatum</th></tr></thead>
            <tbody><tr v-for="p in data.prijzen" :key="p.model + p.peildatum"><td data-label="Model">{{ p.model }}</td><td data-label="Invoer" class="tnum">{{ p.invoer }}</td><td data-label="Uitvoer" class="tnum">{{ p.uitvoer }}</td><td data-label="Peildatum">{{ p.peildatum }}</td></tr></tbody></table></article>
      </div>
    </section>
  </div>
</template>
