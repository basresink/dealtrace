<script setup lang="ts">
// Plan een afspraak in de opzet van DealDrive (NieuweAfspraakFlyout): klant en contactpersoon als
// zoekveld (het contact gefilterd op de klant; een contact kiezen zonder klant zet de klant), type
// afspraak (meetingsoort in twee groepen: Afspraak op locatie en Meeting op afstand; vult duur en agenda),
// de vorm volgt uit het type (een bezoek, online of telefonisch; geen eigen keuze meer), titel (verplicht, voorgesteld uit soort en
// klant), datum, start, duur met de vrije momenten, herhaling, voor wie (Gevorderd), collega's
// uitnodigen, locatie, herinnering, aanleiding of context en beschrijving. Op de telefoon een
// schuifvenster van onderen. De afspraak krijgt account_id en contact_id en staat daarmee op de
// accountkaart en de contactkaart. Heeft de prospect nog geen contact, dan maak je er hier direct een (SnelContact).
import { CATEGORIE_LABEL, HERHALINGEN, categorieVan, herhalingsDatums, vormVoorSoort, type Categorie, type Herhaling } from '~~/shared/agenda'
import { plusDagen } from '~~/shared/datum'
const props = defineProps<{ open: boolean; account?: { id: string; naam: string } | null; taskId?: string | null; aanleiding?: string | null; voorWie?: string | null; voorstel?: { datum?: string; start?: string; duurMin?: number; vorm?: string; soort?: string } | null; contactId?: string | null }>()
const emit = defineEmits<{ sluit: []; gepland: [id: string] }>()
const { functie, me } = useMe()
const toast = useToast()
const voorCollega = computed(() => !!functie('agenda.voorCollega')?.beschikbaar)
const soorten = ref<any[]>([])
const voorWieLijst = ref<{ id: string; naam: string; werkplek: string }[]>([])
const collegas = ref<{ id: string; naam: string; werkplek: string | null }[]>([])
type Contact = { id: string; naam: string; rol: string | null; functie: string | null; accountId: string; accountNaam: string; plaats?: string | null }
const klant = ref<{ id: string; naam: string; plaats?: string | null } | null>(null)
const contact = ref<Contact | null>(null)
const klantContacten = ref<Contact[]>([])
const vrij = ref<{ start: string; eind: string }[]>([])
const bezig = ref(false)
const fout = ref('')
const titelHandmatig = ref(false)
const deelnemerKeuze = ref('')
const vandaag = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })
const leeg = () => ({ meetingsoortId: '', vorm: 'online', titel: '', datum: vandaag(), start: '10:00', duurMin: 30, herhaling: 'geen' as Herhaling, herhalingTot: plusDagen(vandaag(), 91), voorWie: '', deelnemers: [] as string[], locatie: '', herinneringMin: 15, aanleiding: '', beschrijving: '' })
const f = reactive(leeg())
const soort = computed(() => soorten.value.find((s) => s.id === f.meetingsoortId))
// Type afspraak in twee groepen zoals in DealDrive; de vaste volgorde eerst, eigen soorten daarna.
const VOLGORDE = ['gepland-bezoek', 'ongepland-bezoek', 'demo-op-locatie', 'event', 'beurs', 'online-meeting', 'belafspraak', 'demo', 'webinar', 'accountoverleg']
const plek = (slug: string) => { const i = VOLGORDE.indexOf(slug); return i < 0 ? VOLGORDE.length : i }
const groepen = computed(() => (['bezoek', 'meeting'] as Categorie[]).map((c) => ({
  categorie: c, label: CATEGORIE_LABEL[c],
  soorten: soorten.value.filter((s) => categorieVan(s) === c).sort((a, b) => plek(a.slug) - plek(b.slug) || a.naam.localeCompare(b.naam, 'nl')),
})).filter((g) => g.soorten.length))
const intern = computed(() => soort.value?.type === 'intern')
const voorgesteldeTitel = computed(() => soort.value ? (klant.value ? `${soort.value.naam} · ${klant.value.naam}` : soort.value.naam) : '')

