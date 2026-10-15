<script setup lang="ts">
// Helpcenter (F21): zoeken, "Voor jou", "Hoe werkt Dealtrace", "New business" en
// "Nieuw en bijgewerkt". Geen voortgang, geen teller, geen leerpaden (B19).
import { CATEGORIEEN_NEWBUSINESS, CATEGORIEEN_PRODUCT } from '~~/shared/help'
const route = useRoute()
const router = useRouter()
const zoek = ref(typeof route.query.zoek === 'string' ? route.query.zoek : '')
const { data } = await useFetch<any>('/api/help', { query: computed(() => ({ zoek: route.query.zoek, collectie: route.query.collectie, niveau: route.query.niveau })), default: () => ({ artikelen: [], resultaten: null, voorJou: { nieuw: [], aanDeSlag: [], bijgewerkt: [] }, kan: {} }) })
const { functie } = useMe()
const aiAan = computed(() => !!functie('assistent.chat')?.beschikbaar)
const { openen: openAi } = useAssistent()
let timer: any
watch(zoek, (z) => { clearTimeout(timer); timer = setTimeout(() => router.replace({ query: { ...route.query, zoek: z.trim() || undefined } }), 300) })
const product = computed(() => CATEGORIEEN_PRODUCT.map((c) => ({ naam: c, artikelen: data.value.artikelen.filter((a: any) => a.collectie === 'product' && a.categorie === c) })).filter((c) => c.artikelen.length))
const newbusiness = computed(() => CATEGORIEEN_NEWBUSINESS.map((c) => ({ naam: c, artikelen: data.value.artikelen.filter((a: any) => a.collectie === 'newbusiness' && a.categorie === c) })))
const resultatenPerCollectie = computed(() => data.value.resultaten ? [['Hoe werkt Dealtrace', 'product'], ['New business', 'newbusiness']].map(([naam, c]) => ({ naam, artikelen: data.value.resultaten.filter((a: any) => a.collectie === c) })).filter((g) => g.artikelen.length) : [])
useHead({ title: 'Helpcenter · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Helpcenter" titel="Waar kunnen we je mee helpen?" uitleg="Uitleg over elk scherm en over new business." helpartikel="helpcenter" />
    <section class="section section--laatste">
      <div class="container">
        <label class="veld"><span class="sr-only">Zoeken in het helpcenter</span><input v-model="zoek" type="search" class="invoer help-zoek" placeholder="Waar kunnen we je mee helpen?" data-test="help-zoek"></label>

        <template v-if="data.resultaten">
          <div class="mt-16" data-test="help-resultaten">
            <p v-if="!data.resultaten.length" class="kaart kaart--vlak">Daar staat nog niets over in het helpcenter. Probeer een ander woord of vraag het de AI-assistent.</p>
            <article v-if="aiAan" class="kaart kaart--vlak mt-8" data-test="help-vraag-ai"><p>Vraag het de AI-assistent: hij zoekt in het helpcenter en noemt het artikel erbij.</p>
              <button type="button" class="dd-act dd-act--primair mt-8" @click="openAi({ label: 'Helpcenter', route: '/help', accountId: null, vraag: zoek })"><Icoon naam="Sparkles" class="dd-actie-icoon" />Vraag AI</button></article>
            <div v-for="g in resultatenPerCollectie" :key="g.naam" class="mt-16">
              <span class="kicker kicker--streep">{{ g.naam }}</span>
              <ul class="help-lijst mt-8"><li v-for="a in g.artikelen" :key="a.id"><NuxtLink :to="`/help/${a.slug}`"><strong>{{ a.titel }}</strong></NuxtLink><span class="meta">{{ a.samenvatting }}</span></li></ul>
            </div>
          </div>
        </template>

        <template v-else>
          <article class="kaart mt-16" data-test="voor-jou">
            <h2 class="kaart-titel">Voor jou</h2>
            <ul class="help-lijst mt-8">
              <li v-for="a in data.voorJou.nieuw" :key="a.id" data-test="voor-jou-nieuw"><span class="pil pil--leeg">nieuw</span><NuxtLink :to="`/help/${a.slug}`">{{ a.titel }}</NuxtLink><Icoon v-if="a.gelezen" naam="CircleCheck" class="help-vinkje" :grootte="16" /></li>
            </ul>
            <template v-if="data.voorJou.aanDeSlag.length">
              <h3 class="kaart-meta mt-16">Aan de slag</h3>
              <ul class="help-lijst" data-test="aan-de-slag">
                <li v-for="a in data.voorJou.aanDeSlag" :key="a.id" :data-test="`aan-de-slag-${a.slug}`"><NuxtLink :to="`/help/${a.slug}`">{{ a.titel }}</NuxtLink><Icoon v-if="a.gelezen" naam="CircleCheck" class="help-vinkje" :grootte="16" data-test="gelezen-vinkje" /></li>
              </ul>
            </template>
          </article>

          <span class="kicker kicker--streep mt-24">Hoe werkt Dealtrace</span>
          <div class="help-raster mt-8">
            <article v-for="c in product" :key="c.naam" class="kaart" :data-test="`categorie-${c.naam}`">
              <h2 class="kaart-titel">{{ c.naam }}</h2>
              <ul class="help-lijst mt-8"><li v-for="a in c.artikelen" :key="a.id"><NuxtLink :to="`/help/${a.slug}`">{{ a.titel }}</NuxtLink><Icoon v-if="a.gelezen" naam="CircleCheck" class="help-vinkje" :grootte="16" /></li></ul>
            </article>
          </div>

          <span class="kicker kicker--streep mt-24">New business</span>
          <div class="help-raster mt-8">
            <article v-for="c in newbusiness" :key="c.naam" class="kaart kaart--vlak">
              <h2 class="kaart-titel">{{ c.naam }}</h2>
              <ul v-if="c.artikelen.length" class="help-lijst mt-8"><li v-for="a in c.artikelen" :key="a.id"><NuxtLink :to="`/help/${a.slug}`">{{ a.titel }}</NuxtLink></li></ul>
              <p v-else class="kaart-meta">De artikelen volgen met de academie.</p>
            </article>
          </div>

          <article class="kaart mt-24" data-test="bijgewerkt">
            <h2 class="kaart-titel">Nieuw en bijgewerkt</h2>
            <ul class="help-lijst mt-8"><li v-for="a in data.voorJou.bijgewerkt" :key="a.id"><NuxtLink :to="`/help/${a.slug}`">{{ a.titel }}</NuxtLink></li></ul>
          </article>
        </template>
      </div>
    </section>
  </div>
</template>
