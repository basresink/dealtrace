<script setup lang="ts">
// Accountkaart (F03, 8.5.5) in de opzet van DealDrive: kop met logovlak, kruimel, branche en plaats, naam met
// klassepil, website en de stuurstrip; rechts Info, Contacten en Briefing. Daaronder de statstrook, de
// aanleiding en de tabbladen Tijdlijn, Inzichten, Taken, Notities, E-mails, Afspraken, Gespreksverslagen,
// Deals, Campagnes en Documenten, plus Reis en kwalificatie en Eigen velden. Het tabblad staat in de URL
// (?tab=). Op de telefoon compact met een plakkende actiebalk (Bellen, Mail, WhatsApp, Navigeer).
import { CONTACTROL_LABEL, type ContactRol } from '~~/shared/contactgegevens'
import { ACTIE_LABEL, HERKOMST_LABEL } from '~~/shared/taken'
import { STATUS_LABEL, STATUS_PIL, datumKort, fasePil, klasseKort, telLink, toonTelefoon } from '~/utils/accountWeergave'
const route = useRoute()
const router = useRouter()
const { functie, me } = useMe()
if (!functie('prospects.kaart')?.beschikbaar) throw createError({ statusCode: 403, statusMessage: 'Geen toegang' })
const toast = useToast()
const { data: a, refresh } = await useFetch<any>(() => `/api/accounts/${route.params.id}`)
const leeg = { taken: [], inzichten: [], afspraken: [], mails: [], verslagen: [], deals: [], gebeurtenissen: [], campagnes: [], documenten: [] }
const { data: t, refresh: refreshTabs } = await useFetch<any>(() => `/api/accounts/${route.params.id}/tabbladen`, { default: () => leeg })
async function ververs() { await Promise.all([refresh(), refreshTabs()]) }
const { openen: openAi } = useAssistent()
const aiAan = computed(() => !!useMe().functie('assistent.chat')?.beschikbaar)
// P15: contactpersonen zoeken via Datacollectief, met bevestiging van de kosten.
const dcBezig = ref(false)
const online = ref(true)
onMounted(() => { online.value = navigator.onLine; window.addEventListener('online', () => { online.value = true }); window.addEventListener('offline', () => { online.value = false }) })
async function zoekContacten() {
  if (!confirm('Contactpersonen zoeken via Datacollectief? Dit kost tot 5 records van jullie tegoed.')) return
  dcBezig.value = true
  try { const r: any = await ($fetch as any)(`/api/accounts/${a.value.id}/verrijk-contacten`, { method: 'POST', body: { max: 5 } }); toast.toon(r.tekst); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { dcBezig.value = false }
}
// De naam voor de contextchip van de assistent, ook als die vanuit de mobiele kop opent.
const accountNaam = useState<string | null>('accountNaam', () => null)
watch(() => a.value?.naam, (n) => { accountNaam.value = n ?? null }, { immediate: true })
onBeforeUnmount(() => { accountNaam.value = null })
if (!a.value) throw createError({ statusCode: 404, statusMessage: 'Account onbekend' })
const infoOpen = ref(false)
const briefingOpen = ref(false)
// P17: overdracht na de eerste afspraak.
const overdragenOpen = ref(route.query.overdragen === '1')
const OV_NAAR: Record<string, string> = { dealdrive: 'DealDrive', crm: 'het CRM', collega: 'een collega' }
const OV_STATUS: Record<string, string> = { klaar: 'Klaar', verstuurd: 'Verstuurd', bevestigd: 'Bevestigd', mislukt: 'Mislukt' }
// P23: het antwoord op "Mag dit een bewijs worden?" na een gewonnen deal in DealDrive.
async function bewijs(ja: boolean) {
  try { await $fetch(`/api/accounts/${route.params.id}/bewijs`, { method: 'POST', body: { ja } }); toast.toon(ja ? 'Je salesmanager krijgt het als suggestie.' : 'Genoteerd. Er gaat niets naar je salesmanager.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function overdrachtOpnieuw() {
  try { const r = await $fetch<any>(`/api/overdrachten/${a.value.overdracht.id}/opnieuw`, { method: 'POST' }); toast.toon(r.status === 'mislukt' ? 'Opnieuw mislukt.' : 'Overdracht opnieuw verstuurd.'); await ververs() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const contactenOpen = ref(false)
const verwijderOpen = ref(false)
const notitie = ref('')
// P05: reis, fase en status
const geschiedenisOpen = ref(false)
const neeOpen = ref(false)
const handeling = ref<null | 'fase' | 'pauzeer' | 'verplaats' | 'terugop'>(null)
async function zetLeverancier(id: string) {
  try { await $fetch(`/api/accounts/${a.value.id}`, { method: 'PUT', body: { huidigeLeverancierId: id || null } }); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
// P19: de Profielbouwer stelt het buying committee voor (3 credits).
const committee = ref<any[] | null>(null)
const committeeBezig = ref(false)
async function stelCommitteeVoor() {
  committeeBezig.value = true
  try { const r = await $fetch<any>(`/api/accounts/${a.value.id}/committee`, { method: 'POST' }); committee.value = r.voorstellen; if (!r.voorstellen.length) toast.toon(r.reden ?? 'Nog te weinig functies bekend om een voorstel te doen.') } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { committeeBezig.value = false }
}
async function klaar(tekst: string) { neeOpen.value = false; handeling.value = null; toast.toon(tekst); await ververs() }
async function kwalificeer() {
  try {
    const r = await $fetch<any>('/api/reis/gebeurtenis', { method: 'POST', body: { accountId: a.value.id, gebeurtenis: 'gekwalificeerd' } })
    toast.toon(r.gewisseld ? 'Gekwalificeerd; het account staat in de reis.' : 'Geen wissel.'); await ververs()
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function zetBand(letter: string, ja: boolean) {
  try {
    const r = await $fetch<any>(`/api/accounts/${a.value.id}/band`, { method: 'PUT', body: { letter, ja } })
    if (r.gemeld?.gewisseld) toast.toon('BAND 3 van 4: gekwalificeerd.')
    await refresh()
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
function openFase() { if (a.value.kan.geschiedenis) geschiedenisOpen.value = true }
const primair = computed(() => a.value.contacten.find((c: any) => c.id === a.value.primairContactId) ?? null)
const belNummer = computed(() => (primair.value && !primair.value.belMeNiet ? primair.value.mobiel ?? primair.value.telefoon : null) ?? a.value.telefoon)
const mailAdres = computed(() => primair.value?.email ?? a.value.email)
const whatsapp = computed(() => primair.value?.consent?.whatsapp?.status === 'ja' ? (primair.value.mobiel ?? null) : null)
const navigeer = computed(() => {
  const adres = [a.value.adres, a.value.postcode, a.value.plaats].filter(Boolean).join(', ')
  if (!adres) return null
  const ios = import.meta.client && /iPhone|iPad/.test(navigator.userAgent)
  return ios ? `https://maps.apple.com/?q=${encodeURIComponent(adres)}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adres)}`
})
async function zetKlasse(k: string) {
  try { await $fetch(`/api/accounts/${a.value.id}`, { method: 'PUT', body: { klasse: k || null } }); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function bewaarNotitie() {
  if (!notitie.value.trim()) return
  try { await $fetch(`/api/accounts/${a.value.id}/notities`, { method: 'POST', body: { tekst: notitie.value } }); notitie.value = ''; await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function verwijder() {
  verwijderOpen.value = false
  try { await $fetch(`/api/accounts/${a.value.id}`, { method: 'DELETE' }); toast.toon(`${a.value.naam} is verwijderd.`); await navigateTo('/prospects/alle') } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const SOORT: Record<string, string> = { gebeld: 'Gebeld', mail: 'Mail', notitie: 'Notitie', bericht: 'Bericht', linkedin: 'LinkedIn', afspraak: 'Afspraak', bezoek: 'Bezoek', 'account verwijderd': 'Verwijderd', reis: 'Reis', import: 'Import' }
const notities = computed(() => a.value.tijdlijn.filter((x: any) => x.soort === 'notitie'))
const momenten = computed(() => a.value.tijdlijn.filter((x: any) => x.soort !== 'notitie').slice(0, 3))
useHead({ title: computed(() => `${a.value?.naam ?? 'Account'} · Dealtrace`) })
// P14: de binnendienst zet een prospect klaar voor de regiodag van een collega van de buitendienst.
const klaarOpen = ref(false)
const kaartjeOpen = ref(false)
const kanKlaarzetten = computed(() => !!functie('bezoeken.klaarzetten')?.beschikbaar && me.value?.gebruiker.werkplek !== 'buitendienst')
// P30: een account buiten het dagpakket bewaren voor offline.
const dagpakket = useDagpakket()
const inPakket = computed(() => !!dagpakket.account(String(route.params.id)))
async function bewaarOffline() { await dagpakket.bewaarVoorOffline(String(route.params.id), a.value?.naam ?? ''); toast.toon('Bewaard voor offline.') }

// Kop: logovlak met initialen in een vaste kleur per naam, klassepil in de kleur van de letter.
const MERK = ['#194c8f', '#1e7c4a', '#c0392b', '#4c1d95', '#b45309', '#0a0a0a', '#0f766e']
const initialen = computed(() => a.value.naam.replace(/^(Test)(?=[A-Z])/, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase())
const merkKleur = computed(() => MERK[[...a.value.naam].reduce((s: number, c: string) => s + c.charCodeAt(0), 0) % MERK.length])
const klasseNaam = computed(() => a.value.klassen.find((k: any) => k.id === a.value.klasse)?.naam ?? klasseKort(a.value.klasse, a.value.klassen))
const klasseKleur = computed(() => ({ A: 'a', B: 'b', C: 'c', D: 'd' } as Record<string, string>)[klasseKort(a.value.klasse, a.value.klassen).charAt(0).toUpperCase()] ?? (a.value.klasse ? 'overig' : 'geen'))
const websiteKort = computed(() => (a.value.website ? String(a.value.website).replace(/^https?:\/\//, '').replace(/\/$/, '') : null))
const datumLang = (d: string | null) => (d ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Amsterdam' }).format(new Date(d)).replace('.', '') : '–')
const laatsteContact = computed(() => {
  const d = a.value.laatsteContactOp ?? a.value.stuur.laatsteActie
  if (!d) return 'nog nooit'
  const dagen = Math.floor((Date.now() - Date.parse(d)) / 864e5)
  return dagen < 1 ? 'vandaag' : dagen < 31 ? `${dagen} ${dagen === 1 ? 'dag' : 'dagen'}` : `${Math.floor(dagen / 30)} mnd`
})

// Statstrook (opzet uit DealDrive).
const openTaken = computed(() => t.value.taken.filter((x: any) => ['open', 'bezig'].includes(x.status)))
const achterstallig = computed(() => openTaken.value.filter((x: any) => x.achterstallig).length)
const nieuweInzichten = computed(() => t.value.inzichten.filter((x: any) => x.status === 'nieuw').length)
const openDeals = computed(() => t.value.deals.filter((d: any) => !['gewonnen', 'verloren', 'mislukt'].includes(d.fase)).length)

// Tabbladen, met het actieve tabblad in de URL.
type Tab = 'tijdlijn' | 'inzichten' | 'taken' | 'notities' | 'mails' | 'afspraken' | 'verslagen' | 'deals' | 'campagnes' | 'documenten' | 'kwalificatie' | 'eigenvelden'
const TABS: Tab[] = ['tijdlijn', 'inzichten', 'taken', 'notities', 'mails', 'afspraken', 'verslagen', 'deals', 'campagnes', 'documenten', 'kwalificatie', 'eigenvelden']
const tab = computed<Tab>(() => (TABS.includes(route.query.tab as Tab) ? route.query.tab as Tab : 'tijdlijn'))
function kiesTab(x: Tab) { router.replace({ query: { ...route.query, tab: x === 'tijdlijn' ? undefined : x } }) }

// Tijdlijn: inzichten, taken, afspraken, deals en contactmomenten samen, nieuwste eerst.
type TlSoort = 'inzicht' | 'taak' | 'afspraak' | 'deal' | 'contact'
interface TlItem { key: string; soort: TlSoort; soortLabel: string; typeLabel: string; bron?: string | null; titel: string; tekst?: string | null; status?: string; statusSoort?: 'klaar' | 'laat' | 'open'; ms: number; open?: () => void }
const VORM: Record<string, string> = { bezoek: 'Bezoek', online: 'Online', telefoon: 'Telefoon' }
const AFSPRAAK_STATUS: Record<string, string> = { gepland: 'Gepland', afgerond: 'Gehouden', geannuleerd: 'Geannuleerd', 'no-show': 'Niet verschenen' }
const DEAL_FASE: Record<string, string> = { overgedragen: 'Overgedragen', lopend: 'Loopt in DealDrive', gewonnen: 'Gewonnen', verloren: 'Verloren', klaar: 'Klaar', verstuurd: 'Verstuurd', bevestigd: 'Bevestigd', mislukt: 'Mislukt' }
const tlAlles = computed<TlItem[]>(() => {
  const uit: TlItem[] = []
  for (const s of t.value.inzichten) uit.push({ key: `i-${s.id}`, soort: 'inzicht', soortLabel: 'Inzicht', typeLabel: s.agent ? s.agent : s.bron === 'extern' ? 'Extern' : 'Intern', bron: s.specifiekeBron, titel: s.title, tekst: s.waarom, ms: Date.parse(s.createdAt), open: () => { inzicht.value = s } })
  for (const x of t.value.taken) {
    const open = ['open', 'bezig'].includes(x.status)
    uit.push({ key: `t-${x.id}`, soort: 'taak', soortLabel: 'Taak', typeLabel: ACTIE_LABEL[x.actionType] ?? 'Taak', titel: x.title, tekst: x.aanleiding, status: !open ? 'Afgerond' : x.achterstallig ? 'Achterstallig' : 'Open', statusSoort: !open ? 'klaar' : x.achterstallig ? 'laat' : 'open', ms: Date.parse(x.afgerondOp ?? x.dueDate ?? '') || 0, open: () => { taakId.value = x.id } })
  }
  for (const x of t.value.afspraken) uit.push({ key: `a-${x.id}`, soort: 'afspraak', soortLabel: 'Afspraak', typeLabel: VORM[x.vorm] ?? x.vorm, titel: x.soort + (x.contact ? ` met ${x.contact}` : ''), tekst: x.locatie, status: AFSPRAAK_STATUS[x.status] ?? x.status, statusSoort: x.status === 'afgerond' ? 'klaar' : x.status === 'gepland' ? 'open' : 'laat', ms: Date.parse(x.start), open: () => { afspraakId.value = x.id } })
  for (const d of t.value.deals) uit.push({ key: `d-${d.id}`, soort: 'deal', soortLabel: 'Deal', typeLabel: OV_NAAR[d.naar] ?? d.naar, titel: d.titel, tekst: d.eigenaar ? `Eigenaar in DealDrive: ${d.eigenaar}` : null, status: DEAL_FASE[d.fase] ?? d.fase, statusSoort: d.fase === 'gewonnen' ? 'klaar' : ['verloren', 'mislukt'].includes(d.fase) ? 'laat' : 'open', ms: Date.parse(d.op) })
  for (const x of a.value.tijdlijn.filter((m: any) => m.soort !== 'notitie')) uit.push({ key: `c-${x.id}`, soort: 'contact', soortLabel: 'Contact', typeLabel: SOORT[x.soort] ?? x.soort, titel: [SOORT[x.soort] ?? x.soort, x.uitkomst ? String(x.uitkomst).replace(/_/g, ' ') : null].filter(Boolean).join(' · '), tekst: [x.tekst, x.door ? String(x.door).replace(/^Testgebruiker /, '') : null].filter(Boolean).join(' · ') || null, ms: Date.parse(x.op) })
  return uit.sort((p, q) => q.ms - p.ms)
})
const tlFilter = ref<'alles' | TlSoort>('alles')
const tlFiltersOpen = ref(false)
const tlSoorten = computed(() => {
  const tel = (s: TlSoort) => tlAlles.value.filter((i) => i.soort === s).length
  return [{ id: 'alles' as const, label: 'Alles', n: tlAlles.value.length }, ...([['inzicht', 'Inzichten'], ['taak', 'Taken'], ['afspraak', 'Afspraken'], ['deal', 'Deals'], ['contact', 'Contactmomenten']] as const).map(([id, label]) => ({ id, label, n: tel(id) })).filter((s) => s.n)]
})
const tijdlijn = computed(() => (tlFilter.value === 'alles' ? tlAlles.value : tlAlles.value.filter((i) => i.soort === tlFilter.value)))
const tlDatum = (ms: number) => (ms ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' }).format(new Date(ms)).replace('.', '') : '')

// Taken per groep, zoals DealDrive: achterstallig, vandaag, deze week, later, afgerond.
const takenGroepen = computed(() => {
  const vandaag = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })
  const week = new Date(Date.now() + 7 * 864e5).toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })
  const dag = (x: any) => (x.dueDate ? new Date(x.dueDate).toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' }) : vandaag)
  const g = [
    { label: 'Achterstallig', items: openTaken.value.filter((x: any) => x.achterstallig) },
    { label: 'Vandaag', items: openTaken.value.filter((x: any) => !x.achterstallig && dag(x) === vandaag) },
    { label: 'Deze week', items: openTaken.value.filter((x: any) => !x.achterstallig && dag(x) > vandaag && dag(x) <= week) },
    { label: 'Later', items: openTaken.value.filter((x: any) => !x.achterstallig && dag(x) > week) },
    { label: 'Afgerond', items: t.value.taken.filter((x: any) => !['open', 'bezig'].includes(x.status)).slice(0, 20) },
  ]
  return g.filter((x) => x.items.length)
})
const PRIO: Record<string, string> = { hoog: 'Urgent', middel: 'Normaal', laag: 'Laag' }
const wanneer = (d: string | null) => (d ? new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(new Date(d)) : 'geen datum')
const grootte = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} kB`)
const CAMP_KOLOM: Record<string, string> = { klaar: 'Klaar', bezig: 'Bezig', afspraak: 'Afspraak', nee: 'Nee', 'geen-reactie': 'Geen reactie', later: 'Later' }

// Vensters vanuit de tabbladen.
const taakId = ref<string | null>(null)
const inzicht = ref<any | null>(null)
const afspraakId = ref<string | null>(null)
const verslag = ref<any | null>(null)
const nieuweTaak = ref(false)
const nieuweAfspraak = ref(false)
const mailOpen = ref(false)
const documentOpen = ref(false)
const kanMail = computed(() => !!functie('mail.versturen')?.beschikbaar)
async function verwijderDocument(d: any) {
  if (!confirm(`${d.naam} verwijderen?`)) return
  try { await $fetch(`/api/accounts/${a.value.id}/documenten/${d.id}`, { method: 'DELETE' }); toast.toon('Document verwijderd.'); await refreshTabs() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const tabs = computed(() => [
  { id: 'tijdlijn' as const, label: 'Tijdlijn', n: tlAlles.value.length },
  { id: 'inzichten' as const, label: 'Inzichten', n: t.value.inzichten.length },
  { id: 'taken' as const, label: 'Taken', n: openTaken.value.length },
  { id: 'notities' as const, label: 'Notities', n: notities.value.length },
  { id: 'mails' as const, label: 'E-mails', n: t.value.mails.length },
  { id: 'afspraken' as const, label: 'Afspraken', n: t.value.afspraken.length },
  { id: 'verslagen' as const, label: 'Gespreksverslagen', n: t.value.verslagen.length },
  { id: 'deals' as const, label: 'Deals', n: t.value.deals.length },
  { id: 'campagnes' as const, label: 'Campagnes', n: t.value.campagnes.length },
  { id: 'documenten' as const, label: 'Documenten', n: t.value.documenten.length },
  { id: 'kwalificatie' as const, label: a.value.soort === 'prospect' ? 'Reis en kwalificatie' : 'Kwalificatie', n: 0 },
  { id: 'eigenvelden' as const, label: 'Eigen velden', n: 0 },
])
</script>

<template>
  <div v-if="a" class="accountkaart">
    <!-- Kop -->
    <header class="ak-kop">
      <div class="container">
        <div class="ak-kop-binnen">
          <div class="ak-merk" :style="{ background: merkKleur }" aria-hidden="true">{{ initialen }}</div>
          <div class="ak-kop-info">
            <NuxtLink :to="a.soort === 'klant' ? '/klanten' : '/prospects/alle'" class="ak-kruimel"><Icoon naam="ArrowLeft" :grootte="12" /> {{ a.soort === 'klant' ? 'Klanten' : 'Alle prospects' }}</NuxtLink>
            <p class="ak-eyebrow"><span v-for="(c, i) in [a.branche, a.plaats, a.land, a.vvBranche?.naam].filter(Boolean)" :key="i"><template v-if="i"> · </template>{{ c }}</span></p>
            <h1 class="ak-titel" data-test="account-naam">{{ a.naam }}
              <select v-if="a.kan.klasse" class="ak-klasse" :class="`ak-klasse--${klasseKleur}`" :value="a.klasse ?? ''" aria-label="Klasse" data-test="klasse" @change="zetKlasse(($event.target as HTMLSelectElement).value)">
                <option value="">Geen klasse</option><option v-for="k in a.klassen" :key="k.id" :value="k.id" :title="k.naam">{{ k.naam }}</option>
              </select>
              <span v-else class="ak-klasse" :class="`ak-klasse--${klasseKleur}`">{{ a.klasse ? klasseNaam : 'Geen klasse' }}</span>
            </h1>
            <div class="ak-pillen">
              <button v-if="a.reis?.fase" type="button" class="pil reis-pil-knop" :class="fasePil(a.reis.fase.kleur)" :disabled="!a.kan.geschiedenis" :title="a.kan.geschiedenis ? 'Reisgeschiedenis' : undefined" data-test="fasepil" @click="openFase">{{ a.reis.fase.label }}</button>
              <span class="pil" :class="STATUS_PIL[a.status]" data-test="statuspil">{{ STATUS_LABEL[a.status] ?? a.status }}</span>
              <span v-if="a.dagenInFase !== null && a.reis" class="meta" :class="{ 'meta--oranje': a.reis.fase?.overschreden }" data-test="dagen-in-fase">{{ a.dagenInFase }} dagen in fase</span>
              <span v-if="a.vvBranche" class="chip chip--branche" title="Branche (verkoopverhaal)" data-test="vv-branche">{{ a.vvBranche.naam }}</span><span v-if="a.vvBranche?.verwijderd" class="meta" data-test="branche-verwijderd">{{ a.vvBranche.verwijderd }}</span>
            </div>
            <div class="ak-contactstrip">
              <a v-if="a.website" :href="a.website" target="_blank" rel="noopener"><Icoon naam="Globe" :grootte="14" /> {{ websiteKort }} <span class="ak-ext">↗</span></a>
              <a v-if="a.telefoon" :href="telLink(a.telefoon)" class="tnum"><Icoon naam="Phone" :grootte="14" /> {{ toonTelefoon(a.telefoon) }}</a>
              <a v-if="a.linkedin" :href="a.linkedin" target="_blank" rel="noopener"><Icoon naam="Linkedin" :grootte="14" /> LinkedIn <span class="ak-ext">↗</span></a>
              <a v-if="a.crm" :href="a.crm.url" target="_blank" rel="noopener" data-test="open-crm"><Icoon naam="Link" :grootte="14" /> Open in {{ a.crm.label }}</a>
            </div>
            <dl class="ak-stuurstrip alleen-groot" data-test="stuurstrip">
              <div><dt>Laatste actie</dt><dd class="tnum">{{ datumLang(a.stuur.laatsteActie) }}</dd></div>
              <div><dt>Laatste call</dt><dd class="tnum">{{ datumLang(a.stuur.laatsteCall) }}</dd></div>
              <div><dt>Laatste bezoek</dt><dd class="tnum">{{ datumLang(a.stuur.laatsteBezoek) }}</dd></div>
              <div><dt>Reis</dt><dd><NuxtLink v-if="a.reis && a.kan.reisBekijken" :to="`/reizen/${a.reis.id}`" data-test="reis-link">{{ a.reis.naam }}</NuxtLink><template v-else>{{ a.reis?.naam ?? 'Geen reis' }}</template></dd></div>
              <div><dt>Fase</dt><dd>{{ a.reis?.fase?.label ?? '–' }}<template v-if="a.dagenInFase !== null && a.reis"> · <span :class="{ 'meta--oranje': a.reis.fase?.overschreden }">{{ a.dagenInFase }} dagen</span></template></dd></div>
              <div v-if="a.terugkom"><dt>Terug op</dt><dd data-test="terug-op">{{ a.terugkom.tekst.replace(/^Terug op /, '').split(' · ').slice(0, 2).join(' · ') }}</dd></div>
            </dl>
          </div>
          <div class="ak-acties">
            <button v-if="aiAan" type="button" class="dd-actie dd-actie--secundair ai-knop" data-test="vraag-ai" @click="openAi({ accountId: a.id, label: a.naam })"><Icoon naam="Sparkles" class="dd-actie-icoon" />Vraag AI</button>
            <button v-if="functie('contact.visitekaartje')?.beschikbaar" type="button" class="dd-actie dd-actie--secundair alleen-telefoon" data-test="scan-visitekaartje" @click="kaartjeOpen = true"><Icoon naam="Camera" class="dd-actie-icoon" />Scan visitekaartje</button>
            <button v-if="!inPakket && functie('onderweg.dagpakket')?.beschikbaar" type="button" class="dd-actie dd-actie--secundair alleen-telefoon" data-test="bewaar-offline" @click="bewaarOffline"><Icoon naam="Download" class="dd-actie-icoon" />Bewaar voor offline</button>
            <button v-if="kanKlaarzetten" type="button" class="dd-actie dd-actie--secundair" data-test="klaarzetten-knop" @click="klaarOpen = true"><Icoon naam="MapPin" class="dd-actie-icoon" />Klaarzetten</button>
            <button v-if="a.kanOverdragen && functie('overdracht.basis')?.beschikbaar" type="button" class="dd-actie dd-actie--primair" data-test="overdragen-knop" @click="overdragenOpen = true"><Icoon naam="ArrowRight" class="dd-actie-icoon" />Overdragen</button>
            <button type="button" class="dd-actie dd-actie--secundair" data-test="info-knop" @click="infoOpen = true">Info</button>
            <button type="button" class="dd-actie dd-actie--secundair" data-test="contacten-knop" @click="contactenOpen = true">Contacten <span class="ak-teller tnum">{{ a.contacten.filter((c: any) => c.status !== 'vertrokken').length }}</span></button>
            <button type="button" class="dd-actie dd-actie--zwart" data-test="briefing-knop" @click="briefingOpen = true">Briefing</button>
            <a v-if="belNummer" class="dd-actie dd-actie--primair alleen-groot" :href="telLink(belNummer)"><Icoon naam="Phone" class="dd-actie-icoon" />Bel</a>
          </div>
        </div>

        <!-- Telefoon: compacte kaart (8.5.5): waarom nu, contacten, laatste momenten. -->
        <div class="ak-mobiel mt-16" data-test="compacte-kaart">
          <p v-if="a.aanleiding" class="account-aanleiding" :class="{ 'account-aanleiding--heet': a.aanleiding.heet }"><strong>Waarom nu:</strong> {{ a.aanleiding.tekst }} <span class="meta">· {{ a.aanleiding.bron }}</span></p>
          <p v-if="a.terugkom" class="reis-terug" data-test="terug-op-mobiel">{{ a.terugkom.tekst }}</p>
          <div v-if="functie('briefing.lezen')?.beschikbaar" class="kaart mt-8" data-test="pitstop-compact"><span class="fo-blok-kicker">Pitstop</span><BriefingPaneel onderwerp="account" :id="a.id" ingeklapt /></div>
          <ul class="schakel-lijst kaart">
            <li v-for="c in a.contacten.filter((x: any) => x.status !== 'vertrokken')" :key="c.id" class="schakel-rij">
              <span><strong>{{ c.naam }}</strong><br><span class="meta">{{ CONTACTROL_LABEL[c.rol as ContactRol] }}</span></span>
              <a v-if="(c.mobiel || c.telefoon) && !c.belMeNiet" class="dd-act" :href="telLink(c.mobiel ?? c.telefoon)" :aria-label="`Bel ${c.naam}`"><Icoon naam="Phone" class="dd-act-icoon" />Bel</a>
            </li>
            <li v-if="!a.contacten.length" class="schakel-rij"><span class="meta">Geen contactpersoon</span></li>
          </ul>
          <ul v-if="momenten.length" class="schakel-lijst kaart mt-8"><li v-for="x in momenten" :key="x.id" class="schakel-rij"><span>{{ SOORT[x.soort] ?? x.soort }}<template v-if="x.uitkomst"> · {{ x.uitkomst }}</template></span><span class="meta">{{ datumKort(x.op) }}</span></li></ul>
        </div>
      </div>
    </header>

    <!-- Statstrook -->
    <section class="ak-stats alleen-groot" data-test="statstrook">
      <div class="container ak-stat-raster">
        <div class="ak-stat"><span class="ak-stat-label">Open acties</span><span class="ak-stat-num tnum">{{ openTaken.length }}</span><span v-if="achterstallig" class="ak-stat-voet ak-stat-voet--rood">{{ achterstallig }} achterstallig</span></div>
        <div class="ak-stat"><span class="ak-stat-label">Inzichten</span><span class="ak-stat-num tnum">{{ t.inzichten.length }}</span><span v-if="nieuweInzichten" class="ak-stat-voet">{{ nieuweInzichten }} ongezien</span></div>
        <div class="ak-stat"><span class="ak-stat-label">Score</span><span class="ak-stat-num tnum">{{ a.score }}</span></div>
        <div class="ak-stat"><span class="ak-stat-label">Open deals</span><span class="ak-stat-num tnum">{{ openDeals }}</span></div>
        <div class="ak-stat"><span class="ak-stat-label">Laatste contact</span><span class="ak-stat-tekst">{{ laatsteContact }}</span></div>
        <div class="ak-stat"><span class="ak-stat-label">Eigenaar</span><span class="ak-stat-tekst">{{ a.eigenaar?.naam?.replace(/^Testgebruiker /, '') ?? 'Niemand' }}</span></div>
      </div>
    </section>

    <!-- Aanleiding, verkoopverhaal en overdracht -->
    <section v-if="a.aanleiding || a.overdracht || (a.soort === 'prospect' && (a.concurrenten.length || a.huidigeLeverancier))" class="ak-sectie ak-sectie--wit">
      <div class="container stapel">
        <div v-if="a.aanleiding" class="account-aanleiding alleen-groot" :class="{ 'account-aanleiding--heet': a.aanleiding.heet }" data-test="aanleiding"><strong>Waarom nu:</strong> {{ a.aanleiding.tekst }} <span class="meta">· {{ a.aanleiding.bron }} · {{ datumKort(a.aanleiding.op) }}</span></div>
        <div v-if="a.soort === 'prospect' && (a.concurrenten.length || a.huidigeLeverancier)" class="ak-leverancier" data-test="leverancier">
          <label class="veld veld--rij"><span class="veld-label">Huidige leverancier</span>
            <select v-if="a.kanLeverancier" class="invoer invoer--klein" :value="a.huidigeLeverancier?.id ?? ''" data-test="leverancier-kies" @change="zetLeverancier(($event.target as HTMLSelectElement).value)"><option value="">Onbekend</option><option v-for="c in a.concurrenten" :key="c.id" :value="c.id">{{ c.naam }}</option></select>
            <span v-else>{{ a.huidigeLeverancier?.naam ?? 'Onbekend' }}</span>
            <span v-if="a.huidigeLeverancier?.verwijderd" class="meta" data-test="leverancier-verwijderd">{{ a.huidigeLeverancier.naam }} · {{ a.huidigeLeverancier.verwijderd }}</span>
          </label>
          <div v-if="a.huidigeLeverancier?.zoZegJeHet" class="kaart kaart--vlak mt-8" data-test="zo-zeg-je-het">
            <p><strong>Zo zeg je het:</strong> {{ a.huidigeLeverancier.zoZegJeHet }}</p>
            <p v-if="a.huidigeLeverancier.bewijs" class="mt-8"><strong>Bewijs:</strong> {{ a.huidigeLeverancier.bewijs }}</p>
            <p v-if="a.huidigeLeverancier.wanneerVerliezen && a.reis?.fase?.id === 'gekwalificeerd'" class="veld-fout mt-8" data-test="verlies-waarschuwing">Let op: hier verliezen we vaak van {{ a.huidigeLeverancier.naam }}. {{ a.huidigeLeverancier.wanneerVerliezen }}</p>
          </div>
        </div>
        <div v-if="a.overdracht" class="kaart ov-stand" :class="{ 'kaart--geel': a.overdracht.status === 'mislukt' }" data-test="overdracht-regel">
          <span>Overgedragen aan {{ OV_NAAR[a.overdracht.naar] }} op {{ new Date(a.overdracht.op).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' }) }} · {{ a.overdracht.door }}<template v-if="a.overdracht.dealdrive?.eigenaar"> · in DealDrive bij {{ a.overdracht.dealdrive.eigenaar }}</template></span>
          <span class="pil" :class="{ 'pil--leeg': !['mislukt', 'bevestigd'].includes(a.overdracht.status), 'pil--groen': a.overdracht.status === 'bevestigd' }" data-test="overdracht-pil">{{ OV_STATUS[a.overdracht.status] ?? a.overdracht.status }}</span>
          <span v-if="a.overdracht.dealdrive?.gewonnenOp" class="pil pil--groen" data-test="gewonnen-na-overdracht">Gewonnen na overdracht</span>
          <span v-if="a.overdracht.winback" class="meta" data-test="winback">{{ a.overdracht.winback.maanden ? `Herwinnen: ${a.overdracht.winback.reden}` : `Verloren in DealDrive: ${a.overdracht.winback.reden}${a.overdracht.winback.verlorenAan ? ` aan ${a.overdracht.winback.verlorenAan}` : ''}` }} · terug op {{ new Date(a.overdracht.winback.datum).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }) }}</span>
          <a v-if="a.overdracht.externUrl" :href="a.overdracht.externUrl" target="_blank" rel="noopener" class="filter-link">Open in DealDrive</a>
          <button v-if="a.overdracht.status === 'mislukt'" type="button" class="dd-act" data-test="overdracht-opnieuw" @click="overdrachtOpnieuw">Opnieuw proberen</button>
          <span v-if="a.overdracht.laatsteFout" class="meta">{{ a.overdracht.laatsteFout }}</span>
        </div>
        <div v-if="a.overdracht?.dealdrive?.bewijsVraag === 'open' && functie('overdracht.bewijsVoorstel')?.beschikbaar" class="kaart kaart--geel ov-stand" data-test="bewijs-vraag">
          <span><strong>Mag dit een bewijs worden?</strong> De deal na jouw overdracht is in DealDrive gewonnen. Ja maakt er een suggestie van voor je salesmanager, zonder namen.</span>
          <button type="button" class="dd-act dd-act--primair" data-test="bewijs-ja" @click="bewijs(true)">Ja</button>
          <button type="button" class="dd-act" data-test="bewijs-nee" @click="bewijs(false)">Nee</button>
        </div>
      </div>
    </section>

    <!-- Tabbladen -->
    <nav class="ak-tabs" aria-label="Tabbladen van de accountkaart">
      <div class="container ak-tabs-binnen">
        <button v-for="x in tabs" :key="x.id" type="button" class="ak-tab" :class="{ 'ak-tab--aan': tab === x.id }" :aria-current="tab === x.id ? 'page' : undefined" :data-test="`tab-${x.id}`" @click="kiesTab(x.id)">{{ x.label }}<span v-if="x.n" class="ak-tab-teller tnum">{{ x.n }}</span></button>
      </div>
    </nav>

    <section class="ak-sectie ak-sectie--grijs section--laatste">
      <div class="container">
        <!-- Tijdlijn -->
        <template v-if="tab === 'tijdlijn'">
          <div class="ak-tabkop">
            <h2 class="ak-tabtitel">Tijdlijn ({{ tijdlijn.length }})</h2>
            <div class="toolbar-buttons">
              <button type="button" class="dd-actie dd-actie--primair" data-test="tl-taak" @click="nieuweTaak = true"><Icoon naam="Plus" class="dd-actie-icoon" />Taak</button>
              <button type="button" class="dd-actie dd-actie--zwart" data-test="tl-afspraak" @click="nieuweAfspraak = true"><Icoon naam="Plus" class="dd-actie-icoon" />Afspraak</button>
              <button v-if="kanMail" type="button" class="dd-actie dd-actie--primair" data-test="tl-mail" @click="mailOpen = true"><Icoon naam="Plus" class="dd-actie-icoon" />Mail</button>
              <button type="button" class="dd-actie dd-actie--secundair" :aria-expanded="tlFiltersOpen" data-test="tl-filters" @click="tlFiltersOpen = !tlFiltersOpen"><Icoon naam="SlidersHorizontal" class="dd-actie-icoon" />Filters<span v-if="tlFilter !== 'alles'" class="ak-teller">1</span><Icoon naam="ChevronDown" :grootte="14" /></button>
            </div>
          </div>
          <div v-if="tlFiltersOpen" class="ak-filterstrook chips">
            <span class="ak-filterlabel">Soort</span>
            <button v-for="s in tlSoorten" :key="s.id" type="button" class="filter-pil" :class="{ 'filter-pil--aan': tlFilter === s.id }" @click="tlFilter = s.id">{{ s.label }} <span class="pil-teller">{{ s.n }}</span></button>
          </div>
          <p v-if="!tijdlijn.length" class="ak-leeg">Nog niets vastgelegd voor dit account in deze selectie.</p>
          <ol v-else class="tl-lijst" data-test="tijdlijn">
            <li v-for="i in tijdlijn" :key="i.key" class="tl-item">
              <span class="tl-spoor" :class="`tl-spoor--${i.soort}`" aria-hidden="true" />
              <button type="button" class="tl-kaart" :disabled="!i.open" @click="i.open?.()">
                <span class="tl-kop"><span class="tl-soort" :class="`tl-soort--${i.soort}`">{{ i.soortLabel }}</span><span class="tl-type">{{ i.typeLabel }}</span><span v-if="i.bron" class="tl-bron">{{ i.bron }}</span><span class="tl-datum tnum">{{ tlDatum(i.ms) }}</span></span>
                <span class="tl-titel">{{ i.titel }}</span>
                <span v-if="i.tekst" class="tl-tekst">{{ i.tekst }}</span>
                <span v-if="i.status" class="tl-status" :class="`tl-status--${i.statusSoort}`">{{ i.status }}</span>
              </button>
            </li>
          </ol>
        </template>

        <!-- Inzichten -->
        <template v-else-if="tab === 'inzichten'">
          <div class="ak-tabkop"><h2 class="ak-tabtitel">Inzichten voor {{ a.naam }} ({{ t.inzichten.length }})</h2><span class="meta">Klik een inzicht voor het bewijs en de bron</span></div>
          <p v-if="!t.inzichten.length" class="ak-leeg">Nog geen inzichten voor dit account. De Waarnemer en de motor vullen dit zodra ze iets zien.</p>
          <ol v-else class="tl-lijst">
            <li v-for="s in t.inzichten" :key="s.id" class="tl-item">
              <span class="tl-spoor tl-spoor--inzicht" aria-hidden="true" />
              <button type="button" class="tl-kaart" :data-test="`ak-inzicht-${s.id}`" @click="inzicht = s">
                <span class="tl-kop"><span class="tl-soort tl-soort--inzicht">{{ s.relevantie >= 75 ? 'Heet' : 'Inzicht' }}</span><span class="tl-type">{{ s.agent ?? (s.bron === 'extern' ? 'Extern' : 'Intern') }}</span><span v-if="s.specifiekeBron" class="tl-bron">{{ s.specifiekeBron }}</span><span class="tl-datum tnum">{{ tlDatum(Date.parse(s.createdAt)) }}</span></span>
                <span class="tl-titel">{{ s.title }}</span>
                <span v-if="s.waarom" class="tl-tekst">{{ s.waarom }}</span>
                <span class="tl-status" :class="s.status === 'nieuw' ? 'tl-status--open' : 'tl-status--klaar'">{{ s.status === 'nieuw' ? 'Ongezien' : s.status === 'omgezet' ? 'Taak gemaakt' : 'Gelezen' }}</span>
              </button>
            </li>
          </ol>
        </template>

        <!-- Taken -->
        <template v-else-if="tab === 'taken'">
          <div class="ak-tabkop"><h2 class="ak-tabtitel">Acties voor {{ a.naam }} ({{ openTaken.length }} open)</h2><button type="button" class="dd-actie dd-actie--primair" data-test="taken-nieuw" @click="nieuweTaak = true"><Icoon naam="Plus" class="dd-actie-icoon" />Taak</button></div>
          <p v-if="!t.taken.length" class="ak-leeg">Nog geen acties voor dit account. Klik op <strong>+ Taak</strong> hierboven.</p>
          <template v-for="g in takenGroepen" :key="g.label">
            <header class="ak-groepkop"><h3>{{ g.label }}</h3><span class="tnum">{{ g.items.length }}</span></header>
            <ol class="tl-lijst">
              <li v-for="x in g.items" :key="x.id" class="tl-item">
                <span class="tl-spoor" :class="x.priority === 'hoog' ? 'tl-spoor--urgent' : 'tl-spoor--taak'" aria-hidden="true" />
                <button type="button" class="tl-kaart" :data-test="`ak-taak-${x.id}`" @click="taakId = x.id">
                  <span class="tl-kop"><span class="tl-soort tl-soort--taak">{{ ACTIE_LABEL[x.actionType] ?? 'Taak' }}</span><span class="tl-type">{{ PRIO[x.priority] ?? x.priority }}</span><span class="tl-type">{{ HERKOMST_LABEL[x.herkomst] ?? 'Handmatig' }}</span><span class="tl-datum tnum" :class="{ 'tl-datum--rood': x.achterstallig }">{{ wanneer(x.dueDate) }}</span></span>
                  <span class="tl-titel">{{ x.title }}</span>
                  <span v-if="x.aanleiding || x.poging" class="tl-tekst">{{ [x.aanleiding, x.poging ? `poging ${x.poging.n} van ${x.poging.van}` : null].filter(Boolean).join(' · ') }}</span>
                  <span v-if="!['open', 'bezig'].includes(x.status)" class="tl-status tl-status--klaar">Afgerond<template v-if="x.uitkomst"> · {{ x.uitkomst }}</template></span>
                  <span v-else-if="x.achterstallig" class="tl-status tl-status--laat">Achterstallig</span>
                </button>
              </li>
            </ol>
          </template>
        </template>

        <!-- Notities -->
        <template v-else-if="tab === 'notities'">
          <div class="ak-tabkop"><h2 class="ak-tabtitel">Notities ({{ notities.length }})</h2></div>
          <form class="kaart" @submit.prevent="bewaarNotitie"><label class="veld"><span class="veld-label">Nieuwe notitie</span><textarea v-model="notitie" class="invoer" rows="3" data-test="notitie" /></label><button type="submit" class="dd-act dd-act--geel mt-16" :disabled="!notitie.trim()">Notitie bewaren</button></form>
          <ol v-if="notities.length" class="tl-lijst mt-16">
            <li v-for="n in notities" :key="n.id" class="tl-item"><span class="tl-spoor tl-spoor--contact" aria-hidden="true" /><div class="tl-kaart tl-kaart--vast"><span class="tl-kop"><span class="tl-soort tl-soort--contact">Notitie</span><span class="tl-bron">{{ String(n.door ?? '').replace(/^Testgebruiker /, '') }}</span><span class="tl-datum tnum">{{ datumLang(n.op) }}</span></span><span class="tl-tekst tl-tekst--vol">{{ n.tekst }}</span></div></li>
          </ol>
        </template>

        <!-- E-mails -->
        <template v-else-if="tab === 'mails'">
          <div class="ak-tabkop"><h2 class="ak-tabtitel">E-mails ({{ t.mails.length }})</h2><button v-if="kanMail" type="button" class="dd-actie dd-actie--primair" data-test="mails-nieuw" @click="mailOpen = true"><Icoon naam="Plus" class="dd-actie-icoon" />Mail</button></div>
          <p v-if="!t.mails.length" class="ak-leeg">Nog geen mails met dit account. Schrijf er een met <strong>+ Mail</strong>, of laat de Schrijver een concept klaarzetten.</p>
          <ol v-else class="tl-lijst">
            <li v-for="m in t.mails" :key="m.id" class="tl-item">
              <span class="tl-spoor" :class="m.concept ? 'tl-spoor--inzicht' : 'tl-spoor--mail'" aria-hidden="true" />
              <component :is="m.concept ? 'NuxtLink' : 'div'" :to="m.concept ? '/concepten' : undefined" class="tl-kaart" :class="{ 'tl-kaart--vast': !m.concept }">
                <span class="tl-kop"><span class="tl-soort" :class="m.concept ? 'tl-soort--inzicht' : 'tl-soort--mail'">{{ m.concept ? 'Concept' : 'Mail' }}</span><span class="tl-type">{{ m.status }}</span><span v-if="m.aan" class="tl-bron">aan {{ m.aan }}</span><span class="tl-datum tnum">{{ tlDatum(Date.parse(m.op)) }}</span></span>
                <span class="tl-titel">{{ m.onderwerp }}</span>
                <span v-if="m.tekst" class="tl-tekst">{{ m.tekst.length > 220 ? `${m.tekst.slice(0, 220)}...` : m.tekst }}</span>
              </component>
            </li>
          </ol>
        </template>

        <!-- Afspraken -->
        <template v-else-if="tab === 'afspraken'">
          <div class="ak-tabkop"><h2 class="ak-tabtitel">Afspraken met {{ a.naam }} ({{ t.afspraken.length }})</h2><button type="button" class="dd-actie dd-actie--zwart" data-test="afspraken-nieuw" @click="nieuweAfspraak = true"><Icoon naam="Plus" class="dd-actie-icoon" />Afspraak</button></div>
          <p v-if="!t.afspraken.length" class="ak-leeg">Nog geen afspraken voor dit account. Klik op <strong>+ Afspraak</strong> hierboven.</p>
          <ol v-else class="tl-lijst">
            <li v-for="x in t.afspraken" :key="x.id" class="tl-item">
              <span class="tl-spoor tl-spoor--afspraak" aria-hidden="true" />
              <button type="button" class="tl-kaart" :data-test="`ak-afspraak-${x.id}`" @click="afspraakId = x.id">
                <span class="tl-kop"><span class="tl-soort tl-soort--afspraak">{{ x.soort }}</span><span class="tl-type">{{ VORM[x.vorm] ?? x.vorm }}</span><span class="tl-datum tnum">{{ wanneer(x.start) }}</span></span>
                <span class="tl-titel">{{ x.soort }}<template v-if="x.contact"> met {{ x.contact }}</template></span>
                <span v-if="x.locatie || x.eigenaar" class="tl-tekst">{{ [x.locatie, x.eigenaar].filter(Boolean).join(' · ') }}</span>
                <span class="tl-status" :class="x.status === 'afgerond' ? 'tl-status--klaar' : x.status === 'gepland' ? 'tl-status--open' : 'tl-status--laat'">{{ AFSPRAAK_STATUS[x.status] ?? x.status }}<template v-if="x.heeftVerslag"> · verslag</template></span>
              </button>
            </li>
          </ol>
        </template>

        <!-- Gespreksverslagen -->
        <template v-else-if="tab === 'verslagen'">
          <div class="ak-tabkop"><h2 class="ak-tabtitel">Gespreksverslagen ({{ t.verslagen.length }})</h2><span class="meta">Uit beltaken en afspraken</span></div>
          <p v-if="!t.verslagen.length" class="ak-leeg">Nog geen gespreksverslagen. Leg ze vast bij het afronden van een beltaak of in het verslag van een afspraak.</p>
          <ul v-else class="ak-rijen">
            <li v-for="v in t.verslagen" :key="v.id">
              <button type="button" class="ak-rij" :data-test="`ak-verslag-${v.id}`" @click="verslag = v">
                <span class="tl-soort" :class="v.bron === 'afspraak' ? 'tl-soort--afspraak' : 'tl-soort--taak'">{{ v.bronLabel }}</span>
                <span class="tl-type">{{ v.typeLabel }}</span>
                <span class="ak-rij-info"><span class="ak-rij-titel">{{ v.titel }}</span><span class="meta tnum">{{ datumLang(v.datum) }}<template v-if="v.contact"> · {{ v.contact }}</template> · {{ v.woorden }} woorden</span></span>
                <span class="ak-rij-cta">Open →</span>
              </button>
            </li>
          </ul>
        </template>

        <!-- Deals -->
        <template v-else-if="tab === 'deals'">
          <div class="ak-tabkop"><h2 class="ak-tabtitel">Deals ({{ t.deals.length }})</h2>
            <div class="toolbar-buttons"><button v-if="a.kanOverdragen && functie('overdracht.basis')?.beschikbaar" type="button" class="dd-actie dd-actie--primair" @click="overdragenOpen = true"><Icoon naam="ArrowRight" class="dd-actie-icoon" />Overdragen</button><NuxtLink to="/funnel" class="dd-actie dd-actie--secundair">Open funnel →</NuxtLink></div>
          </div>
          <p class="meta ak-hint">Een prospect wordt een deal zodra je hem overdraagt na de eerste afspraak. De deal loopt daarna in DealDrive of je CRM; wat die terugmelden staat hier.</p>
          <p v-if="!t.deals.length" class="ak-leeg">Nog geen deals voor dit account. Plan een eerste afspraak en draag daarna over.</p>
          <ol v-else class="tl-lijst">
            <li v-for="d in t.deals" :key="d.id" class="tl-item">
              <span class="tl-spoor tl-spoor--deal" aria-hidden="true" />
              <component :is="d.externUrl ? 'a' : 'div'" :href="d.externUrl ?? undefined" target="_blank" rel="noopener" class="tl-kaart" :class="{ 'tl-kaart--vast': !d.externUrl }" :data-test="`ak-deal-${d.id}`">
                <span class="tl-kop"><span class="tl-soort tl-soort--deal">{{ DEAL_FASE[d.fase] ?? d.fase }}</span><span class="tl-type">{{ OV_NAAR[d.naar] ?? d.naar }}</span><span v-if="d.waarde" class="tl-bron tnum">€ {{ Number(d.waarde).toLocaleString('nl-NL') }}</span><span class="tl-datum tnum">{{ datumLang(d.op) }}</span></span>
                <span class="tl-titel">{{ d.titel }}</span>
                <span class="tl-tekst">Overgedragen door {{ d.door }}<template v-if="d.eigenaar"> · eigenaar in DealDrive: {{ d.eigenaar }}</template><template v-if="d.gewonnenOp"> · gewonnen op {{ datumLang(d.gewonnenOp) }}</template></span>
                <span v-if="d.externUrl" class="ak-rij-cta mt-8">Open deal →</span>
              </component>
            </li>
          </ol>
        </template>

        <!-- Campagnes -->
        <template v-else-if="tab === 'campagnes'">
          <div class="ak-tabkop"><h2 class="ak-tabtitel">Campagnes ({{ t.campagnes.length }})</h2><NuxtLink to="/campagnes" class="dd-actie dd-actie--secundair">Alle campagnes →</NuxtLink></div>
          <p class="meta ak-hint">De campagnes waarin dit account meeloopt, met de stand op het campagnebord.</p>
          <p v-if="!t.campagnes.length" class="ak-leeg">Dit account loopt in geen enkele campagne mee. Voeg het toe op een campagnebord onder <NuxtLink to="/campagnes" class="tekst-link">Campagnes</NuxtLink>.</p>
          <ul v-else class="ak-rijen">
            <li v-for="c in t.campagnes" :key="c.id">
              <NuxtLink :to="`/campagnes/${c.id}`" class="ak-rij" :data-test="`ak-campagne-${c.id}`">
                <span class="tl-soort tl-soort--taak">{{ c.soort }}</span>
                <span class="ak-rij-info"><span class="ak-rij-titel">{{ c.naam }}</span><span class="meta">{{ c.status }}<template v-if="c.doel"> · {{ c.doel }}</template><template v-if="c.volgendeStap"> · volgende stap: {{ c.volgendeStap }}</template></span></span>
                <span class="pil" :class="c.gehaald ? 'pil--groen' : 'pil--grijs'">{{ c.gehaald ? 'Doel gehaald' : CAMP_KOLOM[c.kolom] ?? c.kolom }}</span>
                <span class="ak-rij-cta">Bord →</span>
              </NuxtLink>
            </li>
          </ul>
        </template>

        <!-- Documenten -->
        <template v-else-if="tab === 'documenten'">
          <div class="ak-tabkop"><h2 class="ak-tabtitel">Documenten ({{ t.documenten.length }})</h2><button type="button" class="dd-actie dd-actie--primair" data-test="document-uploaden" @click="documentOpen = true"><Icoon naam="Upload" class="dd-actie-icoon" />Document uploaden</button></div>
          <p class="meta ak-hint">Offertes, presentaties en foto's bij dit account. Foto's en opnames uit afspraken staan hier ook.</p>
          <p v-if="!t.documenten.length" class="ak-leeg">Nog geen documenten voor dit account. Klik <strong>Document uploaden</strong>.</p>
          <ul v-else class="ak-rijen">
            <li v-for="d in t.documenten" :key="d.id" class="ak-doc">
              <a :href="`/api/bijlagen/${d.id}`" target="_blank" rel="noopener" class="ak-rij" :data-test="`ak-document-${d.id}`">
                <span class="ak-doc-icoon"><Icoon :naam="d.mime.startsWith('image/') ? 'Image' : d.mime === 'application/pdf' ? 'FileText' : 'File'" :grootte="18" /></span>
                <span class="ak-rij-info"><span class="ak-rij-titel">{{ d.naam }}</span><span class="meta tnum">{{ grootte(d.grootte) }} · {{ datumLang(d.op) }}<template v-if="d.door"> · {{ d.door }}</template></span></span>
                <span class="ak-rij-cta">Open →</span>
              </a>
              <button v-if="d.magVerwijderen" type="button" class="dd-act dd-act--icoon dd-act--gevaar" :aria-label="`${d.naam} verwijderen`" @click="verwijderDocument(d)"><Icoon naam="Trash2" :grootte="14" /></button>
            </li>
          </ul>
        </template>

        <!-- Reis en kwalificatie (Dealtrace) -->
        <template v-else-if="tab === 'kwalificatie'">
          <div class="ak-tabkop"><h2 class="ak-tabtitel">{{ a.soort === 'prospect' ? 'Reis en kwalificatie' : 'Kwalificatie' }}</h2></div>
          <div class="ak-blokken">
            <AgentBlokken :account="a" @gewijzigd="refresh" />
            <article class="kaart" data-test="band"><header class="kaart-kop"><h2 class="kaart-titel">Kwalificatie BAND {{ Object.values(a.band).filter((b: any) => b?.ja).length }}/4</h2></header>
              <ul class="kaart-meta band-lijst">
                <li v-for="k in ['behoefte', 'autoriteit', 'noodzaak', 'draagvlak']" :key="k" class="band-rij">
                  <label v-if="a.kan.kwalificeer || (a.kan.reis && a.status === 'nieuw')" class="schakel-naam"><input type="checkbox" :checked="!!a.band[k]?.ja" :data-test="`band-${k}`" @change="zetBand(k, ($event.target as HTMLInputElement).checked)"> {{ k.charAt(0).toUpperCase() + k.slice(1) }}</label>
                  <template v-else>{{ k.charAt(0).toUpperCase() + k.slice(1) }}: {{ a.band[k]?.ja ? `ja (${a.band[k].bron ?? 'bron onbekend'})` : 'nog niet' }}</template>
                </li>
              </ul>
              <button v-if="a.kan.kwalificeer" type="button" class="dd-act dd-act--primair mt-16" data-test="kwalificeer" @click="kwalificeer">Kwalificeer</button>
            </article>
            <article v-if="a.kan.reis" class="kaart" data-test="ritme"><header class="kaart-kop"><h2 class="kaart-titel">Ritme</h2></header>
              <p class="kaart-meta"><template v-if="a.terugkom">{{ a.terugkom.tekst }}</template><template v-else-if="a.reis?.fase">Fase {{ a.reis.fase.label }}<template v-if="a.reis.fase.accent">: {{ a.reis.fase.accent }}</template></template><template v-else>Nog geen reis.</template></p>
              <div class="reis-knoppen mt-16">
                <button v-if="a.kan.nee" type="button" class="dd-act" data-test="zet-nee-knop" @click="neeOpen = true">Zet nee</button>
                <button v-if="a.kan.pauzeer" type="button" class="dd-act" data-test="pauzeer-knop" @click="handeling = 'pauzeer'">Pauzeer tot</button>
                <button v-if="a.kan.verplaatsen" type="button" class="dd-act" data-test="verplaats-knop" @click="handeling = 'verplaats'">Verplaats naar reis</button>
                <button v-if="a.kan.faseCorrigeren && a.reis" type="button" class="dd-act" data-test="fase-corrigeren-knop" @click="handeling = 'fase'">Fase corrigeren</button>
                <button v-if="a.kan.terugOp" type="button" class="dd-act" data-test="terugop-knop" @click="handeling = 'terugop'">Terugkomdatum</button>
              </div>
            </article>
            <article class="kaart" data-test="reis-blok"><header class="kaart-kop"><h2 class="kaart-titel">Reis</h2></header>
              <template v-if="a.reis">
                <p class="kaart-meta"><strong>{{ a.reis.naam }}</strong> · {{ a.reis.fase?.label }} · {{ STATUS_LABEL[a.status] ?? a.status }}</p>
                <p v-if="a.reis.fase?.accent" class="fasekaart-accent">{{ a.reis.fase.accent }}</p>
                <p v-if="a.nee" class="kaart-meta mt-8">Nee: {{ a.nee.reden }}<template v-if="a.nee.toelichting"> ({{ a.nee.toelichting }})</template>; afkoeling bellen tot {{ a.nee.tot.bellen }}, mail tot {{ a.nee.tot.mail }}.</p>
                <button v-if="a.kan.geschiedenis" type="button" class="dd-act mt-16" data-test="geschiedenis-knop" @click="geschiedenisOpen = true">Reisgeschiedenis</button>
              </template>
              <p v-else class="kaart-meta">Klanten lopen geen prospectreis; het vervolg loopt in DealDrive of je CRM.</p>
            </article>
          </div>
          <div class="mt-24">
            <div class="sec-head"><span class="kicker kicker--streep">Buying committee</span><button type="button" class="dd-act" :disabled="committeeBezig" data-test="committee-ai" @click="stelCommitteeVoor"><Icoon naam="Sparkles" class="dd-actie-icoon" />Stel voor met AI</button></div>
            <BuyingCommittee class="mt-16" :contacten="a.contacten" :ontbrekend="a.ontbrekendeRollen" />
            <ul v-if="committee?.length" class="schakel-lijst kaart mt-16" data-test="committee-voorstel">
              <li v-for="v in committee" :key="v.functie" class="schakel-rij"><span><strong>{{ v.functie }}</strong>: {{ v.rol }} <span v-if="v.vermoedelijk" class="pil pil--leeg">vermoedelijk</span><br><span class="meta">{{ v.bron }} · zekerheid {{ v.zekerheid }}</span></span></li>
            </ul>
            <div v-if="functie('datacollectief.verrijken')?.beschikbaar" class="kaart kaart--vlak dc-zoek mt-16" data-test="dc-zoek-blok">
              <button type="button" class="dd-act dc-knop" :disabled="dcBezig || !online" data-test="dc-zoek" @click="zoekContacten">{{ online ? 'Zoek contactpersonen' : 'Niet beschikbaar zonder verbinding' }}</button>
              <span class="meta">Datacollectief · kost tot 5 records</span>
            </div>
            <ul class="schakel-lijst kaart mt-16"><li v-for="c in a.contacten" :key="c.id" class="schakel-rij"><NuxtLink :to="`/contacten/${c.id}`">{{ c.naam }}</NuxtLink><span class="meta">{{ CONTACTROL_LABEL[c.rol as ContactRol] }}<template v-if="c.functie"> · {{ c.functie }}</template><template v-if="c.status === 'vertrokken'"> · vertrokken</template><template v-if="c.herkomst?.bron === 'datacollectief'"> · Datacollectief · {{ c.herkomst.op.slice(0, 10) }}</template></span></li></ul>
          </div>
        </template>

        <!-- Eigen velden -->
        <template v-else-if="tab === 'eigenvelden'">
          <div class="ak-tabkop"><h2 class="ak-tabtitel">Eigen velden</h2></div>
          <LegeStaat v-if="!a.eigenVelden.length" titel="Geen eigen velden." tekst="Je beheerder maakt eigen velden bij Instellingen." />
          <dl v-else class="gegevens kaart"><template v-for="v in a.eigenVelden" :key="v.sleutel"><dt>{{ v.naam }}</dt><dd>{{ a.customFields[v.sleutel] ?? '–' }}</dd></template></dl>
          <EigenVeldVoorstel v-if="a.kan.voorstellen" class="mt-16" />
        </template>
      </div>
    </section>

    <!-- Telefoon: plakkende actiebalk (8.5.5). -->
    <div class="actiebalk" data-test="actiebalk">
      <a class="actiebalk-knop" :class="{ 'actiebalk-knop--uit': !belNummer }" :href="belNummer ? telLink(belNummer) : undefined" :aria-disabled="!belNummer" :title="belNummer ? undefined : 'Geen telefoonnummer'" data-test="ab-bellen"><Icoon naam="Phone" />Bellen</a>
      <a class="actiebalk-knop" :class="{ 'actiebalk-knop--uit': !mailAdres }" :href="mailAdres ? `mailto:${mailAdres}` : undefined" :aria-disabled="!mailAdres" :title="mailAdres ? undefined : 'Geen e-mailadres'"><Icoon naam="Mail" />Mail</a>
      <a class="actiebalk-knop" :class="{ 'actiebalk-knop--uit': !whatsapp }" :href="whatsapp ? `https://wa.me/${whatsapp.replace('+', '')}` : undefined" :aria-disabled="!whatsapp" :title="whatsapp ? undefined : 'Geen toestemming voor WhatsApp'"><Icoon naam="MessageCircle" />WhatsApp</a>
      <a class="actiebalk-knop" :class="{ 'actiebalk-knop--uit': !navigeer }" :href="navigeer ?? undefined" :aria-disabled="!navigeer" :title="navigeer ? undefined : 'Geen adres'" target="_blank" rel="noopener"><Icoon naam="Navigation" />Navigeer</a>
    </div>

    <ReisgeschiedenisFlyout v-if="a.kan.geschiedenis" :open="geschiedenisOpen" :account-id="a.id" :naam="a.naam" @sluit="geschiedenisOpen = false" />
    <ZetNeeFlyout v-if="a.kan.nee" :open="neeOpen" :account="{ id: a.id, naam: a.naam }" :concurrenten="a.concurrenten" @sluit="neeOpen = false" @klaar="klaar" />
    <ReisHandelingFlyout v-if="handeling" :open="!!handeling" :soort="handeling" :account="a" @sluit="handeling = null" @klaar="klaar" />
    <InfoFlyout :open="infoOpen" :account="a" @sluit="infoOpen = false" @gewijzigd="refresh" @verwijder="verwijderOpen = true" />
    <ContactenFlyout :open="contactenOpen" :account="{ id: a.id, naam: a.naam }" :contacten="a.contacten" @sluit="contactenOpen = false" @gewijzigd="refresh" />
    <BriefingFlyout :open="briefingOpen" :account="{ id: a.id, naam: a.naam }" @sluit="briefingOpen = false" />
    <BevestigVenster :open="verwijderOpen" :titel="`${a.naam} verwijderen?`" tekst="Het account en zijn contacten worden verwijderd. De activiteitenlog blijft bewaard." bevestig="Verwijderen" @geannuleerd="verwijderOpen = false" @bevestigd="verwijder" />
    <VisitekaartjeVenster :open="kaartjeOpen" :account="a ? { id: a.id, naam: a.naam } : null" @sluit="kaartjeOpen = false" @bewaard="refresh()" />
    <KlaarzetFlyout :open="klaarOpen" :account="a ? { id: a.id, naam: a.naam } : null" @sluit="klaarOpen = false" />
    <OverdrachtVenster :open="overdragenOpen" :account-id="a?.id ?? null" :account-naam="a?.naam ?? ''" @sluit="overdragenOpen = false" @overgedragen="ververs()" />
    <TaakFlyout :open="!!taakId" :taak-id="taakId" @sluit="taakId = null" @klaar="taakId = null; ververs()" @gewijzigd="ververs()" />
    <InzichtFlyout :open="!!inzicht" :inzicht="inzicht" @sluit="inzicht = null" @gewijzigd="inzicht = null; ververs()" />
    <AfspraakFlyout :open="!!afspraakId" :afspraak-id="afspraakId" @sluit="afspraakId = null" @gewijzigd="ververs()" />
    <VerslagFlyout :open="!!verslag" :verslag="verslag" @sluit="verslag = null" @afspraak="(id) => { verslag = null; afspraakId = id }" />
    <NieuweTaakFlyout :open="nieuweTaak" :account="{ id: a.id, naam: a.naam }" @sluit="nieuweTaak = false" @gemaakt="nieuweTaak = false; ververs()" />
    <PlanAfspraakFlyout :open="nieuweAfspraak" :account="{ id: a.id, naam: a.naam }" @sluit="nieuweAfspraak = false" @gepland="nieuweAfspraak = false; ververs()" />
    <MailFlyout v-if="kanMail" :open="mailOpen" :account="{ id: a.id, naam: a.naam }" :aan="primair?.email ? primair.naam : null" @sluit="mailOpen = false" @verstuurd="mailOpen = false; ververs()" />
    <DocumentFlyout :open="documentOpen" :account="{ id: a.id, naam: a.naam }" @sluit="documentOpen = false" @bewaard="documentOpen = false; refreshTabs()" />
  </div>
  <OfflineAccount v-else :id="String(route.params.id)" />
</template>

<style scoped>
/* Kop (opzet uit DealDrive: klant-header) */
.ak-kop { padding: 28px 0; background: var(--wit); border-bottom: 1px solid var(--border); }
.ak-kop-binnen { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 18px; align-items: start; }
@media (min-width: 1000px) { .ak-kop-binnen { grid-template-columns: auto minmax(0, 1fr) auto; } }
.ak-merk { display: inline-flex; align-items: center; justify-content: center; width: 64px; height: 64px; margin-top: 22px; color: #fff; font-size: 18px; font-weight: 800; letter-spacing: 0.02em; }
.ak-kruimel { display: inline-flex; align-items: center; gap: 4px; margin-bottom: 6px; font-size: 12px; font-weight: 600; color: var(--muted); text-decoration: none; }
.ak-kruimel:hover { color: var(--ink); }
.ak-eyebrow { margin: 0; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: var(--muted); }
.ak-titel { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; margin: 4px 0 0; font-family: var(--font-serif); font-size: clamp(28px, 4vw, 40px); font-weight: 700; line-height: 1.1; letter-spacing: -0.02em; color: var(--ink); }
.ak-klasse { appearance: none; padding: 3px 8px; border: 1px solid transparent; border-radius: 2px; font-family: var(--font-serif); font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; line-height: 1.4; background: var(--ink); color: var(--yellow); }
select.ak-klasse { cursor: pointer; min-height: 26px; }
.ak-klasse--a { background: var(--ink); color: var(--yellow); }
.ak-klasse--b { background: var(--blue); color: #fff; }
.ak-klasse--c { background: var(--orange); color: #fff; }
.ak-klasse--d { background: var(--muted); color: #fff; }
.ak-klasse--overig { background: var(--purple); color: #fff; }
.ak-klasse--geen { background: #fff; color: var(--muted); border: 1px dashed var(--border-strong); }
.ak-klasse option { background: #fff; color: var(--ink); font-family: Inter, sans-serif; text-transform: none; }
.ak-pillen { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 10px; }
.ak-contactstrip { display: flex; flex-wrap: wrap; gap: 18px; margin-top: 10px; font-size: 13px; }
.ak-contactstrip a { display: inline-flex; align-items: center; gap: 6px; min-height: 28px; color: var(--ink); text-decoration: none; border-bottom: 1px solid transparent; }
.ak-contactstrip a:hover { border-bottom-color: var(--yellow); }
.ak-ext { font-size: 11px; font-weight: 700; color: var(--muted); }
.ak-stuurstrip { display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 10px 0 0; font-size: 13px; color: var(--ink-soft); }
.ak-stuurstrip div { display: inline-flex; align-items: baseline; gap: 6px; }
.ak-stuurstrip dt { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.ak-stuurstrip dd { margin: 0; }
.ak-acties { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-start; }
@media (min-width: 1000px) { .ak-acties { grid-column: auto; justify-content: flex-end; max-width: 460px; margin-top: 22px; } }
.ak-teller { padding: 1px 6px; font-size: 10px; font-weight: 800; background: var(--ink); color: var(--yellow); }
.dd-actie--zwart .ak-teller { background: var(--yellow); color: var(--ink); }

/* Statstrook */
.ak-stats { padding: 24px 0; background: var(--bg); border-bottom: 1px solid var(--border); }
.ak-stat-raster { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
@media (min-width: 700px) { .ak-stat-raster { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 1000px) { .ak-stat-raster { grid-template-columns: repeat(6, 1fr); } }
.ak-stat { display: flex; flex-direction: column; gap: 4px; padding: 8px 0; }
.ak-stat-label { font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: var(--muted); }
.ak-stat-num { font-family: var(--font-serif); font-size: 22px; font-weight: 700; line-height: 1.1; color: var(--ink); }
.ak-stat-tekst { font-size: 14px; font-weight: 600; line-height: 1.3; color: var(--ink); }
.ak-stat-voet { font-size: 10px; letter-spacing: 0.04em; color: var(--muted); }
.ak-stat-voet--rood { font-weight: 700; color: var(--red); }

/* Secties */
.ak-sectie { padding: 32px 0; border-bottom: 1px solid var(--border); }
.ak-sectie--wit { background: var(--wit); }
.ak-sectie--grijs { background: #f4f3ef; }
.ak-leverancier { max-width: 760px; }

/* Tabbladen */
.ak-tabs { position: sticky; top: 0; z-index: 10; background: var(--wit); border-bottom: 1px solid var(--border); }
.ak-tabs-binnen { display: flex; gap: 24px; overflow-x: auto; scrollbar-width: thin; }
.ak-tab { display: inline-flex; align-items: center; gap: 8px; min-height: var(--touch-target-min); padding: 14px 2px; background: transparent; border: 0; border-bottom: 2px solid transparent; color: var(--muted); font-family: inherit; font-size: 13px; font-weight: 600; white-space: nowrap; cursor: pointer; transition: color var(--transition-fast), border-color var(--transition-fast); }
.ak-tab:hover { color: var(--ink); }
.ak-tab--aan { color: var(--ink); border-bottom-color: var(--yellow); }
.ak-tab-teller { padding: 1px 6px; font-size: 11px; font-weight: 700; background: var(--surface); color: var(--ink-soft); }

/* Kop van een tabblad */
.ak-tabkop { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 14px; margin-bottom: 20px; }
.ak-tabtitel { margin: 0; font-family: var(--font-serif); font-size: 22px; font-weight: 700; letter-spacing: -0.01em; color: var(--ink); }
.ak-hint { margin: -8px 0 16px; }
.ak-leeg { padding: 32px; background: var(--wit); border: 1px solid var(--border); text-align: center; font-size: 14px; color: var(--muted); }
.ak-filterstrook { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: -4px 0 16px; padding: 12px 16px; background: var(--wit); border: 1px solid var(--border); }
.ak-filterlabel { margin-right: 4px; font-size: 10px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.ak-groepkop { display: flex; justify-content: space-between; align-items: baseline; margin: 22px 0 8px; padding-bottom: 6px; border-bottom: 2px solid var(--ink); }
.ak-groepkop h3 { margin: 0; font-size: 11px; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; color: var(--ink); }
.ak-groepkop span { font-size: 12px; font-weight: 700; color: var(--muted); }

/* Tijdlijnkaarten (tl-*) */
.tl-lijst { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.tl-item { display: grid; grid-template-columns: 4px minmax(0, 1fr); gap: 12px; }
.tl-spoor { border-radius: 2px; background: var(--border-strong); }
.tl-spoor--inzicht { background: var(--yellow); }
.tl-spoor--taak { background: var(--blue); }
.tl-spoor--urgent { background: var(--red); }
.tl-spoor--afspraak { background: var(--green); }
.tl-spoor--deal { background: var(--purple); }
.tl-spoor--mail { background: var(--blue); }
.tl-spoor--contact { background: var(--muted); }
.tl-kaart { display: flex; flex-direction: column; align-items: flex-start; width: 100%; padding: 12px 16px; background: var(--wit); border: 1px solid var(--border); color: inherit; font-family: inherit; text-align: left; text-decoration: none; cursor: pointer; transition: border-color var(--transition-fast), background var(--transition-fast); }
.tl-kaart:hover:not(:disabled):not(.tl-kaart--vast) { border-color: var(--ink); background: var(--surface); }
.tl-kaart:disabled, .tl-kaart--vast { cursor: default; }
.tl-kop { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; width: 100%; margin-bottom: 6px; }
.tl-soort, .tl-type { padding: 2px 7px; border-radius: 2px; font-size: 10px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase; }
.tl-soort--inzicht { background: var(--yellow); color: var(--ink); }
.tl-soort--taak { background: var(--blue); color: #fff; }
.tl-soort--afspraak { background: var(--green); color: #fff; }
.tl-soort--deal { background: var(--purple); color: #fff; }
.tl-soort--mail { background: var(--blue); color: #fff; }
.tl-soort--contact { background: var(--surface); color: var(--muted); border: 1px solid var(--border-strong); }
.tl-type { background: var(--surface); color: var(--ink-soft); border: 1px solid var(--border); }
.tl-bron { font-size: 11px; color: var(--muted); }
.tl-datum { margin-left: auto; font-size: 11px; color: var(--muted); white-space: nowrap; }
.tl-datum--rood { font-weight: 700; color: var(--red); }
.tl-titel { margin: 0 0 3px; font-family: var(--font-serif); font-size: 15px; font-weight: 700; line-height: 1.35; color: var(--ink); }
.tl-tekst { font-size: 13px; line-height: 1.5; color: var(--ink-soft); }
.tl-tekst--vol { white-space: pre-wrap; }
.tl-status { display: inline-block; margin-top: 8px; padding: 2px 8px; border-radius: 2px; font-size: 10px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; background: var(--surface); color: var(--muted); }
.tl-status--klaar { background: rgba(30, 124, 74, 0.12); color: var(--green); }
.tl-status--laat { background: rgba(192, 57, 43, 0.1); color: var(--red); }

/* Rijen (verslagen, campagnes, documenten) */
.ak-rijen { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; background: var(--wit); border: 1px solid var(--border); }
.ak-rijen > li { border-bottom: 1px solid var(--border); }
.ak-rijen > li:last-child { border-bottom: 0; }
.ak-rij { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 12px; width: 100%; min-height: var(--touch-target-min); padding: 14px 18px; background: none; border: 0; color: inherit; font-family: inherit; text-align: left; text-decoration: none; cursor: pointer; }
.ak-rij:hover { background: var(--surface); }
.ak-rij-info { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 180px; }
.ak-rij-titel { font-family: var(--font-serif); font-size: 15px; font-weight: 700; color: var(--ink); }
.ak-rij-cta { margin-left: auto; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink); }
.ak-doc { display: flex; align-items: center; gap: 8px; padding-right: 12px; }
.ak-doc-icoon { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; background: var(--surface); color: var(--ink); }

.ak-blokken { display: grid; gap: var(--kaart-gap, 16px); grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
.mt-24 { margin-top: 24px; }
@media (max-width: 719px) {
  .ak-kop { padding: 20px 0; }
  .ak-merk { width: 48px; height: 48px; margin-top: 20px; font-size: 15px; }
  .ak-tabs-binnen { gap: 18px; }
  .tl-datum { margin-left: 0; }
}
</style>
