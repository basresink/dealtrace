<script setup lang="ts">
// Artikelpagina (F21, P25) in de opzet van een instructie in DealDrive: kruimel, kicker met collectie en
// categorie, titel, samenvatting, "Probeer het" als zwarte knop, de inhoud in genummerde blokken (één
// blok per kop), controlevragen, "Markeer als gelezen", "Was dit nuttig?", "Ook in deze categorie" en een
// voet. Gelezen na scrollen tot het einde of met de knop, via de wachtrij (ook offline). Lezen is nergens
// een voorwaarde.
import { categorieLink, FEEDBACK_REDENEN, helpLink, isGelezen } from '~~/shared/help'
import { markdownNaarHtml } from '~~/shared/markdown'
import { NIVEAU_LABEL, type Niveau } from '~~/shared/types'
const route = useRoute()
const toast = useToast()
const { me } = useMe()
const beheerder = computed(() => me.value?.gebruiker?.rol === 'beheerder')
const alsNiveau = computed(() => (route.query.alsNiveau as string) || undefined)
const { data: a, error } = await useFetch<any>(() => `/api/help/${route.params.slug}`, { query: computed(() => ({ alsNiveau: alsNiveau.value })) })
const html = computed(() => (a.value ? markdownNaarHtml(a.value.inhoud, { zonderTitel: a.value.titel }) : ''))
// De inhoud in blokken: alles vóór de eerste kop is de inleiding, daarna één genummerd blok per kop.
const blokken = computed(() => {
  const delen = html.value.split(/(?=<h3>)/)
  const inleiding = delen[0]?.startsWith('<h3>') ? '' : (delen.shift() ?? '')
  return { inleiding, blokken: delen.map((d) => { const m = /^<h3>([\s\S]*?)<\/h3>/.exec(d); return { kop: m?.[1] ?? '', inhoud: m ? d.slice(m[0].length) : d } }) }
})
const leestijd = computed(() => a.value?.leestijd ?? 1)
const collectieNaam = computed(() => (a.value?.collectie === 'newbusiness' ? 'New business' : 'Hoe werkt Dealtrace'))
const datum = (iso: string) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))
// useFetch geeft een ondiepe ref: "gelezen" houden we apart bij.
const gelezenNu = ref(false)
watch(a, (x) => { gelezenNu.value = !!x?.gelezen }, { immediate: true })
const { voegToe } = useSyncQueue()
async function gelezen() {
  if (!a.value || gelezenNu.value) return
  gelezenNu.value = true
  await voegToe({ tabel: 'help_gelezen', op: 'patch', recordId: a.value.id, patch: { soort: 'help.gelezen' } })
}
// Controlevragen: alleen voor jezelf; het artikel telt als gelezen, ook bij een fout antwoord (B19).
const antwoorden = ref<Record<number, number>>({})
const nagekeken = ref(false)
watch(() => route.params.slug, () => { antwoorden.value = {}; nagekeken.value = false; nuttig.value = null; reden.value = '' })
const vragen = computed<{ vraag: string; opties: string[]; goed: number }[]>(() => a.value?.vragen ?? [])
const goed = computed(() => vragen.value.filter((v, i) => antwoorden.value[i] === v.goed).length)
async function kijkNa() {
  nagekeken.value = true
  gelezenNu.value = true
  try { await $fetch(`/api/help/${a.value.id}/gelezen`, { method: 'POST', body: { vragenGoed: goed.value } }) } catch { await voegToe({ tabel: 'help_gelezen', op: 'patch', recordId: a.value.id, patch: { soort: 'help.gelezen' } }) }
}
function opScroll() {
  if (a.value && !gelezenNu.value && isGelezen(window.scrollY, window.innerHeight, document.documentElement.scrollHeight)) void gelezen()
}
onMounted(() => { window.addEventListener('scroll', opScroll, { passive: true }); setTimeout(opScroll, 300) })
onBeforeUnmount(() => window.removeEventListener('scroll', opScroll))
const nuttig = ref<null | boolean>(null)
const reden = ref('')
async function stuurFeedback(n: boolean) {
  nuttig.value = n
  if (!n && !reden.value) return
  try { await $fetch(`/api/help/${a.value.id}/feedback`, { method: 'POST', body: { nuttig: n, reden: n ? undefined : reden.value } }); toast.toon('Bedankt. We gebruiken dit om het artikel te verbeteren.'); nuttig.value = null; reden.value = '' } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
useHead({ title: () => `${a.value?.titel ?? 'Artikel'} · Helpcenter · Dealtrace` })
</script>

<template>
  <div>
    <section v-if="error" class="section">
      <div class="container">
        <NuxtLink to="/helpcenter" class="ha-kruimel">Helpcenter</NuxtLink>
        <div class="ha-melding" data-test="artikel-onbekend">
          <h1 class="ha-melding-titel">Dit artikel bestaat niet (meer).</h1>
          <p>Het adres klopt niet, of het artikel is gearchiveerd. Zoek het onderwerp in het helpcenter.</p>
          <NuxtLink to="/helpcenter" class="dd-actie dd-actie--secundair mt-16">Naar het helpcenter</NuxtLink>
        </div>
      </div>
    </section>
    <section v-else-if="a" class="section section--laatste">
      <div class="container ha">
        <nav class="ha-kruimels" aria-label="Kruimelpad">
          <NuxtLink to="/helpcenter" class="ha-kruimel">Helpcenter</NuxtLink>
          <NuxtLink :to="categorieLink(a.categorie)" class="ha-kruimel ha-kruimel--door" data-test="artikel-categorie">{{ a.categorie }}</NuxtLink>
        </nav>
        <span class="kicker kicker--streep">{{ collectieNaam }} · {{ a.categorie }}</span>
        <h1 class="ha-titel" data-test="artikel-titel">{{ a.titel }}</h1>
        <p v-if="a.samenvatting" class="ha-samenvatting">{{ a.samenvatting }}</p>
        <p class="ha-meta">
          <span>{{ leestijd }} min lezen</span>
          <span v-if="a.niveau" class="pil pil--grijs">{{ NIVEAU_LABEL[a.niveau as Niveau] }}</span>
          <span v-if="gelezenNu" class="ha-gelezen"><Icoon naam="CircleCheck" :grootte="14" />Gelezen</span>
          <span v-if="a.status === 'concept'" class="pil pil--geel">Concept</span>
        </p>
        <p v-if="a.nietAan" class="ha-voorwie" data-test="niet-aan"><span class="ha-voorwie-label">Let op</span>{{ a.nietAan }}</p>
        <div v-if="beheerder" class="ha-bekijkals" data-test="bekijk-als"><span class="ha-bekijkals-label">Bekijk als</span>
          <NuxtLink v-for="n in ['beginner', 'gevorderd', 'expert']" :key="n" :to="{ query: { alsNiveau: alsNiveau === n ? undefined : n } }" class="filter-pil" :class="{ 'filter-pil--aan': alsNiveau === n }">{{ NIVEAU_LABEL[n as Niveau] }}</NuxtLink></div>
        <NuxtLink v-if="a.routes?.[0]" :to="a.routes[0]" class="dd-actie dd-actie--zwart ha-probeer" data-test="probeer-het">Probeer het<Icoon naam="ArrowRight" class="dd-actie-icoon" /></NuxtLink>

        <div class="help-tekst ha-inhoud" data-test="artikel-inhoud">
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div v-if="blokken.inleiding" class="ha-inleiding" v-html="blokken.inleiding" />
          <ol v-if="blokken.blokken.length" class="ha-blokken" role="list">
            <li v-for="(b, i) in blokken.blokken" :key="i" class="ha-blok">
              <span class="ha-blok-num tnum">{{ String(i + 1).padStart(2, '0') }}</span>
              <div class="ha-blok-inhoud">
                <!-- eslint-disable-next-line vue/no-v-html -->
                <h2 class="ha-blok-kop" v-html="b.kop" />
                <!-- eslint-disable-next-line vue/no-v-html -->
                <div v-html="b.inhoud" />
              </div>
            </li>
          </ol>
        </div>

        <article v-if="a.vragen?.length" class="ha-kaart" data-test="controlevragen">
          <h2 class="ha-kaart-titel">Controlevragen</h2>
          <p class="ha-kaart-meta">Voor jezelf. Het telt niet mee voor je niveau.</p>
          <fieldset v-for="(v, i) in vragen" :key="i" class="hv-vraag mt-16">
            <legend class="hv-legenda">{{ i + 1 }}. {{ v.vraag }}</legend>
            <label v-for="(o, j) in v.opties" :key="j" class="hv-optie" :class="{ 'hv-optie--goed': nagekeken && j === v.goed, 'hv-optie--fout': nagekeken && antwoorden[i] === j && j !== v.goed }">
              <input v-model="antwoorden[i]" type="radio" :name="`vraag-${i}`" :value="j" :disabled="nagekeken"> <span>{{ o }}</span>
            </label>
          </fieldset>
          <button v-if="!nagekeken" type="button" class="dd-actie dd-actie--primair mt-16" :disabled="Object.keys(antwoorden).length < a.vragen.length" data-test="kijk-na" @click="kijkNa">Kijk na</button>
          <p v-else class="ha-kaart-meta mt-16" data-test="uitslag">{{ goed }} van {{ a.vragen.length }} goed.</p>
        </article>

        <div class="ha-acties">
          <button type="button" class="dd-actie dd-actie--secundair" :disabled="gelezenNu" data-test="markeer-gelezen" @click="gelezen"><Icoon naam="CircleCheck" class="dd-actie-icoon" />{{ gelezenNu ? 'Gelezen' : 'Markeer als gelezen' }}</button>
        </div>

        <article class="ha-kaart" data-test="nuttig">
          <h2 class="ha-kaart-titel">Was dit nuttig?</h2>
          <div class="ha-knoppen"><button type="button" class="dd-act" @click="stuurFeedback(true)">Ja</button><button type="button" class="dd-act" data-test="nuttig-nee" @click="nuttig = false">Nee</button></div>
          <div v-if="nuttig === false" class="mt-8">
            <label class="veld"><span class="veld-label">Wat kan beter?</span><select v-model="reden" class="invoer" data-test="nuttig-reden"><option value="" disabled>Kies een reden</option><option v-for="r in FEEDBACK_REDENEN" :key="r">{{ r }}</option></select></label>
            <button type="button" class="dd-actie dd-actie--primair mt-8" :disabled="!reden" data-test="nuttig-verstuur" @click="stuurFeedback(false)">Verstuur</button>
          </div>
        </article>

        <nav v-if="a.gerelateerd.length" class="ha-verwant" aria-label="Ook in deze categorie" data-test="gerelateerd">
          <h2 class="ha-verwant-titel">Ook in {{ a.categorie }}</h2>
          <ul class="ha-verwant-lijst" role="list"><li v-for="g in a.gerelateerd" :key="g.slug"><NuxtLink :to="helpLink(g.slug)" class="ha-verwant-link">{{ g.titel }}</NuxtLink></li></ul>
        </nav>

        <p class="ha-voet">Laatst bijgewerkt op {{ datum(a.bijgewerktOp) }}. Klopt er iets niet, of mis je een stap? Mail <a href="mailto:support@dealtrace.test" class="ha-inline">support@dealtrace.test</a> of dien een wens in op de <NuxtLink to="/roadmap" class="ha-inline">roadmap</NuxtLink>.</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.ha { max-width: 860px; }
.ha-kruimels { display: flex; align-items: center; flex-wrap: wrap; gap: 0 4px; margin-bottom: 6px; }
.ha-kruimel { display: inline-flex; align-items: center; min-height: var(--touch-target-min); font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); text-decoration: none; }
.ha-kruimel:first-child::before { content: '\2190  '; white-space: pre; }
.ha-kruimel--door::before { content: '/  '; white-space: pre; color: var(--muted-light); }
.ha-kruimel:hover { color: var(--ink); }
.ha-titel { font-family: var(--font-serif); font-size: clamp(26px, 4vw, 38px); line-height: 1.15; font-weight: 700; margin: 12px 0 8px; color: var(--ink); overflow-wrap: anywhere; }
.ha-samenvatting { margin: 0 0 10px; font-size: 15px; line-height: 1.6; color: var(--ink-soft); max-width: 64ch; }
.ha-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 12px; margin: 0 0 18px; font-size: 12px; color: var(--muted); }
.ha-gelezen { display: inline-flex; align-items: center; gap: 4px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; font-size: 11px; color: var(--green); }
.ha-voorwie { margin: 0 0 18px; padding: 12px 16px; background: var(--surface); border-left: 3px solid var(--yellow); font-size: 13px; line-height: 1.55; color: var(--ink-soft); max-width: 66ch; }
.ha-voorwie-label { display: block; font-size: var(--fs-label); font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); margin-bottom: 2px; }
.ha-bekijkals { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 0 0 18px; }
.ha-bekijkals-label { font-size: var(--fs-label); font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
.ha-probeer { margin: 0 0 26px; }
.ha-inhoud { margin-top: 8px; }
.ha-inleiding { margin: 0 0 18px; max-width: 68ch; }
.ha-blokken { list-style: none; margin: 0; padding: 0; background: var(--wit); border: 1px solid var(--border); }
.ha-blok { display: grid; grid-template-columns: 48px minmax(0, 1fr); gap: 12px; padding: 18px 20px; border-bottom: 1px solid var(--border); }
.ha-blok:last-child { border-bottom: 0; }
.ha-blok-num { font-size: 12px; font-weight: 800; color: var(--muted); padding-top: 3px; }
.ha-blok-inhoud { min-width: 0; max-width: 68ch; }
.help-tekst .ha-blok-kop { font-family: var(--font-serif); font-size: 17px; font-weight: 700; line-height: 1.35; margin: 0 0 8px; color: var(--ink); }
.ha-blok-inhoud :deep(p:last-child), .ha-blok-inhoud :deep(ul:last-child), .ha-blok-inhoud :deep(ol:last-child) { margin-bottom: 0; }
.ha-blok-inhoud :deep(a), .ha-inleiding :deep(a) { color: var(--ink); font-weight: 600; border-bottom: 2px solid var(--yellow); text-decoration: none; }
.ha-kaart { margin-top: 24px; padding: 20px 22px; background: var(--wit); border: 1px solid var(--border); }
.ha-kaart-titel { font-family: var(--font-serif); font-size: 19px; font-weight: 700; margin: 0 0 4px; }
.ha-kaart-meta { margin: 0; font-size: 13px; color: var(--muted); }
.ha-knoppen { display: flex; gap: 8px; margin-top: 8px; }
.ha-acties { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.ha-verwant { margin-top: 28px; }
.ha-verwant-titel { font-size: 11px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); margin: 0 0 10px; }
.ha-verwant-lijst { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
@media (min-width: 700px) { .ha-verwant-lijst { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.ha-verwant-link { display: flex; align-items: center; min-height: var(--touch-target-min); padding: 10px 14px; background: var(--wit); border: 1px solid var(--border); font-size: 13px; font-weight: 600; line-height: 1.4; color: var(--ink); text-decoration: none; }
.ha-verwant-link:hover { border-color: var(--ink); }
.ha-voet { margin: 24px 0 0; font-size: 13px; line-height: 1.6; color: var(--muted); }
.ha-inline { color: var(--ink); border-bottom: 1px solid var(--yellow); text-decoration: none; font-weight: 600; }
.ha-melding { margin-top: 8px; padding: 28px; background: var(--wit); border: 1px dashed var(--border-strong); }
.ha-melding-titel { font-family: var(--font-serif); font-size: 22px; font-weight: 700; margin: 0 0 8px; }
.ha-melding p { margin: 0; font-size: 14px; line-height: 1.65; color: var(--ink-soft); }
.hv-vraag { border: 0; padding: 0; margin: 0; display: grid; gap: 6px; }
.hv-legenda { font-weight: 600; margin-bottom: 4px; }
.hv-optie { display: flex; gap: 10px; align-items: center; min-height: 44px; padding: 6px 10px; border: 1px solid var(--border); border-radius: 2px; cursor: pointer; }
.hv-optie--goed { border-color: var(--green); background: var(--green-zacht); }
.hv-optie--fout { border-color: var(--red); background: var(--red-pil); }
@media (max-width: 600px) {
  .ha-blok { grid-template-columns: 28px minmax(0, 1fr); gap: 8px; padding: 14px; }
  .ha-kaart { padding: 16px; }
  .ha-probeer { width: 100%; justify-content: center; }
}
</style>
