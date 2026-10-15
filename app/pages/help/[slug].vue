<script setup lang="ts">
// Artikelpagina (F21): titel, leestijd, niveau als oriëntatie, inhoud, "Probeer het",
// "Was dit nuttig?", gerelateerd en "Markeer als gelezen". Lezen is nergens een voorwaarde.
import { FEEDBACK_REDENEN, isGelezen } from '~~/shared/help'
import { markdownNaarHtml } from '~~/shared/markdown'
import { NIVEAU_LABEL, type Niveau } from '~~/shared/types'
const route = useRoute()
const toast = useToast()
const { data: a, error } = await useFetch<any>(() => `/api/help/${route.params.slug}`)
const html = computed(() => (a.value ? markdownNaarHtml(a.value.inhoud, { zonderTitel: a.value.titel }) : ''))
const leestijd = computed(() => Math.max(1, Math.round((a.value?.inhoud ?? '').split(/\s+/).length / 200)))
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
    <section v-if="error" class="section"><div class="container container--smal"><span class="kicker kicker--streep">Helpcenter</span><h1 class="title title--groot">Dit artikel bestaat niet (meer).</h1><NuxtLink to="/help" class="dd-act mt-16">Naar het helpcenter</NuxtLink></div></section>
    <template v-else-if="a">
      <section class="section">
        <div class="container help-artikel">
          <NuxtLink to="/help" class="kicker kicker--streep">Helpcenter · {{ a.categorie }}</NuxtLink>
          <h1 class="title title--groot" data-test="artikel-titel">{{ a.titel }}</h1>
          <p class="meta mt-8">{{ leestijd }} min lezen<template v-if="a.niveau"> · <span class="pil pil--leeg">{{ NIVEAU_LABEL[a.niveau as Niveau] }}</span></template><template v-if="gelezenNu"> · <Icoon naam="CircleCheck" :grootte="14" /> gelezen</template></p>
        </div>
      </section>
      <section class="section section--laatste">
        <div class="container help-artikel">
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div class="help-tekst" data-test="artikel-inhoud" v-html="html" />
          <div class="dd-acties mt-16">
            <NuxtLink v-if="a.routes?.[0]" :to="a.routes[0]" class="dd-act dd-act--primair" data-test="probeer-het">Probeer het</NuxtLink>
            <button type="button" class="dd-act" :disabled="gelezenNu" data-test="markeer-gelezen" @click="gelezen">{{ gelezenNu ? 'Gelezen' : 'Markeer als gelezen' }}</button>
          </div>
          <article class="kaart mt-24" data-test="nuttig">
            <h2 class="kaart-titel">Was dit nuttig?</h2>
            <div class="dd-acties mt-8"><button type="button" class="dd-act" @click="stuurFeedback(true)">Ja</button><button type="button" class="dd-act" data-test="nuttig-nee" @click="nuttig = false">Nee</button></div>
            <div v-if="nuttig === false" class="mt-8">
              <label class="veld"><span class="veld-label">Wat kan beter?</span><select v-model="reden" class="invoer" data-test="nuttig-reden"><option value="" disabled>Kies een reden</option><option v-for="r in FEEDBACK_REDENEN" :key="r">{{ r }}</option></select></label>
              <button type="button" class="dd-act dd-act--primair mt-8" :disabled="!reden" data-test="nuttig-verstuur" @click="stuurFeedback(false)">Verstuur</button>
            </div>
          </article>
          <article v-if="a.gerelateerd.length" class="kaart mt-16"><h2 class="kaart-titel">Gerelateerd</h2><ul class="help-lijst mt-8"><li v-for="g in a.gerelateerd" :key="g.slug"><NuxtLink :to="`/help/${g.slug}`">{{ g.titel }}</NuxtLink></li></ul></article>
          <p class="meta mt-16">Laatst bijgewerkt op {{ datum(a.bijgewerktOp) }}.</p>
        </div>
      </section>
    </template>
  </div>
</template>
