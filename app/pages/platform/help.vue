<script setup lang="ts">
// Platformbeheer · Help-artikelen (F21, F23): de platformartikelen met versie, statistiek over alle organisaties
// en de editor met versies; het tabblad Vragen toont wat mensen vroegen of zochten zonder antwoord.
const { me } = useMe()
if (me.value?.echteRol !== 'founder') throw createError({ statusCode: 404, statusMessage: 'Deze pagina bestaat niet' })
const route = useRoute()
const router = useRouter()
const toast = useToast()
const tab = computed(() => (route.query.tab as string) || 'artikelen')
const { data, refresh } = await useFetch<any>('/api/platform/help', { default: () => ({ artikelen: [], vragen: [] }) })
const zoek = ref('')
const lijst = computed(() => data.value.artikelen.filter((a: any) => !zoek.value || a.titel.toLowerCase().includes(zoek.value.toLowerCase())))
const bewerk = ref<any | null>(null)
async function open(a: any) { try { bewerk.value = await $fetch(`/api/platform/help/${a.slug}`) } catch (e) { toast.toon(foutTekst(e), 'fout') } }
const moment = (s: string) => new Date(s).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
useHead({ title: 'Help-artikelen · Platformbeheer · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Platformbeheer" :titel="`${data.artikelen.length} platformartikelen`" uitleg="Artikelen voor alle organisaties. content/help in de repository blijft de bron; een wijziging hier geldt tot een volgende wijziging van hetzelfde bestand." />
    <section class="section section--laatste">
      <div class="container stapel">
        <template v-if="bewerk">
          <HelpEditor :key="bewerk.id + bewerk.versie" :artikel="bewerk" :bewaar-url="`/api/platform/help/${bewerk.slug}`" methode="PUT" platform @bewaard="bewerk = null; refresh()" @sluit="bewerk = null" />
          <article class="kaart"><h2 class="kaart-titel">Versies</h2><ul class="schakel-lijst"><li v-for="v in bewerk.versies" :key="v.versie" class="schakel-rij"><span>Versie {{ v.versie }} · {{ v.titel }}</span><span class="meta">{{ v.door }} · {{ moment(v.op) }}</span></li></ul><p v-if="!bewerk.versies.length" class="kaart-meta">Nog alleen de versie uit content/help.</p></article>
        </template>
        <nav class="tabbalk" aria-label="Help"><button v-for="[k, l] in [['artikelen', 'Artikelen'], ['vragen', 'Vragen zonder antwoord']]" :key="k" type="button" class="tab" :class="{ 'tab--actief': tab === k }" @click="router.replace({ query: { tab: k } })">{{ l }}</button></nav>
        <template v-if="tab === 'artikelen'">
          <input v-model="zoek" class="invoer" type="search" placeholder="Zoek op titel" aria-label="Zoek artikel">
          <table class="tabel tabel--kaarten"><thead><tr><th>Titel</th><th>Categorie</th><th>Status</th><th>Versie</th><th>Gelezen</th><th>Nuttig</th><th /></tr></thead>
            <tbody><tr v-for="a in lijst" :key="a.slug"><td data-label="Titel"><NuxtLink :to="`/help/${a.slug}`">{{ a.titel }}</NuxtLink></td><td data-label="Categorie">{{ a.categorie }}</td><td data-label="Status">{{ a.status }}</td><td data-label="Versie" class="tnum">{{ a.versie }}</td>
              <td data-label="Gelezen" class="tnum">{{ a.gelezen }}</td><td data-label="Nuttig" class="tnum">{{ a.nuttig }} ja · {{ a.nietNuttig }} nee</td><td><button type="button" class="dd-act" @click="open(a)">Bewerk</button></td></tr></tbody></table>
        </template>
        <article v-else class="kaart" data-test="vragen-zonder-antwoord"><p class="kaart-meta">Signaal voor een nieuw artikel. Zonder namen van personen of prospects.</p>
          <p v-if="!data.vragen.length" class="kaart-meta">Niets.</p>
          <ul class="schakel-lijst"><li v-for="(v, i) in data.vragen" :key="i" class="schakel-rij"><span>{{ v.term }}</span><span class="meta">{{ v.klant }} · {{ v.soort === 'vraag' ? 'vraag aan de AI' : 'zoekterm' }} · {{ moment(v.op) }}</span></li></ul></article>
      </div>
    </section>
  </div>
</template>
