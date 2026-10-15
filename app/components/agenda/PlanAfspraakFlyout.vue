<script setup lang="ts">
// Plan een afspraak (F09): klant, contactpersoon (beslissers eerst), meetingsoort (vult duur en
// agenda), vorm, datum, start, duur, voor wie (Gevorderd: een collega met diens vrije momenten),
// locatie, herinnering, aanleiding en beschrijving. Op de telefoon een schuifvenster van onderen.
const props = defineProps<{ open: boolean; account?: { id: string; naam: string } | null; taskId?: string | null; aanleiding?: string | null; voorWie?: string | null; voorstel?: { datum?: string; start?: string; duurMin?: number; vorm?: string; soort?: string } | null }>()
const emit = defineEmits<{ sluit: []; gepland: [id: string] }>()
const { functie, me } = useMe()
const toast = useToast()
const voorCollega = computed(() => !!functie('agenda.voorCollega')?.beschikbaar)
const soorten = ref<any[]>([])
const collegas = ref<{ id: string; naam: string; werkplek: string }[]>([])
const contacten = ref<any[]>([])
const klant = ref<{ id: string; naam: string } | null>(null)
const zoek = ref('')
const treffers = ref<any[]>([])
const vrij = ref<{ start: string; eind: string }[]>([])
const bezig = ref(false)
const vandaag = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })
const leeg = () => ({ contactId: '', meetingsoortId: '', vorm: 'online', datum: vandaag(), start: '10:00', duurMin: 30, voorWie: '', locatie: '', herinneringMin: 15, aanleiding: '', beschrijving: '' })
const f = reactive(leeg())
const soort = computed(() => soorten.value.find((s) => s.id === f.meetingsoortId))
watch(() => props.open, async (o) => {
  if (!o) return
  Object.assign(f, leeg(), { aanleiding: props.aanleiding ?? '', voorWie: props.voorWie ?? '' })
  klant.value = props.account ?? null; zoek.value = ''; treffers.value = []
  const [m, a]: any[] = await Promise.all([$fetch('/api/meetingsoorten'), voorCollega.value ? $fetch('/api/agenda', { query: { van: vandaag(), tot: vandaag() } }).catch(() => null) : null])
  soorten.value = (m.soorten ?? []).filter((s: any) => s.actief)
  collegas.value = (a?.gebruikers ?? []).filter((u: any) => u.id !== me.value?.gebruiker.id)
  const eerste = soorten.value.find((s) => s.slug === (props.voorstel?.soort ?? 'kennismaking')) ?? soorten.value.find((s) => s.type === 'klant')
  if (eerste) f.meetingsoortId = eerste.id
  // Een voorstel (tussenstop, P14): datum, start in het gat, duur en vorm.
  const v = props.voorstel
  if (v) { await nextTick(); Object.assign(f, v.datum ? { datum: v.datum } : {}, v.start ? { start: v.start } : {}, v.duurMin ? { duurMin: v.duurMin } : {}, v.vorm ? { vorm: v.vorm } : {}) }
}, { immediate: true })
watch(soort, (s) => { if (s) { f.duurMin = s.duurMin; f.vorm = s.vorm; f.herinneringMin = s.data?.herinneringMin ?? 15 } })
watch(klant, async (k) => {
  contacten.value = []; f.contactId = ''
  if (!k) return
  try { const a: any = await $fetch(`/api/accounts/${k.id}`); contacten.value = (a.contacten ?? []).filter((c: any) => c.status !== 'vertrokken').sort((x: any, y: any) => Number(y.rol === 'beslisser') - Number(x.rol === 'beslisser')); f.contactId = a.primairContactId ?? contacten.value[0]?.id ?? '' } catch { /* geen contacten */ }
}, { immediate: true })
let timer: any
watch(zoek, (q) => { clearTimeout(timer); timer = setTimeout(async () => { treffers.value = q.length >= 2 ? await $fetch<any[]>('/api/accounts/kies', { query: { q } }) : [] }, 250) })
// Vrije momenten van jezelf of de collega op de gekozen dag (agenda bezet telt mee, gat 37).
watch(() => [props.open, f.voorWie, f.datum, f.duurMin], async () => {
  if (!props.open || !f.datum) return
  try { const r: any = await $fetch('/api/agenda/vrij', { query: { gebruiker: f.voorWie || undefined, dag: f.datum, duur: f.duurMin } }); vrij.value = r.vrij.slice(0, 8) } catch { vrij.value = [] }
}, { immediate: true })
const tijd = (iso: string) => new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })
function startIso() {
  // Datum en tijd zijn Nederlandse tijd; de server rekent in UTC.
  const proef = new Date(`${f.datum}T${f.start}:00Z`)
  const verschil = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Amsterdam', hour: 'numeric', hourCycle: 'h23' }).format(proef)) - proef.getUTCHours()
  return new Date(proef.getTime() - ((verschil + 24) % 24) * 3600_000).toISOString()
}
async function plan() {
  if ((!klant.value && soort.value?.type !== 'intern') || !f.meetingsoortId) return
  bezig.value = true
  try {
    const r: any = await $fetch('/api/afspraken', { method: 'POST', body: { accountId: klant.value?.id ?? null, contactId: f.contactId || null, meetingsoortId: f.meetingsoortId, vorm: f.vorm, start: startIso(), duurMin: f.duurMin, voorWie: f.voorWie || null, locatie: f.locatie || null, herinneringMin: f.herinneringMin, aanleiding: f.aanleiding || null, beschrijving: f.beschrijving || null, taskId: props.taskId ?? null } })
    toast.toon(r.tekst); emit('gepland', r.id)
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fo-overlay" @click.self="emit('sluit')">
      <form class="fo-panel fo-panel--smal fo-panel--schuif" role="dialog" aria-modal="true" aria-labelledby="pa-titel" data-test="plan-afspraak" @submit.prevent="plan">
        <header class="fo-head">
          <div class="fo-head-tekst"><span class="fo-kicker">Nieuwe afspraak</span><h2 id="pa-titel" class="fo-titel">Plan een afspraak</h2></div>
          <button type="button" class="fo-sluit" aria-label="Sluiten" @click="emit('sluit')"><Icoon naam="X" /></button>
        </header>
        <div class="fo-body fo-body--formulier">
          <article class="fo-blok">
            <div class="veld"><span class="veld-label">Klant <span v-if="soort?.type !== 'intern'" class="veld-verplicht">*</span></span>
              <p v-if="klant" class="schakel-rij"><strong>{{ klant.naam }}</strong><button v-if="!account" type="button" class="dd-act" @click="klant = null">Wijzig</button></p>
              <template v-else><input v-model="zoek" class="invoer" placeholder="Zoek een bedrijf" data-test="pa-klant"><ul v-if="treffers.length" class="schakel-lijst"><li v-for="a in treffers" :key="a.id" class="schakel-rij"><button type="button" class="taak-titel" @click="klant = a; treffers = []">{{ a.naam }} <span class="meta">{{ a.plaats }}</span></button></li></ul></template>
            </div>
            <label v-if="contacten.length" class="veld mt-16"><span class="veld-label">Contactpersoon</span><select v-model="f.contactId" class="invoer" data-test="pa-contact"><option value="">Geen</option><option v-for="c in contacten" :key="c.id" :value="c.id">{{ c.naam }}<template v-if="c.rol"> · {{ c.rol }}</template></option></select></label>
            <label class="veld mt-16"><span class="veld-label">Meetingsoort <span class="veld-verplicht">*</span></span><select v-model="f.meetingsoortId" class="invoer" required data-test="pa-soort"><option v-for="s in soorten" :key="s.id" :value="s.id">{{ s.naam }} ({{ s.duurMin }} min)</option></select></label>
            <p v-if="soort?.data?.doel" class="veld-uitleg">{{ soort.data.doel }}</p>
            <div class="ag-keuzes mt-16" role="radiogroup" aria-label="Vorm">
              <button v-for="v in [['bezoek', 'Bezoek'], ['online', 'Online'], ['telefoon', 'Telefoon']]" :key="v[0]" type="button" class="uitkomst" :class="{ 'uitkomst--aan': f.vorm === v[0] }" role="radio" :aria-checked="f.vorm === v[0]" :data-test="`pa-vorm-${v[0]}`" @click="f.vorm = v[0]!">{{ v[1] }}</button>
            </div>
          </article>
          <article class="fo-blok">
            <label v-if="voorCollega && collegas.length" class="veld"><span class="veld-label">Voor wie</span><select v-model="f.voorWie" class="invoer" data-test="pa-voor-wie"><option value="">Mij</option><option v-for="u in collegas" :key="u.id" :value="u.id">{{ u.naam.replace(/^Testgebruiker /, '') }}<template v-if="u.werkplek"> · {{ u.werkplek }}</template></option></select></label>
            <p v-else-if="!voorCollega" class="veld-uitleg" data-test="pa-voor-wie-uit">Plannen voor een collega: nog niet aangezet.</p>
            <div class="formulier-raster mt-16">
              <label class="veld"><span class="veld-label">Datum <span class="veld-verplicht">*</span></span><input v-model="f.datum" type="date" class="invoer" required data-test="pa-datum"></label>
              <label class="veld"><span class="veld-label">Start <span class="veld-verplicht">*</span></span><input v-model="f.start" type="time" step="900" class="invoer" required data-test="pa-start"></label>
              <label class="veld"><span class="veld-label">Duur (minuten)</span><input v-model.number="f.duurMin" type="number" min="5" max="480" step="5" class="invoer"></label>
            </div>
            <div v-if="vrij.length" class="mt-8" data-test="pa-vrij"><span class="veld-label">Vrij{{ f.voorWie ? ' bij je collega' : '' }}</span>
              <div class="ag-keuzes"><button v-for="v in vrij" :key="v.start" type="button" class="pil pil--leeg pa-vrij-knop" :class="{ 'pil--zwart': tijd(v.start) === f.start }" @click="f.start = tijd(v.start)">{{ tijd(v.start) }}</button></div>
            </div>
            <p v-else class="veld-uitleg mt-8">Geen vrije momenten meer op deze dag.</p>
          </article>
          <article class="fo-blok">
            <label class="veld"><span class="veld-label">{{ f.vorm === 'bezoek' ? 'Locatie' : 'Locatie of meetinglink' }}</span><input v-model="f.locatie" class="invoer" :placeholder="f.vorm === 'bezoek' ? 'Adres van het account' : f.vorm === 'online' ? 'Komt uit je gekoppelde agenda' : ''"></label>
            <label class="veld mt-16"><span class="veld-label">Herinnering</span><select v-model.number="f.herinneringMin" class="invoer"><option :value="0">Geen</option><option :value="10">10 minuten vooraf</option><option :value="15">15 minuten vooraf</option><option :value="30">30 minuten vooraf</option><option :value="60">1 uur vooraf</option><option :value="1440">1 dag vooraf</option></select></label>
            <label class="veld mt-16"><span class="veld-label">Aanleiding</span><input v-model="f.aanleiding" class="invoer"></label>
            <label class="veld mt-16"><span class="veld-label">Beschrijving</span><textarea v-model="f.beschrijving" class="invoer" rows="2" /></label>
          </article>
        </div>
        <footer class="fo-foot dd-acties">
          <button type="button" class="dd-act" @click="emit('sluit')">Annuleren</button>
          <span class="dd-acties-vul fo-foot-vul" />
          <button type="submit" class="dd-act dd-act--primair" :disabled="bezig || (!klant && soort?.type !== 'intern') || !f.meetingsoortId" data-test="pa-plan">Plan afspraak</button>
        </footer>
      </form>
    </div>
  </Teleport>
</template>
