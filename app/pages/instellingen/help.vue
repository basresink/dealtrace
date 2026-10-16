<script setup lang="ts">
// Instellingen · Helpartikelen (F21): de beheerlijst (platform en eigen, met gelezen en nuttig), eigen artikelen
// schrijven met de editor, platformartikelen verbergen, de statistiek (zoektermen en vragen zonder antwoord)
// en de eigen kennisbank als bron voor de AI-assistent.
const { functie } = useMe()
const aan = computed(() => !!functie('help.eigenArtikelen')?.beschikbaar)
const kennisbankAan = computed(() => !!functie('help.kennisbankBron')?.beschikbaar)
const route = useRoute()
const router = useRouter()
const toast = useToast()
const tab = computed(() => (route.query.tab as string) || 'artikelen')
const filter = computed(() => ({ collectie: route.query.collectie || undefined, herkomst: route.query.herkomst || undefined }))
const { data, refresh } = await useFetch<any>('/api/help/beheer', { query: filter, immediate: aan.value, default: () => ({ artikelen: [], kennisbank: false }) })
const { data: stat } = await useFetch<any>('/api/help/statistiek', { immediate: aan.value, default: () => ({ zonderResultaat: [], nietNuttig: [] }) })
const zet = (k: string, v: string) => router.replace({ query: { ...route.query, [k]: v || undefined } })
const bewerk = ref<any | null>(null)
async function open(a: any) {
  if (a === 'nieuw') { bewerk.value = { nieuw: true }; return }
  try { bewerk.value = await $fetch(`/api/help/${a.slug}`) } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function verberg(a: any) {
  try { await $fetch(`/api/help/${a.id}/verbergen`, { method: 'POST', body: { verborgen: !a.verborgen } }); toast.toon(a.verborgen ? 'Het artikel is weer zichtbaar.' : 'Het artikel is verborgen voor jullie organisatie.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function zetKennisbank(w: boolean) {
  try { const r: any = await $fetch('/api/help/kennisbank', { method: 'PUT', body: { aan: w } }); toast.toon(r.tekst); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const STATUS: Record<string, string> = { concept: 'Concept', gepubliceerd: 'Gepubliceerd' }
useHead({ title: 'Helpartikelen · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="help.eigenArtikelen" />
    <template v-else>
      <PaginaKop kicker="Instellingen · Helpcenter" titel="Helpartikelen" uitleg="Schrijf eigen artikelen voor jullie organisatie, verberg wat niet past en zie wat mensen zoeken zonder antwoord." helpartikel="gebruikers-rollen-niveaus">
        <template #acties><button type="button" class="dd-actie dd-actie--primair" data-test="help-nieuw" @click="open('nieuw')"><Icoon naam="Plus" class="dd-actie-icoon" />Nieuw artikel</button></template>
      </PaginaKop>
      <section class="section section--laatste">
        <div class="container stapel">
          <HelpEditor v-if="bewerk" :key="bewerk.id ?? 'nieuw'" :artikel="bewerk.nieuw ? null : bewerk" :bewaar-url="bewerk.nieuw ? '/api/help' : `/api/help/${bewerk.id}`" :methode="bewerk.nieuw ? 'POST' : 'PUT'" @bewaard="bewerk = null; refresh()" @sluit="bewerk = null" />
          <nav class="tabbalk" aria-label="Helpartikelen"><button v-for="[k, l] in [['artikelen', 'Artikelen'], ['statistiek', 'Statistiek']]" :key="k" type="button" class="tab" :class="{ 'tab--actief': tab === k }" @click="zet('tab', k)">{{ l }}</button></nav>
          <template v-if="tab === 'artikelen'">
            <div class="chips">
              <button v-for="[k, l] in [['', 'Alle'], ['eigen', 'Eigen'], ['platform', 'Van Dealtrace']]" :key="k" type="button" class="filter-pil" :class="{ 'filter-pil--aan': (route.query.herkomst ?? '') === k }" @click="zet('herkomst', k)">{{ l }}</button>
              <button v-for="[k, l] in [['product', 'Hoe werkt Dealtrace'], ['newbusiness', 'New business']]" :key="k" type="button" class="filter-pil" :class="{ 'filter-pil--aan': route.query.collectie === k }" @click="zet('collectie', route.query.collectie === k ? '' : k)">{{ l }}</button>
            </div>
            <article v-if="kennisbankAan" class="kaart" data-test="kennisbank"><label class="veld veld--rij"><input type="checkbox" :checked="data.kennisbank" @change="zetKennisbank(($event.target as HTMLInputElement).checked)"> <span>Eigen artikelen gebruiken als bron voor de AI-assistent</span></label></article>
            <table class="tabel tabel--kaarten" data-test="help-beheerlijst"><thead><tr><th>Titel</th><th>Categorie</th><th>Herkomst</th><th>Status</th><th>Gelezen</th><th>Nuttig</th><th /></tr></thead>
              <tbody><tr v-for="a in data.artikelen" :key="a.id" :class="{ 'rij--grijs': a.verborgen }">
                <td data-label="Titel"><NuxtLink :to="`/helpcenter/${a.slug}`">{{ a.titel }}</NuxtLink></td><td data-label="Categorie">{{ a.categorie }}</td>
                <td data-label="Herkomst">{{ a.herkomst === 'eigen' ? 'Eigen' : 'Dealtrace' }}</td><td data-label="Status">{{ a.verborgen ? 'Verborgen' : STATUS[a.status] }}</td>
                <td data-label="Gelezen" class="tnum">{{ a.gelezen }}</td><td data-label="Nuttig" class="tnum">{{ a.nuttig }} ja · {{ a.nietNuttig }} nee</td>
                <td><button v-if="a.herkomst === 'eigen'" type="button" class="dd-act" @click="open(a)">Bewerk</button><button v-else type="button" class="dd-act" :data-test="`verberg-${a.slug}`" @click="verberg(a)">{{ a.verborgen ? 'Toon' : 'Verberg' }}</button></td>
              </tr></tbody></table>
          </template>
          <template v-else>
            <article class="kaart" data-test="zonder-antwoord"><h2 class="kaart-titel">Gezocht of gevraagd zonder antwoord</h2><p v-if="!stat.zonderResultaat.length" class="kaart-meta">Niets. Iedereen vond wat hij zocht.</p>
              <ul class="schakel-lijst"><li v-for="z in stat.zonderResultaat" :key="z.term + z.soort" class="schakel-rij"><span>{{ z.term }}</span><span class="meta">{{ z.soort === 'vraag' ? 'vraag aan de AI' : 'zoekterm' }} · {{ z.aantal }}×</span></li></ul></article>
            <article class="kaart"><h2 class="kaart-titel">Niet nuttig</h2><p v-if="!stat.nietNuttig.length" class="kaart-meta">Nog geen.</p>
              <ul class="schakel-lijst"><li v-for="n in stat.nietNuttig" :key="n.slug + n.reden" class="schakel-rij"><NuxtLink :to="`/helpcenter/${n.slug}`">{{ n.titel }}</NuxtLink><span class="meta">{{ n.reden ?? 'zonder reden' }} · {{ n.aantal }}×</span></li></ul></article>
          </template>
        </div>
      </section>
    </template>
  </div>
</template>