let laadNr = 0
watch(() => props.open, async (o) => {
  if (!o) return
  const nr = ++laadNr
  Object.assign(f, leeg(), { aanleiding: props.aanleiding ?? '', voorWie: props.voorWie ?? '' })
  titelHandmatig.value = false; fout.value = ''; deelnemerKeuze.value = ''
  contact.value = null
  const zelfde = !!props.account && klant.value?.id === props.account.id
  klant.value = props.account ?? null
  if (zelfde) laadContacten(klant.value)
  const [m, a, c]: any[] = await Promise.all([
    $fetch('/api/meetingsoorten'),
    voorCollega.value ? $fetch('/api/agenda', { query: { van: vandaag(), tot: vandaag() } }).catch(() => null) : null,
    $fetch('/api/agenda/collegas').catch(() => []),
  ])
  if (nr !== laadNr) return
  soorten.value = (m.soorten ?? []).filter((s: any) => s.actief)
  voorWieLijst.value = (a?.gebruikers ?? []).filter((u: any) => u.id !== me.value?.gebruiker.id)
  collegas.value = c ?? []
  // Een voorstel met een vorm kiest een soort met die vorm: een bezoek is een Gepland bezoek, telefoon een Belafspraak.
  const v = props.voorstel
  const pastBij = (s: any) => !v?.vorm || vormVoorSoort(s) === v.vorm
  const opSlug = (slug: string) => soorten.value.find((s) => s.slug === slug)
  let eerste = opSlug(v?.soort ?? 'kennismaking')
  if (!eerste || !pastBij(eerste)) eerste = opSlug(v?.vorm === 'bezoek' ? 'gepland-bezoek' : v?.vorm === 'telefoon' ? 'belafspraak' : 'online-meeting')
  if (!eerste || !pastBij(eerste)) eerste = soorten.value.find((s) => s.type === 'klant' && pastBij(s)) ?? soorten.value.find((s) => s.type === 'klant')
  if (eerste) f.meetingsoortId = eerste.id
  // Een voorstel (tussenstop, P14; klik in de agenda): datum, start in het gat, duur en vorm.
  if (v) { await nextTick(); Object.assign(f, v.datum ? { datum: v.datum } : {}, v.start ? { start: v.start } : {}, v.duurMin ? { duurMin: v.duurMin } : {}); if (soort.value) f.vorm = vormVoorSoort(soort.value) }
  await nextTick(); opslag.basis()
}, { immediate: true })
// Opslaan-status in de kop (FlyoutShell): Gewijzigd tot Plan afspraak opslaat; sluiten vraagt dan eerst.
const opslag = useFlyoutOpslag()
opslag.volg(() => [f, klant.value?.id ?? null, contact.value?.id ?? null])
const ai = computed(() => ({ accountId: klant.value?.id ?? null, label: klant.value?.naam ?? 'Nieuwe afspraak', vraag: '', voorstellen: ['Stel een moment voor', 'Schrijf de uitnodiging', 'Wat is een goed doel voor dit gesprek?'] }))
// De vorm volgt uit het type: een bezoek uit de groep Afspraak, online of telefonisch zoals de soort zegt.
watch(soort, (s) => { if (s) { f.duurMin = s.duurMin; f.vorm = vormVoorSoort(s); f.herinneringMin = s.data?.herinneringMin ?? 15 } })
watch(voorgesteldeTitel, (t) => { if (!titelHandmatig.value) f.titel = t }, { immediate: true })
function typTitel(e: Event) { f.titel = (e.target as HTMLInputElement).value; titelHandmatig.value = !!f.titel.trim() }

