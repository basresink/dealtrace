<script setup lang="ts">
// Spraakopdracht (P31, 8.5.6): de microfoon in de kop. Eén zin wordt één concept (taak, notitie,
// afspraak of mail) met checks; bij twijfel een vraag met twee knoppen. "Bewaar" schrijft via de
// wachtrij een echte taak, notitie of afspraak, ook offline. Een opdracht die offline is ingesproken,
// wordt bij verbinding verwerkt en staat daarna klaar (?spraak=<id>).
const open = useState('spraak-open', () => false)
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { functie } = useMe()
const { voegToe } = useSyncQueue()
const o = useOpname()
const accountId = computed(() => (route.path.startsWith('/accounts/') ? String(route.params.id ?? '') || null : null))
const accountNaam = ref<string | null>(null)
const tekst = ref('')
const uitkomst = ref<any>(null)
const bezig = ref(false)
const bijlage = ref<string | null>(null)
const SOORT: Record<string, string> = { taak: 'Taak', notitie: 'Notitie', afspraak: 'Afspraak', mail: 'Mailconcept' }
watch(open, async (v) => {
  if (!v) { if (o.neemtOp.value) await o.stop({ soort: 'spraak', id: 'geannuleerd' }); return }
  tekst.value = ''; uitkomst.value = null; bijlage.value = null
  accountNaam.value = accountId.value ? ((await $fetch<any>(`/api/accounts/${accountId.value}`).catch(() => null))?.naam ?? null) : null
})
// Een opdracht die offline is ingesproken en nu klaarstaat.
watch(() => route.query.spraak, async (id) => {
  if (typeof id !== 'string') return
  const c: any = await $fetch(`/api/spraak/concepten/${id}`).catch(() => null)
  if (!c) return
  open.value = true
  await nextTick(); uitkomst.value = c.uitkomst; tekst.value = c.uitkomst.transcript ?? ''
  router.replace({ query: { ...route.query, spraak: undefined } })
}, { immediate: true })

