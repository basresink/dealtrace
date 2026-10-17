<script setup lang="ts">
// Helpcenter (F21, P25) in de opzet van DealDrive: kop met rechtsboven een zoekicoon dat een zoekveld onder
// de kop uitklapt (?zoek= in de URL), "Voor jou" en "Nieuw en bijgewerkt", de ingangen (Hoe werkt Dealtrace,
// de academie met Nieuwe klanten werven, Tips & Tricks en de Kennisbank) als kaarten met een gele rand, en de categorieën.
// Een categorie opent /helpcenter/categorie/<naam>, een artikel /helpcenter/<slug>.
// Geen voortgang, geen teller, geen leerpaden (B19).
import { CATEGORIE_UITLEG, CATEGORIEEN_NEWBUSINESS, CATEGORIEEN_PRODUCT, CATEGORIEEN_TIPS, CATEGORIEEN_WERVEN, COLLECTIES, type HelpCollectie, categorieLink, helpLink } from '~~/shared/help'
const route = useRoute()
const router = useRouter()
const zoek = ref(typeof route.query.zoek === 'string' ? route.query.zoek : '')
// Het zoekveld klapt uit onder de kop: open met het icoon, of vanzelf als de URL een zoekterm heeft.
const zoekOpen = ref(!!zoek.value)
const zoekInvoer = ref<HTMLInputElement>()
async function openZoeken() { zoekOpen.value = true; await nextTick(); zoekInvoer.value?.focus() }
function wisselZoeken() { if (zoekOpen.value && !zoek.value.trim()) zoekOpen.value = false; else void openZoeken() }
function sluitZoeken() { zoek.value = ''; zoekOpen.value = false }
const { data } = await useFetch<any>('/api/help', { query: computed(() => ({ zoek: route.query.zoek, collectie: route.query.collectie, niveau: route.query.niveau })), default: () => ({ artikelen: [], resultaten: null, voorJou: { nieuw: [], aanDeSlag: [], bijgewerkt: [] }, kan: {} }) })
const { functie } = useMe()
const aiAan = computed(() => !!functie('assistent.chat')?.beschikbaar)
const beheerAan = computed(() => !!functie('help.eigenArtikelen')?.beschikbaar)
// De kennisbank staat niet meer in het hoofdmenu; hier is de ingang (de pagina legt uit wanneer hij nog niet aanstaat).
const kennisbankAan = computed(() => !!functie('nav.kennisbank')?.beschikbaar)
const { openen: openAi } = useAssistent()
let timer: ReturnType<typeof setTimeout> | undefined
watch(zoek, (z) => { clearTimeout(timer); timer = setTimeout(() => router.replace({ query: { ...route.query, zoek: z.trim() || undefined } }), 300) })
watch(() => route.query.zoek, (z) => { if ((typeof z === 'string' ? z : '') !== zoek.value.trim()) zoek.value = typeof z === 'string' ? z : ''; if (z) zoekOpen.value = true })