// Klant: zoeken op naam; kiezen laadt de contacten (beslisser eerst) en kiest er een voor.
const zoekKlant = (q: string) => zoekAccounts(q)
async function laadContacten(k: { id: string } | null) {
  klantContacten.value = []
  if (contact.value && contact.value.accountId !== k?.id) contact.value = null
  if (!k) return
  const lijst = await $fetch<Contact[]>('/api/contacten/kies', { query: { accountId: k.id } }).catch(() => [] as Contact[])
  if (klant.value?.id !== k.id) return
  klantContacten.value = lijst
  // Het meegegeven contact, anders de beslisser (de lijst staat beslisser eerst).
  if (!contact.value) contact.value = lijst.find((c) => c.id === props.contactId) ?? lijst[0] ?? null
}
watch(klant, (k) => laadContacten(k))
function kiesKlant(a: { id: string; naam: string; plaats?: string | null; branche?: string | null }) { klant.value = a }
function wisKlant() { klant.value = null; contact.value = null }

// Contact: met klant filteren we de contacten van die klant, zonder klant zoeken we overal.
async function zoekContact(q: string): Promise<Contact[]> {
  if (!klant.value) return (await zoekContacten(q)) as Contact[]
  const z = q.trim().toLowerCase()
  return klantContacten.value.filter((c) => !z || c.naam.toLowerCase().includes(z) || String(c.functie ?? '').toLowerCase().includes(z))
}
function nieuwContact(c: { id: string; naam: string; functie: string | null; rol: string | null; accountId: string; accountNaam: string }) {
  klantContacten.value = [...klantContacten.value, c]
  contact.value = c
}
function kiesContact(c: Contact) {
  contact.value = c
  if (!klant.value || klant.value.id !== c.accountId) klant.value = { id: c.accountId, naam: c.accountNaam, plaats: c.plaats ?? null }
}

// Collega's uitnodigen: een keuzelijst die terugspringt, gekozen collega's als chip.
const vrijeCollegas = computed(() => collegas.value.filter((c) => !f.deelnemers.includes(c.id) && c.id !== f.voorWie))
const collegaNaam = (id: string) => collegas.value.find((c) => c.id === id)?.naam ?? id
function voegDeelnemerToe() { if (deelnemerKeuze.value && !f.deelnemers.includes(deelnemerKeuze.value)) f.deelnemers.push(deelnemerKeuze.value); deelnemerKeuze.value = '' }

// Herhaling: hoeveel afspraken de reeks wordt.
const reeks = computed(() => herhalingsDatums(f.datum, f.herhaling, f.herhalingTot))