// Snelle voorvertoning (Web Speech API) alleen als de organisatie hem aanzette; standaard uit.
const { me } = useMe()
let herkenning: any = null
function startVoorvertoning() {
  const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
  if (!(me.value?.organisatie as any)?.browserherkenning || !SR) return
  herkenning = new SR(); herkenning.lang = 'nl-NL'; herkenning.interimResults = true
  herkenning.onresult = (e: any) => { tekst.value = [...e.results].map((r: any) => r[0].transcript).join(' ') }
  try { herkenning.start() } catch { herkenning = null }
}
async function microfoon() {
  if (!o.neemtOp.value) { uitkomst.value = null; try { await o.start(); startVoorvertoning() } catch { toast.toon('Geen toegang tot de microfoon. Typ je opdracht.', 'fout') } return }
  try { herkenning?.stop() } catch { /* al gestopt */ }
  bezig.value = true
  const id = await o.stop({ soort: 'spraak', id: accountId.value ?? 'geen' })
  if (!id) { bezig.value = false; uitkomst.value = { soort: 'fout', tekst: 'Dat verstond ik niet. Probeer het nog eens of typ je opdracht.' }; return }
  bijlage.value = id
  if (!navigator.onLine) {
    await voegToe({ tabel: 'spraak_concepten', op: 'patch', recordId: id, patch: { soort: 'spraak.opdracht', bijlageId: id, accountId: accountId.value, op: new Date().toISOString() } })
    bezig.value = false; open.value = false
    toast.toon('Opdracht bewaard op je telefoon. Zodra je verbinding hebt, staat hij klaar.')
    return
  }
  await useBijlagen().verstuur()
  await interpreteer({ bijlageId: id })
}
async function interpreteer(body: Record<string, unknown>) {
  bezig.value = true
  try {
    const r: any = await $fetch('/api/spraak/opdracht', { method: 'POST', body: { accountId: accountId.value, ...body } })
    if (r.transcript) tekst.value = r.transcript
    uitkomst.value = r
  } catch (e) { uitkomst.value = { soort: 'fout', tekst: foutTekst(e) } } finally { bezig.value = false }
}
const kies = (k: { id: string }) => interpreteer({ tekst: tekst.value, kandidaatId: k.id })
async function bewaar() {
  const c = uitkomst.value?.concept
  if (!c) return
  await voegToe({ tabel: 'spraak_concepten', op: 'patch', recordId: crypto.randomUUID(), patch: { soort: 'spraak.opdracht', concept: c, op: new Date().toISOString() } })
  toast.toon(navigator.onLine ? `${SOORT[c.soort]} bewaard bij ${c.accountNaam}.` : 'Bewaard op je telefoon, wordt verstuurd zodra je verbinding hebt.')
  open.value = false
}
const datumLabel = (d: string | null) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }) : '')
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fo-overlay" @click.self="open = false">
      <section class="fo-panel fo-panel--smal fo-panel--schuif" role="dialog" aria-modal="true" aria-labelledby="sp-titel" data-test="spraak-venster">
        <header class="fo-head">
          <div class="fo-head-tekst"><span class="fo-kicker">Inspreken</span><h2 id="sp-titel" class="fo-titel">Zeg wat er moet gebeuren</h2>
            <p class="taak-meta"><span class="pil" :class="accountNaam ? 'pil--zwart' : 'pil--leeg'">{{ accountNaam ?? 'Geen account gekozen' }}</span></p></div>
          <button type="button" class="fo-sluit" aria-label="Sluiten" @click="open = false"><Icoon naam="X" /></button>
        </header>
        <div class="fo-body fo-body--formulier">
          <NietAangezetKop v-if="!functie('spraak.opdracht')?.beschikbaar" sleutel="spraak.opdracht" />
          <template v-else>
            <button type="button" :class="['ba-mic', { 'ba-mic--aan': o.neemtOp.value }]" :aria-pressed="o.neemtOp.value" :disabled="bezig || !o.kan.value" data-test="sp-mic" @click="microfoon">
              <Icoon :naam="o.neemtOp.value ? 'Square' : 'Mic'" />{{ o.neemtOp.value ? `Stop · ${o.seconden.value} s` : bezig ? 'Even denken…' : 'Spreek je opdracht in' }}
            </button>
            <p v-if="o.neemtOp.value" class="sp-golf" aria-hidden="true"><span v-for="i in 12" :key="i" :style="{ animationDelay: `${i * 70}ms` }" /></p>
            <p v-else-if="bezig" class="meta mt-8">Je tekst verschijnt zo.</p>
            <label class="veld mt-16"><span class="veld-label">Of typ je opdracht</span><input v-model="tekst" class="invoer" placeholder="Bel Marieke volgende week dinsdag over de projectschouw" data-test="sp-tekst" @keydown.enter.prevent="interpreteer({ tekst })"></label>
            <button v-if="tekst.trim() && !uitkomst" type="button" class="dd-act mt-8" :disabled="bezig" data-test="sp-lees" @click="interpreteer({ tekst })">Maak concept</button>
            <article v-if="uitkomst?.soort === 'concept'" class="fo-blok mt-16" data-test="sp-concept">
              <header class="fo-blok-kop"><h3 class="fo-blok-titel">{{ SOORT[uitkomst.concept.soort] }}</h3></header>
              <p><strong>{{ uitkomst.concept.titel }}</strong></p>
              <p class="meta">{{ uitkomst.concept.accountNaam }}<template v-if="uitkomst.concept.contactNaam"> · {{ uitkomst.concept.contactNaam }}</template><template v-if="uitkomst.concept.datum"> · {{ datumLabel(uitkomst.concept.datum) }}</template><template v-if="uitkomst.concept.tijd"> {{ uitkomst.concept.tijd }}</template></p>
              <ul class="sp-checks"><li v-for="c in uitkomst.concept.checks" :key="c"><Icoon naam="CircleCheck" :grootte="14" /> {{ c }}</li></ul>
              <label class="veld mt-8"><span class="veld-label">Titel</span><input v-model="uitkomst.concept.titel" class="invoer"></label>
              <label v-if="uitkomst.concept.soort !== 'notitie'" class="veld mt-8"><span class="veld-label">Datum</span><input v-model="uitkomst.concept.datum" type="date" class="invoer"></label>
            </article>
            <article v-else-if="uitkomst?.soort === 'vraag'" class="fo-blok mt-16" data-test="sp-vraag">
              <p><strong>{{ uitkomst.vraag }}</strong></p>
              <div class="uitkomst-raster mt-8"><button v-for="k in uitkomst.kandidaten" :key="k.id" type="button" class="uitkomst-knop" @click="kies(k)">{{ k.naam }}</button></div>
            </article>
            <p v-else-if="uitkomst?.soort === 'fout'" class="kaart kaart--rood mt-16" data-test="sp-fout">{{ uitkomst.tekst }}</p>
          </template>
        </div>
        <footer class="fo-foot dd-acties">
          <button type="button" class="dd-act" :disabled="!uitkomst" @click="uitkomst = null">Aanpassen</button>
          <span class="dd-acties-vul fo-foot-vul" />
          <button type="button" class="dd-act dd-act--primair" :disabled="uitkomst?.soort !== 'concept'" data-test="sp-bewaar" @click="bewaar">Bewaar</button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