const perCategorie = (collectie: string, namen: readonly string[]) => namen.map((naam) => ({ naam, artikelen: data.value.artikelen.filter((a: any) => a.collectie === collectie && a.categorie === naam) }))
// Inrichten en Voor de salesmanager laat de server alleen zien aan wie ze mag lezen; een lege productcategorie valt weg.
const product = computed(() => perCategorie('product', CATEGORIEEN_PRODUCT).filter((c) => c.artikelen.length))
// De academie: het vak en het hoofdstuk Nieuwe klanten werven; een categorie zonder artikelen staat er rustig bij.
const newbusiness = computed(() => perCategorie('newbusiness', CATEGORIEEN_NEWBUSINESS))
const isWerven = (naam: string) => (CATEGORIEEN_WERVEN as readonly string[]).includes(naam)
const tips = computed(() => perCategorie('tips', CATEGORIEEN_TIPS).filter((c) => c.artikelen.length))
const aantal = (collectie: string) => data.value.artikelen.filter((a: any) => a.collectie === collectie).length
const resultatenPerCollectie = computed(() => data.value.resultaten ? (Object.keys(COLLECTIES) as HelpCollectie[]).map((c) => ({ naam: COLLECTIES[c].naam, artikelen: data.value.resultaten.filter((a: any) => a.collectie === c) })).filter((g) => g.artikelen.length) : [])
useHead({ title: 'Helpcenter · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Ondersteuning" titel="Helpcenter" uitleg="Uitleg over elk scherm, de new business-academie en tips om slimmer te werken. Kom je er niet uit? Vraag de AI-assistent of mail support." helpartikel="helpcenter" :zoeken="{ actie: wisselZoeken, aan: zoekOpen, label: 'Zoeken in het helpcenter', test: 'help-zoekicoon', controls: 'hc-zoekpaneel' }">
      <template #acties>
        <FunctieLink v-if="beheerAan" to="/instellingen/help" class="dd-actie dd-actie--secundair" data-test="help-beheer"><Icoon naam="Pencil" class="dd-actie-icoon" />Artikelen beheren</FunctieLink>
      </template>
      <template #na>
        <div v-if="zoekOpen" id="hc-zoekpaneel" class="hc-zoekrij" role="search" data-test="help-zoekpaneel">
          <label class="hc-zoekveld"><span class="sr-only">Zoeken in het helpcenter</span><Icoon naam="Search" :grootte="18" class="hc-zoekicoon" />
            <input ref="zoekInvoer" v-model="zoek" type="search" class="hc-zoek" placeholder="Zoek op onderwerp, bijvoorbeeld belblok, briefing of poging" data-test="help-zoek" @keydown.esc="sluitZoeken"></label>
          <span v-if="data.resultaten" class="hc-telling tnum">{{ data.resultaten.length }} {{ data.resultaten.length === 1 ? 'artikel' : 'artikelen' }}</span>
          <button type="button" class="dd-actie dd-actie--icoon hc-zoeksluit" aria-label="Zoeken sluiten" title="Zoeken sluiten" data-test="help-zoek-sluit" @click="sluitZoeken"><Icoon naam="X" /></button>
        </div>
      </template>
    </PaginaKop>
    <section class="section hc-sectie">
      <div class="container">

        <div v-if="data.resultaten" data-test="help-resultaten">
          <p v-if="!data.resultaten.length" class="hc-leeg">Daar staat nog niets over in het helpcenter. Probeer een ander woord of vraag het de AI-assistent.</p>
          <div v-if="aiAan" class="hc-ai" data-test="help-vraag-ai">
            <p>Vraag het de AI-assistent: hij zoekt in het helpcenter en noemt het artikel erbij.</p>
            <button type="button" class="dd-actie dd-actie--zwart" @click="openAi({ label: 'Helpcenter', route: '/helpcenter', accountId: null, vraag: zoek })"><Icoon naam="Sparkles" class="dd-actie-icoon" />Vraag AI</button>
          </div>
          <HelpGroep v-for="g in resultatenPerCollectie" :key="g.naam" :titel="g.naam" class="mt-24">
            <HelpKaart v-for="a in g.artikelen" :key="a.id" :artikel="a" met-categorie />
          </HelpGroep>
        </div>

        <template v-else>
          <div class="hc-duo">
            <article class="hc-blok" data-test="voor-jou">
              <h2 class="hc-blok-titel">Voor jou</h2>
              <ul v-if="data.voorJou.nieuw.length" class="hc-lijst">
                <li v-for="a in data.voorJou.nieuw" :key="a.id" data-test="voor-jou-nieuw"><span class="pil pil--geel">nieuw</span><NuxtLink :to="helpLink(a.slug)">{{ a.titel }}</NuxtLink><Icoon v-if="a.gelezen" naam="CircleCheck" class="hc-vinkje" :grootte="16" /></li>
              </ul>
              <template v-if="data.voorJou.aanDeSlag.length">
                <h3 class="hc-blok-sub">Aan de slag</h3>
                <ul class="hc-lijst" data-test="aan-de-slag">
                  <li v-for="a in data.voorJou.aanDeSlag" :key="a.id" :data-test="`aan-de-slag-${a.slug}`"><NuxtLink :to="helpLink(a.slug)">{{ a.titel }}</NuxtLink><Icoon v-if="a.gelezen" naam="CircleCheck" class="hc-vinkje" :grootte="16" data-test="gelezen-vinkje" /></li>
                </ul>
              </template>
              <p v-if="!data.voorJou.nieuw.length && !data.voorJou.aanDeSlag.length" class="hc-blok-tekst">Je hebt de eerste stappen gezet. Hiernaast staat wat er nieuw is.</p>
            </article>
            <article class="hc-blok" data-test="bijgewerkt">
              <h2 class="hc-blok-titel">Nieuw en bijgewerkt</h2>
              <ul class="hc-lijst"><li v-for="a in data.voorJou.bijgewerkt" :key="a.id"><NuxtLink :to="helpLink(a.slug)">{{ a.titel }}</NuxtLink><Icoon v-if="a.gelezen" naam="CircleCheck" class="hc-vinkje" :grootte="16" /></li></ul>
            </article>
          </div>

          <div class="hc-ingangen">
            <NuxtLink to="/helpcenter/instructies" class="hc-ingang" data-test="ingang-instructies">
              <span class="hc-ingang-label">{{ aantal('product') }} artikelen</span>
              <h2 class="hc-ingang-titel">Hoe werkt Dealtrace</h2>
              <p class="hc-ingang-tekst">Stap voor stap door Dealtrace: je dag beginnen, bellen, bezoeken, plannen en meer. Je ziet alleen wat voor jouw rol van toepassing is.</p>
              <span class="hc-cta">Open de instructies</span>
            </NuxtLink>
            <NuxtLink to="/helpcenter/academie" class="hc-ingang" data-test="ingang-academie">
              <span class="hc-ingang-label">{{ aantal('newbusiness') }} artikelen</span>
              <h2 class="hc-ingang-titel">New business-academie</h2>
              <p class="hc-ingang-tekst">Het vak zelf en nieuwe klanten werven: waarom het werkt, zo doe je het, een voorbeeld, de valkuilen en drie controlevragen voor jezelf.</p>
              <span class="hc-cta">Open de academie</span>
            </NuxtLink>
            <NuxtLink to="/helpcenter/tips" class="hc-ingang" data-test="ingang-tips">
              <span class="hc-ingang-label">{{ aantal('tips') }} tips</span>
              <h2 class="hc-ingang-titel">Tips &amp; Tricks</h2>
              <p class="hc-ingang-tekst">Van het DealDrive-team: korte tips die je direct tijd schelen, van je dag starten tot offline werken.</p>
              <span class="hc-cta">Open de tips</span>
            </NuxtLink>
            <FunctieLink to="/kennisbank" class="hc-ingang" data-test="ingang-kennisbank">
              <span class="hc-ingang-label">{{ kennisbankAan ? 'Documenten' : 'Vanaf Gevorderd' }}</span>
              <h2 class="hc-ingang-titel">Kennisbank</h2>
              <p class="hc-ingang-tekst">De documenten van je organisatie: cases, offertes, presentaties, productinfo en contracten. Zoek, koppel aan een account en stel de AI een vraag.</p>
              <span class="hc-cta">Open de kennisbank</span>
            </FunctieLink>
          </div>

          <HelpGroep titel="Hoe werkt Dealtrace" uitleg="Per onderwerp de uitleg over de schermen." link="/helpcenter/instructies" link-tekst="Alle instructies" class="mt-32">
            <NuxtLink v-for="c in product" :key="c.naam" :to="categorieLink(c.naam)" class="hc-categorie" :data-test="`categorie-${c.naam}`">
              <h3 class="hc-categorie-titel">{{ c.naam }}</h3>
              <p class="hc-categorie-tekst">{{ CATEGORIE_UITLEG[c.naam] }}</p>
              <span class="hc-categorie-voet"><span class="hc-cta">Bekijk de artikelen</span><span class="hc-aantal tnum">{{ c.artikelen.length }}</span></span>
            </NuxtLink>
          </HelpGroep>

          <HelpGroep titel="New business" uitleg="De academie: het vak, los van de schermen, en nieuwe klanten werven uit eigen vakliteratuur." link="/helpcenter/academie" link-tekst="Hele academie" class="mt-32" data-test="groep-academie">
            <template v-for="c in newbusiness" :key="c.naam">
              <NuxtLink v-if="c.artikelen.length" :to="categorieLink(c.naam)" class="hc-categorie" :data-test="`categorie-${c.naam}`">
                <span v-if="isWerven(c.naam)" class="hc-categorie-kicker">Nieuwe klanten werven</span>
                <h3 class="hc-categorie-titel">{{ c.naam }}</h3>
                <p class="hc-categorie-tekst">{{ CATEGORIE_UITLEG[c.naam] }}</p>
                <span class="hc-categorie-voet"><span class="hc-cta">Bekijk de artikelen</span><span class="hc-aantal tnum">{{ c.artikelen.length }}</span></span>
              </NuxtLink>
              <div v-else class="hc-categorie hc-categorie--leeg" :data-test="`categorie-${c.naam}`">
                <span v-if="isWerven(c.naam)" class="hc-categorie-kicker">Nieuwe klanten werven</span>
                <h3 class="hc-categorie-titel">{{ c.naam }}</h3>
                <p class="hc-categorie-tekst">De artikelen volgen met de academie.</p>
              </div>
            </template>
          </HelpGroep>

          <HelpGroep v-if="tips.length" titel="Tips &amp; Tricks" uitleg="Van het DealDrive-team: slim werken in Dealtrace, per tip een concreet voordeel." link="/helpcenter/tips" link-tekst="Alle tips" class="mt-32" data-test="groep-tips">
            <NuxtLink v-for="c in tips" :key="c.naam" :to="categorieLink(c.naam)" class="hc-categorie" :data-test="`categorie-${c.naam}`">
              <h3 class="hc-categorie-titel">{{ c.naam }}</h3>
              <p class="hc-categorie-tekst">{{ CATEGORIE_UITLEG[c.naam] }}</p>
              <span class="hc-categorie-voet"><span class="hc-cta">Bekijk de tips</span><span class="hc-aantal tnum">{{ c.artikelen.length }}</span></span>
            </NuxtLink>
          </HelpGroep>
        </template>
      </div>
    </section>
    <HelpSteun zonder="ingangen" />
  </div>
</template>

<style scoped>
.hc-sectie { padding-top: 24px; }
.mt-32 { margin-top: 32px; }
.hc-zoekrij { display: flex; align-items: center; gap: 12px; margin-top: 4px; }
/* De sluitknop naast het zoekveld: vierkant van 44 px, net als de icoonknoppen van de paginakop. */
.hc-zoeksluit { width: 44px; min-width: 44px; height: 44px; min-height: 44px; padding: 0; flex: 0 0 44px; justify-content: center; }
.hc-zoekveld { position: relative; flex: 1; max-width: 720px; display: block; }
.hc-zoekicoon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--muted); pointer-events: none; }
.hc-zoek { width: 100%; min-height: 48px; padding: 11px 14px 11px 42px; font: inherit; font-size: 16px; background: var(--wit); border: 1px solid var(--border-strong); border-radius: 2px; color: var(--ink); }
.hc-zoek:focus { outline: 2px solid var(--yellow); outline-offset: -1px; }
.hc-telling { font-size: 12px; color: var(--muted); white-space: nowrap; }
.hc-leeg { padding: 24px; background: var(--wit); border: 1px dashed var(--border-strong); font-size: 14px; line-height: 1.6; color: var(--muted); text-align: center; margin: 0; }
.hc-ai { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-top: 12px; padding: 14px 18px; background: var(--surface); border-left: 3px solid var(--yellow); font-size: 14px; color: var(--ink-soft); }
.hc-ai p { margin: 0; }