// Vrije momenten van jezelf of de collega op de gekozen dag (agenda bezet telt mee, gat 37).
watch(() => [props.open, f.voorWie, f.datum, f.duurMin], async () => {
  if (!props.open || !f.datum) return
  try { const r: any = await $fetch('/api/agenda/vrij', { query: { gebruiker: f.voorWie || undefined, dag: f.datum, duur: f.duurMin } }); vrij.value = r.vrij.slice(0, 8) } catch { vrij.value = [] }
}, { immediate: true })
const tijd = (iso: string) => new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })
const DUREN = [10, 15, 30, 45, 60, 90, 120, 180]
const duurTekst = (d: number) => (d >= 60 ? `${String(d / 60).replace('.', ',')} uur` : `${d} min`)
function startIso() {
  // Datum en tijd zijn Nederlandse tijd; de server rekent in UTC.
  const proef = new Date(`${f.datum}T${f.start}:00Z`)
  const verschil = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Amsterdam', hour: 'numeric', hourCycle: 'h23' }).format(proef)) - proef.getUTCHours()
  return new Date(proef.getTime() - ((verschil + 24) % 24) * 3600_000).toISOString()
}
const kanPlannen = computed(() => !!f.meetingsoortId && (!!klant.value || intern.value) && !!f.titel.trim() && !!f.datum && !!f.start)
async function plan() {
  if (!kanPlannen.value) { fout.value = !klant.value && !intern.value ? 'Kies eerst een prospect.' : 'Vul een titel, datum en starttijd in.'; return }
  bezig.value = true; fout.value = ''
  try {
    const r: any = await opslag.bewaar(() => $fetch('/api/afspraken', { method: 'POST', body: {
      accountId: klant.value?.id ?? null, contactId: klant.value ? contact.value?.id ?? null : null, meetingsoortId: f.meetingsoortId, vorm: f.vorm, titel: f.titel.trim(), start: startIso(), duurMin: f.duurMin,
      herhaling: f.herhaling, herhalingTot: f.herhaling === 'geen' ? null : f.herhalingTot, voorWie: f.voorWie || null, collegaUitnodigen: f.deelnemers,
      locatie: f.locatie || null, herinneringMin: f.herinneringMin, aanleiding: f.aanleiding || null, beschrijving: f.beschrijving || null, taskId: props.taskId ?? null,
    } }))
    toast.toon(r.tekst); emit('gepland', r.id)
  } catch (e) { fout.value = foutTekst(e); toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
</script>

<template>
  <FlyoutShell :open="open" titel-id="pa-titel-kop" :opslag="opslag" :ai="ai" data-test="plan-afspraak" @sluit="emit('sluit')" @bewaar="plan">
    <template #kop>
            <span class="fo-kicker">Nieuwe afspraak<template v-if="soort"> · {{ soort.naam }}</template></span>
            <h2 id="pa-titel-kop" class="fo-titel">Plan een afspraak in</h2>
            <p class="taak-meta" data-test="pa-uitleg"><template v-if="f.vorm === 'bezoek'">Verschijnt in de agenda en op de route van die dag.</template><template v-else>Verschijnt in de agenda en op Meetings.</template> Voeg een briefing toe vanuit de accountkaart.</p>
    </template>
        <form id="pa-form" class="fo-body fo-body--formulier pa-body" @submit.prevent="plan">
          <!-- Prospect en contactpersoon: zoekvelden, bewust als eerste. -->
          <div class="veld">
            <span id="pa-klant-label" class="veld-label">Prospect <span v-if="!intern" class="veld-verplicht">*</span></span>
            <div v-if="klant" class="pa-keuze" data-test="pa-klant-gekozen">
              <span class="pa-keuze-tekst"><strong>{{ klant.naam }}</strong><span v-if="klant.plaats" class="meta"> · {{ klant.plaats }}</span></span>
              <button v-if="!account" type="button" class="pa-wis" aria-label="Wis gekozen prospect" data-test="pa-klant-wis" @click="wisKlant"><Icoon naam="X" :grootte="16" /></button>
            </div>
            <ZoekKiezer v-else :zoek="zoekKlant" placeholder="Zoek op prospectnaam" labelledby="pa-klant-label" data-test="pa-klant" :optie-test="(x) => `pa-klant-${x.id}`" :sub="accountSub" leeg="Geen prospect gevonden." @kies="kiesKlant" />
          </div>

          <div class="veld">
            <span id="pa-contact-label" class="veld-label">Contactpersoon</span>
            <div v-if="contact" class="pa-keuze" data-test="pa-contact-gekozen">
              <span class="pa-keuze-tekst"><strong>{{ contact.naam }}</strong><span v-if="contact.functie || contact.rol" class="meta"> · {{ contact.functie ?? contact.rol }}</span></span>
              <button type="button" class="pa-wis" aria-label="Wis gekozen contactpersoon" data-test="pa-contact-wis" @click="contact = null"><Icoon naam="X" :grootte="16" /></button>
            </div>
            <ZoekKiezer
              v-else :zoek="zoekContact" :sleutel="`${klant?.id ?? ''}:${klantContacten.length}`"
              :placeholder="klant ? `Zoek een contact bij ${klant.naam}` : 'Zoek op contactnaam'" labelledby="pa-contact-label" data-test="pa-contact"
              :optie-test="(c) => `pa-contact-${c.id}`" :sub="(c) => [c.functie ?? c.rol, klant ? null : c.accountNaam].filter(Boolean).join(' · ')"
              :leeg="klant ? (klantContacten.length ? 'Geen contactpersoon gevonden.' : 'Deze prospect heeft nog geen contactpersonen.') : 'Geen contactpersoon gevonden.'"
              @kies="kiesContact"
            />
          </div>
          <SnelContact :account="klant ? { id: klant.id, naam: klant.naam } : null" prefix="pa-nc" :geen-contacten="!klantContacten.length" @gemaakt="nieuwContact" />

          <label class="veld"><span class="veld-label">Type afspraak <span class="veld-verplicht">*</span></span>
            <select v-model="f.meetingsoortId" class="invoer" required :data-vorm="soort ? f.vorm : undefined" data-test="pa-soort">
              <optgroup v-for="g in groepen" :key="g.categorie" :label="g.label" :data-test="`pa-groep-${g.categorie}`"><option v-for="s in g.soorten" :key="s.id" :value="s.id" :data-test="`pa-soort-${s.slug}`">{{ s.naam }}</option></optgroup>
            </select>
          </label>

          <label class="veld"><span class="veld-label">Titel <span class="veld-verplicht">*</span></span>
            <input :value="f.titel" class="invoer" required maxlength="140" placeholder="Bijvoorbeeld: Kwartaalbespreking leverplan" data-test="pa-titel" @input="typTitel">
          </label>

          <div class="pa-rij3">
            <label class="veld"><span class="veld-label">Datum <span class="veld-verplicht">*</span></span><input v-model="f.datum" type="date" class="invoer" required data-test="pa-datum"></label>
            <label class="veld"><span class="veld-label">Start <span class="veld-verplicht">*</span></span><input v-model="f.start" type="time" step="900" class="invoer" required data-test="pa-start"></label>
            <label class="veld"><span class="veld-label">Duur</span><select v-model.number="f.duurMin" class="invoer" data-test="pa-duur"><option v-for="d in DUREN" :key="d" :value="d">{{ duurTekst(d) }}</option><option v-if="!DUREN.includes(f.duurMin)" :value="f.duurMin">{{ f.duurMin }} min</option></select></label>
          </div>
          <div v-if="vrij.length" class="pa-krap" data-test="pa-vrij"><span class="veld-label">Vrij{{ f.voorWie ? ' bij je collega' : '' }}</span>
            <div class="ag-keuzes"><button v-for="v in vrij" :key="v.start" type="button" class="pil pil--leeg pa-vrij-knop" :class="{ 'pil--zwart': tijd(v.start) === f.start }" @click="f.start = tijd(v.start)">{{ tijd(v.start) }}</button></div>
          </div>
          <p v-else class="veld-uitleg pa-krap">Geen vrije momenten meer op deze dag.</p>

          <div class="pa-rij3">
            <label class="veld"><span class="veld-label">Herhaling</span><select v-model="f.herhaling" class="invoer" data-test="pa-herhaling"><option v-for="h in HERHALINGEN" :key="h.code" :value="h.code">{{ h.label }}</option></select></label>
            <label v-if="f.herhaling !== 'geen'" class="veld"><span class="veld-label">Herhalen tot</span><input v-model="f.herhalingTot" type="date" class="invoer" :min="f.datum" data-test="pa-herhaling-tot"></label>
            <p v-if="f.herhaling !== 'geen'" class="veld-uitleg pa-reeks" data-test="pa-reeks">{{ reeks.length }} {{ reeks.length === 1 ? 'afspraak' : 'afspraken' }} in totaal</p>
          </div>

          <label v-if="voorCollega && voorWieLijst.length" class="veld"><span class="veld-label">Voor wie</span><select v-model="f.voorWie" class="invoer" data-test="pa-voor-wie"><option value="">Mij</option><option v-for="u in voorWieLijst" :key="u.id" :value="u.id">{{ u.naam.replace(/^Testgebruiker /, '') }}<template v-if="u.werkplek"> · {{ u.werkplek }}</template></option></select></label>

          <div v-if="collegas.length" class="veld">
            <label for="pa-collega" class="veld-label">Collega's uitnodigen</label>
            <select id="pa-collega" v-model="deelnemerKeuze" class="invoer" data-test="pa-collega" @change="voegDeelnemerToe"><option value="">Kies een collega</option><option v-for="c in vrijeCollegas" :key="c.id" :value="c.id">{{ c.naam }}</option></select>
            <div v-if="f.deelnemers.length" class="pa-chips">
              <span v-for="id in f.deelnemers" :key="id" class="pa-chip" :data-test="`pa-deelnemer-${id}`">{{ collegaNaam(id) }}<button type="button" class="pa-chip-weg" :aria-label="`${collegaNaam(id)} verwijderen`" @click="f.deelnemers = f.deelnemers.filter((d) => d !== id)"><Icoon naam="X" :grootte="14" /></button></span>
            </div>
            <p v-if="f.deelnemers.length" class="veld-uitleg">De afspraak komt ook in de agenda van {{ f.deelnemers.length === 1 ? 'deze collega' : 'deze collega\'s' }} te staan.</p>
          </div>

          <label class="veld"><span class="veld-label">{{ f.vorm === 'bezoek' ? 'Locatie' : 'Locatie of meetinglink' }}</span><input v-model="f.locatie" class="invoer" data-test="pa-locatie" :placeholder="f.vorm === 'bezoek' ? 'Leeg is het adres van de prospect' : f.vorm === 'online' ? 'Komt uit je gekoppelde agenda' : ''"></label>
          <label class="veld"><span class="veld-label">Herinnering</span><select v-model.number="f.herinneringMin" class="invoer"><option :value="0">Geen</option><option :value="10">10 minuten vooraf</option><option :value="15">15 minuten vooraf</option><option :value="30">30 minuten vooraf</option><option :value="60">1 uur vooraf</option><option :value="1440">1 dag vooraf</option></select></label>
          <label class="veld"><span class="veld-label">Aanleiding of context</span><input v-model="f.aanleiding" class="invoer" placeholder="Bijvoorbeeld: inzicht nieuwe vestiging" data-test="pa-aanleiding"></label>
          <label class="veld"><span class="veld-label">Beschrijving</span><textarea v-model="f.beschrijving" class="invoer" rows="3" placeholder="Optioneel: doel, agendapunten, voorbereiding" data-test="pa-beschrijving" /></label>
          <p v-if="fout" class="veld-fout" data-test="pa-fout">{{ fout }}</p>
        </form>
    <template #voet>
        <footer class="fo-foot fs-voet">
          <button type="submit" form="pa-form" class="dd-actie dd-actie--zwart fs-hoofdactie" :disabled="bezig || !kanPlannen" data-test="pa-plan"><Icoon naam="Check" :grootte="16" />{{ bezig ? 'Plannen…' : reeks.length > 1 && f.herhaling !== 'geen' ? `Plan ${reeks.length} afspraken` : 'Plan afspraak' }}</button>
          <span class="fo-foot-vul" />
        </footer>
    </template>
  </FlyoutShell>
</template>

<style scoped>
.pa-body { display: flex; flex-direction: column; gap: 16px; }
.pa-body > .veld { margin: 0; }
.pa-krap { margin-top: -8px; }
.pa-keuze { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 44px; padding: 4px 4px 4px 12px; border: 1px solid var(--border-strong); border-radius: var(--radius); background: var(--surface); }
.pa-keuze-tekst { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pa-wis { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; flex-shrink: 0; border: 0; background: none; color: var(--muted); cursor: pointer; border-radius: var(--radius); }
.pa-wis:hover { color: var(--ink); background: var(--wit); }
.pa-rij3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; align-items: end; }
.pa-reeks { margin: 0 0 12px; }
.pa-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.pa-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 2px 2px 10px; background: var(--surface); border: 1px solid var(--border-strong); border-radius: var(--radius); font-size: var(--fs-klein); }
.pa-chip-weg { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: 0; background: none; color: var(--muted); cursor: pointer; }
@media (max-width: 720px) {
  .pa-rij3 { grid-template-columns: 1fr 1fr; }
  .pa-chip-weg { width: 44px; height: 44px; }
  .pa-wis { width: 44px; height: 44px; }
}
</style>