.hc-duo { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
@media (min-width: 900px) { .hc-duo { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.hc-blok { padding: 20px 22px; background: var(--wit); border: 1px solid var(--border); min-width: 0; }
.hc-blok-titel { font-family: var(--font-serif); font-size: 19px; font-weight: 700; margin: 0 0 6px; }
.hc-blok-sub { font-size: var(--fs-label); font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); margin: 14px 0 0; }
.hc-blok-tekst { margin: 6px 0 0; font-size: 13px; color: var(--muted); }
.hc-lijst { list-style: none; padding: 0; margin: 0; }
.hc-lijst li { display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 14px; }
.hc-lijst li:last-child { border-bottom: 0; }
.hc-lijst a { color: var(--ink); text-decoration: none; font-weight: 600; min-width: 0; overflow-wrap: anywhere; }
.hc-lijst a:hover { text-decoration: underline; text-decoration-color: var(--yellow); text-underline-offset: 3px; }
.hc-vinkje { color: var(--green); flex-shrink: 0; margin-left: auto; }

.hc-ingangen { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; margin-top: 24px; }
@media (min-width: 700px) { .hc-ingangen { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.hc-ingang { display: flex; flex-direction: column; align-items: flex-start; padding: 22px 24px; background: var(--ink); color: var(--wit); text-decoration: none; border-left: 3px solid var(--yellow); transition: background var(--transition-fast); }
.hc-ingang:hover { background: var(--ink-soft); }
.hc-ingang-label { font-size: var(--fs-label); font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--yellow); }
.hc-ingang-titel { font-family: var(--font-serif); font-size: 22px; font-weight: 700; margin: 6px 0 6px; color: var(--wit); }
.hc-ingang-tekst { margin: 0 0 14px; font-size: 13px; line-height: 1.55; color: var(--wit-78); }
.hc-ingang .hc-cta { color: var(--wit); }

.hc-categorie { display: flex; flex-direction: column; min-width: 0; padding: 18px 20px; background: var(--wit); border: 1px solid var(--border); border-left: 3px solid var(--yellow); color: var(--ink); text-decoration: none; transition: border-color var(--transition-fast); }
a.hc-categorie:hover { border-color: var(--ink); border-left-color: var(--yellow); }
.hc-categorie--leeg { border-left-color: var(--border-strong); background: var(--surface); }
.hc-categorie-kicker { font-size: var(--fs-label); font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); margin: 0 0 4px; }
.hc-categorie-titel { font-family: var(--font-serif); font-size: 17px; font-weight: 700; margin: 0 0 6px; }
.hc-categorie-tekst { margin: 0 0 12px; font-size: 13px; line-height: 1.55; color: var(--ink-soft); }
.hc-categorie-voet { margin-top: auto; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.hc-aantal { font-size: 12px; font-weight: 700; color: var(--muted); }
.hc-cta { font-size: 12px; font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase; border-bottom: 2px solid var(--yellow); padding-bottom: 1px; }
.hc-cta::after { content: ' \2192'; }
@media (max-width: 719px) {
  .hc-zoekrij { flex-wrap: wrap; }
  .hc-blok, .hc-ingang, .hc-categorie { padding: 16px; }
}
</style>
