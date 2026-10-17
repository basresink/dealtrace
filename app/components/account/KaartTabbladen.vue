<script setup lang="ts">
// De tabbladen van de accountkaart en de contactkaart (opzet uit DealDrive), één component voor beide:
// Tijdlijn (met filter en + Taak, + Afspraak, + Mail), Inzichten, Taken, Notities, E-mails, Afspraken,
// Gespreksverslagen, Campagnes, Accountplan (alleen de accountkaart) en Documenten, met de vensters. Deals en eigen velden
// hebben geen eigen tabblad meer: deals staan in de tijdlijn, eigen velden in het Info-venster.
// Het tabblad staat in de URL (?tab=). De data komt van GET /api/accounts/:id/tabbladen of
// GET /api/contacten/:id/tabbladen. Op de accountkaart staat bij elk item de naam van het contact met een
// link naar de contactkaart; op de contactkaart hoort alles bij dat ene contact. De inhoud van Reis en
// Accountplan levert de pagina (slot); zonder slot geen tabblad. Reis en kwalificatie staan onder Meer.
import { ACTIE_LABEL, isDringend } from '~~/shared/taken'
/** Status in de tijdlijn als label: klaar groen, open een rand, te laat gevuld rood. */
const tlStatus = (soort: string | undefined, tekst: string) => (soort === 'klaar' ? { soort: 'status', waarde: 'afgerond', tekst } : soort === 'laat' ? { soort: 'urgentie', waarde: 'achterstallig', tekst } : { soort: 'status', waarde: 'nieuw', tekst })

const props = defineProps<{
  account: { id: string; naam: string; soort?: string | null }
  tabbladen: any
  /** Op de contactkaart: het contact waar alles bij hoort. */
  contact?: { id: string; naam: string; email?: string | null } | null
  /** Naam van wie een mail krijgt (op de accountkaart de beslisser). */
  mailAan?: string | null
  kanOverdragen?: boolean
}>()
const emit = defineEmits<{ ververs: []; overdragen: [] }>()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { functie } = useMe()
const t = computed(() => props.tabbladen)
const opContact = computed(() => !!props.contact)
const onderwerp = computed(() => props.contact?.naam ?? props.account.naam)
const dit = computed(() => (opContact.value ? 'dit contact' : 'dit account'))

const OV_NAAR: Record<string, string> = { dealdrive: 'DealDrive', crm: 'het CRM', collega: 'een collega' }
const SOORT: Record<string, string> = { gebeld: 'Gebeld', mail: 'Mail', notitie: 'Notitie', bericht: 'Bericht', linkedin: 'LinkedIn', afspraak: 'Afspraak', bezoek: 'Bezoek', 'account verwijderd': 'Verwijderd', gedeactiveerd: 'Gedeactiveerd', geheractiveerd: 'Heractiveerd', reis: 'Reis', import: 'Import' }
const VORM: Record<string, string> = { bezoek: 'Bezoek', online: 'Online', telefoon: 'Telefoon' }
const AFSPRAAK_STATUS: Record<string, string> = { gepland: 'Gepland', afgerond: 'Gehouden', geannuleerd: 'Geannuleerd', 'no-show': 'Niet verschenen' }
const DEAL_FASE: Record<string, string> = { overgedragen: 'Overgedragen', lopend: 'Loopt in DealDrive', gewonnen: 'Gewonnen', verloren: 'Verloren', klaar: 'Klaar', verstuurd: 'Verstuurd', bevestigd: 'Bevestigd', mislukt: 'Mislukt' }
const CAMP_KOLOM: Record<string, string> = { klaar: 'Klaar', bezig: 'Bezig', afspraak: 'Afspraak', nee: 'Nee', 'geen-reactie': 'Geen reactie', later: 'Later' }
const datumLang = (d: string | null) => (d ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Amsterdam' }).format(new Date(d)).replace('.', '') : '–')
const wanneer = (d: string | null) => (d ? new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(new Date(d)) : 'geen datum')
const grootte = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} kB`)
const tlDatum = (ms: number) => (ms ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' }).format(new Date(ms)).replace('.', '') : '')
/** De contactnaam bij een item (voornaam en achternaam), op de accountkaart en op de contactkaart. */
const contactVan = (x: any) => (x?.contactId && x?.contactNaam ? { id: x.contactId as string, naam: x.contactNaam as string } : null)

const momenten = computed<any[]>(() => t.value.momenten ?? [])
const notities = computed(() => momenten.value.filter((x) => x.soort === 'notitie'))
const openTaken = computed(() => t.value.taken.filter((x: any) => ['open', 'bezig'].includes(x.status)))

// Tabbladen, met het actieve tabblad in de URL.
type Tab = 'tijdlijn' | 'inzichten' | 'taken' | 'notities' | 'mails' | 'afspraken' | 'verslagen' | 'campagnes' | 'accountplan' | 'documenten'
const slots = useSlots()
const metAccountplan = computed(() => !!slots.accountplan)
const TABS = computed<Tab[]>(() => ['tijdlijn', 'inzichten', 'taken', 'notities', 'mails', 'afspraken', 'verslagen', 'campagnes', ...(metAccountplan.value ? ['accountplan' as const] : []), 'documenten'])
const tab = computed<Tab>(() => (TABS.value.includes(route.query.tab as Tab) ? route.query.tab as Tab : 'tijdlijn'))
function kiesTab(x: Tab) { router.replace({ query: { ...route.query, tab: x === 'tijdlijn' ? undefined : x } }) }

// Tijdlijn: inzichten, taken, afspraken, deals en contactmomenten samen, nieuwste eerst.
type TlSoort = 'inzicht' | 'taak' | 'afspraak' | 'deal' | 'contact'
interface TlItem { key: string; soort: TlSoort; soortLabel: string; typeLabel: string; bron?: string | null; titel: string; tekst?: string | null; status?: string; statusSoort?: 'klaar' | 'laat' | 'open'; ms: number; contact: { id: string; naam: string } | null; door?: string | null; open?: () => void }
const tlAlles = computed<TlItem[]>(() => {
  const uit: TlItem[] = []
  for (const s of t.value.inzichten) uit.push({ key: `i-${s.id}`, soort: 'inzicht', soortLabel: 'Inzicht', typeLabel: s.agent ? s.agent : s.bron === 'extern' ? 'Extern' : 'Intern', bron: s.specifiekeBron, titel: s.title, tekst: s.waarom, ms: Date.parse(s.createdAt), contact: contactVan(s), door: s.gebruiker, open: () => { inzicht.value = s } })
  for (const x of t.value.taken) {
    const open = ['open', 'bezig'].includes(x.status)
    uit.push({ key: `t-${x.id}`, soort: 'taak', soortLabel: 'Taak', typeLabel: ACTIE_LABEL[x.actionType] ?? 'Taak', titel: x.title, tekst: x.aanleiding, status: !open ? (x.status === 'geannuleerd' ? 'Geannuleerd' : 'Afgerond') : x.achterstallig ? 'Achterstallig' : 'Open', statusSoort: !open ? 'klaar' : x.achterstallig ? 'laat' : 'open', ms: Date.parse(x.afgerondOp ?? x.dueDate ?? '') || 0, contact: contactVan(x), door: x.gebruiker, open: () => { taakId.value = x.id } })
  }
  for (const x of t.value.afspraken) uit.push({ key: `a-${x.id}`, soort: 'afspraak', soortLabel: 'Afspraak', typeLabel: VORM[x.vorm] ?? x.vorm, titel: x.titel ?? (x.soort + (x.contact ? ` met ${x.contact}` : '')), tekst: x.locatie, status: AFSPRAAK_STATUS[x.status] ?? x.status, statusSoort: x.status === 'afgerond' ? 'klaar' : x.status === 'gepland' ? 'open' : 'laat', ms: Date.parse(x.start), contact: contactVan(x), door: x.gebruiker, open: () => { afspraakId.value = x.id } })
  // Deals horen bij het account; op de contactkaart staan ze alleen in het tabblad Deals.
  if (!opContact.value) for (const d of t.value.deals) uit.push({ key: `d-${d.id}`, soort: 'deal', soortLabel: 'Deal', typeLabel: OV_NAAR[d.naar] ?? d.naar, titel: d.titel, tekst: d.eigenaar ? `Eigenaar in DealDrive: ${d.eigenaar}` : null, status: DEAL_FASE[d.fase] ?? d.fase, statusSoort: d.fase === 'gewonnen' ? 'klaar' : ['verloren', 'mislukt'].includes(d.fase) ? 'laat' : 'open', ms: Date.parse(d.op), contact: null, door: d.gebruiker })
  // Een belactiviteit van een afgeronde beltaak toont ook het gespreksverslag en opent het (met transcript).
  for (const x of momenten.value.filter((m) => m.soort !== 'notitie')) {
    const v = x.verslag || x.transcript ? t.value.verslagen.find((r: any) => r.id === `bel-${x.id}`) : null
    uit.push({ key: `c-${x.id}`, soort: 'contact', soortLabel: 'Contact', typeLabel: SOORT[x.soort] ?? x.soort, titel: [SOORT[x.soort] ?? x.soort, x.uitkomst ? String(x.uitkomst).replace(/_/g, ' ') : null].filter(Boolean).join(' · '), tekst: [x.tekst, x.verslag ? `Verslag: ${x.verslag}` : null, x.transcript ? 'Met transcript' : null].filter(Boolean).join(' · ') || null, ms: Date.parse(x.op), contact: contactVan(x), door: x.gebruiker, open: v ? () => { verslag.value = v } : undefined })
  }
  return uit.sort((p, q) => q.ms - p.ms)
})
const tlFilter = ref<'alles' | TlSoort>('alles')
const tlFiltersOpen = ref(false)
const tlSoorten = computed(() => {
  const tel = (s: TlSoort) => tlAlles.value.filter((i) => i.soort === s).length
  return [{ id: 'alles' as const, label: 'Alles', n: tlAlles.value.length }, ...([['inzicht', 'Inzichten'], ['taak', 'Taken'], ['afspraak', 'Afspraken'], ['deal', 'Deals'], ['contact', 'Contactmomenten']] as const).map(([id, label]) => ({ id, label, n: tel(id) })).filter((s) => s.n)]
})
const tijdlijn = computed(() => (tlFilter.value === 'alles' ? tlAlles.value : tlAlles.value.filter((i) => i.soort === tlFilter.value)))

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

// Vensters vanuit de tabbladen.
const taakId = ref<string | null>(null)
const inzicht = ref<any | null>(null)
const afspraakId = ref<string | null>(null)
const verslag = ref<any | null>(null)
const nieuweTaak = ref(false)
const nieuweAfspraak = ref(false)
const mailOpen = ref(false)
const kanMail = computed(() => !!functie('mail.versturen')?.beschikbaar && (!props.contact || !!props.contact.email))
const accountRef = computed(() => ({ id: props.account.id, naam: props.account.naam }))
const ververs = () => emit('ververs')
const notitie = ref('')
async function bewaarNotitie() {
  if (!notitie.value.trim()) return
  try { await $fetch(`/api/accounts/${props.account.id}/notities`, { method: 'POST', body: { tekst: notitie.value, contactId: props.contact?.id } }); notitie.value = ''; ververs() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const tabs = computed(() => [
  { id: 'tijdlijn' as const, label: 'Tijdlijn', n: tlAlles.value.length },
  { id: 'inzichten' as const, label: 'Inzichten', n: t.value.inzichten.length },
  { id: 'taken' as const, label: 'Taken', n: openTaken.value.length },
  { id: 'notities' as const, label: 'Notities', n: notities.value.length },
  { id: 'mails' as const, label: 'E-mails', n: t.value.mails.length },
  { id: 'afspraken' as const, label: 'Afspraken', n: t.value.afspraken.length },
  { id: 'verslagen' as const, label: 'Gespreksverslagen', n: t.value.verslagen.length },
  { id: 'campagnes' as const, label: 'Campagnes', n: t.value.campagnes.length },
  ...(metAccountplan.value ? [{ id: 'accountplan' as const, label: 'Accountplan', n: 0 }] : []),
  { id: 'documenten' as const, label: 'Documenten', n: t.value.documenten.length },
])
</script>

<template>
  <div class="kaart-tabbladen">
    <nav class="ak-tabs" :aria-label="opContact ? 'Tabbladen van de contactkaart' : 'Tabbladen van de accountkaart'">
      <div class="container ak-tabs-binnen">
        <button v-for="x in tabs" :key="x.id" type="button" class="ak-tab" :class="{ 'ak-tab--aan': tab === x.id }" :aria-current="tab === x.id ? 'page' : undefined" :data-test="`tab-${x.id}`" @click="kiesTab(x.id)">{{ x.label }}<span v-if="x.n" class="ak-tab-teller tnum">{{ x.n }}</span></button>
      </div>
    </nav>

    <section class="ak-sectie ak-sectie--grijs section--laatste">
      <div class="container">
        <!-- Tijdlijn -->
        <template v-if="tab === 'tijdlijn'">
          <div class="ak-tabkop">
            <h2 class="ak-tabtitel">{{ opContact ? `Tijdlijn met ${onderwerp}` : 'Tijdlijn' }} ({{ tijdlijn.length }})</h2>
            <div class="toolbar-buttons">
              <button type="button" class="dd-actie dd-actie--primair" data-test="tl-taak" @click="nieuweTaak = true"><Icoon naam="Plus" class="dd-actie-icoon" />Taak</button>
              <button type="button" class="dd-actie dd-actie--zwart" data-test="tl-afspraak" @click="nieuweAfspraak = true"><Icoon naam="Plus" class="dd-actie-icoon" />Afspraak</button>
              <button v-if="kanMail" type="button" class="dd-actie dd-actie--secundair" data-test="tl-mail" @click="mailOpen = true"><Icoon naam="Plus" class="dd-actie-icoon" />Mail</button>
              <button type="button" class="dd-actie dd-actie--secundair" :aria-expanded="tlFiltersOpen" data-test="tl-filters" @click="tlFiltersOpen = !tlFiltersOpen"><Icoon naam="SlidersHorizontal" class="dd-actie-icoon" />Filters<span v-if="tlFilter !== 'alles'" class="ak-teller">1</span><Icoon naam="ChevronDown" :grootte="14" /></button>
            </div>
          </div>
          <div v-if="tlFiltersOpen" class="ak-filterstrook chips">
            <span class="ak-filterlabel">Soort</span>
            <button v-for="s in tlSoorten" :key="s.id" type="button" class="filter-pil" :class="{ 'filter-pil--aan': tlFilter === s.id }" @click="tlFilter = s.id">{{ s.label }} <span class="pil-teller">{{ s.n }}</span></button>
          </div>
          <p v-if="!tijdlijn.length" class="ak-leeg">Nog niets vastgelegd voor {{ dit }} in deze selectie.<template v-if="opContact"> Wat alleen op accountniveau bekend is, staat op de <NuxtLink :to="`/accounts/${account.id}`" class="tekst-link">accountkaart</NuxtLink>.</template></p>
          <ol v-else class="tl-lijst" data-test="tijdlijn">
            <li v-for="i in tijdlijn" :key="i.key" class="tl-item">
              <span class="tl-spoor" :class="`tl-spoor--${i.soort}`" aria-hidden="true" />
              <div class="tl-kaart" :class="{ 'tl-kaart--klik': i.open }">
                <span class="tl-kop"><span class="tl-soort" :class="`tl-soort--${i.soort}`">{{ i.soortLabel }}</span><span class="tl-type">{{ i.typeLabel }}</span><span v-if="i.bron" class="tl-bron">{{ i.bron }}</span><ItemMetaregel :contact="i.contact" :door="i.door" :datum="tlDatum(i.ms)" /></span>
                <button v-if="i.open" type="button" class="tl-titel tl-strek" @click="i.open()">{{ i.titel }}</button>
                <span v-else class="tl-titel">{{ i.titel }}</span>
                <span v-if="i.tekst" class="tl-tekst">{{ i.tekst }}</span>
                <Label v-if="i.status" class="tl-status" v-bind="tlStatus(i.statusSoort, i.status)" />
              </div>
            </li>
          </ol>
        </template>

        <!-- Inzichten -->
        <template v-else-if="tab === 'inzichten'">
          <div class="ak-tabkop"><h2 class="ak-tabtitel">Inzichten voor {{ onderwerp }} ({{ t.inzichten.length }})</h2><span class="meta">Klik een inzicht voor het bewijs en de bron</span></div>
          <p v-if="!t.inzichten.length" class="ak-leeg">Nog geen inzichten voor {{ dit }}. De Waarnemer en de motor vullen dit zodra ze iets zien.</p>
          <ol v-else class="tl-lijst">
            <li v-for="s in t.inzichten" :key="s.id" class="tl-item">
              <span class="tl-spoor tl-spoor--inzicht" aria-hidden="true" />
              <div class="tl-kaart tl-kaart--klik">
                <span class="tl-kop"><span class="tl-soort tl-soort--inzicht">{{ s.relevantie >= 75 ? 'Heet' : 'Inzicht' }}</span><span class="tl-type">{{ s.agent ?? (s.bron === 'extern' ? 'Extern' : 'Intern') }}</span><span v-if="s.specifiekeBron" class="tl-bron">{{ s.specifiekeBron }}</span><ItemMetaregel :contact="contactVan(s)" :door="s.gebruiker" :datum="tlDatum(Date.parse(s.createdAt))" /></span>
                <button type="button" class="tl-titel tl-strek" :data-test="`ak-inzicht-${s.id}`" @click="inzicht = s">{{ s.title }}</button>
                <span v-if="s.waarom" class="tl-tekst">{{ s.waarom }}</span>
                <Label class="tl-status" v-bind="tlStatus(s.status === 'nieuw' ? 'open' : 'klaar', s.status === 'nieuw' ? 'Ongezien' : s.status === 'omgezet' ? 'Taak gemaakt' : 'Gelezen')" />
              </div>
            </li>
          </ol>
        </template>

        <!-- Taken -->
        <template v-else-if="tab === 'taken'">
          <div class="ak-tabkop"><h2 class="ak-tabtitel">Acties voor {{ onderwerp }} ({{ openTaken.length }} open)</h2><button type="button" class="dd-actie dd-actie--primair" data-test="taken-nieuw" @click="nieuweTaak = true"><Icoon naam="Plus" class="dd-actie-icoon" />Taak</button></div>
          <p v-if="!t.taken.length" class="ak-leeg">Nog geen acties voor {{ dit }}. Klik op <strong>+ Taak</strong> hierboven.</p>
          <template v-for="g in takenGroepen" :key="g.label">
            <header class="ak-groepkop"><h3>{{ g.label }}</h3><span class="tnum">{{ g.items.length }}</span></header>
            <ol class="tl-lijst">
              <li v-for="x in g.items" :key="x.id" class="tl-item">
                <span class="tl-spoor" :class="isDringend(x.priority) ? 'tl-spoor--urgent' : 'tl-spoor--taak'" aria-hidden="true" />
                <div class="tl-kaart tl-kaart--klik">
                  <span class="tl-kop"><Label soort="actie" :waarde="x.actionType ?? 'taak'" /><Label soort="prioriteit" :waarde="x.priority" /><Label soort="herkomst" :waarde="x.herkomst ?? 'handmatig'" /><ItemMetaregel :contact="contactVan(x)" :door="x.gebruiker" :datum="wanneer(x.dueDate)" :datum-rood="x.achterstallig" /></span>
                  <button type="button" class="tl-titel tl-strek" :data-test="`ak-taak-${x.id}`" @click="taakId = x.id">{{ x.title }}</button>
                  <span v-if="x.aanleiding || x.poging" class="tl-tekst">{{ [x.aanleiding, x.poging ? `poging ${x.poging.n} van ${x.poging.van}` : null].filter(Boolean).join(' · ') }}</span>
                  <Label v-if="!['open', 'bezig'].includes(x.status)" class="tl-status" v-bind="tlStatus('klaar', `${x.status === 'geannuleerd' ? 'Geannuleerd' : 'Afgerond'}${x.uitkomst ? ` · ${x.uitkomst}` : ''}`)" />
                  <Label v-else-if="x.achterstallig" class="tl-status" v-bind="tlStatus('laat', 'Achterstallig')" />
                </div>
              </li>
            </ol>
          </template>
        </template>

        <!-- Notities -->
        <template v-else-if="tab === 'notities'">
          <div class="ak-tabkop"><h2 class="ak-tabtitel">Notities ({{ notities.length }})</h2></div>
          <form class="kaart" @submit.prevent="bewaarNotitie"><label class="veld"><span class="veld-label">Nieuwe notitie<template v-if="opContact"> over {{ onderwerp }}</template></span><textarea v-model="notitie" class="invoer" rows="3" data-test="notitie" /></label><button type="submit" class="dd-act dd-act--geel mt-16" data-test="notitie-bewaar" :disabled="!notitie.trim()">Notitie bewaren</button></form>
          <ol v-if="notities.length" class="tl-lijst mt-16">
            <li v-for="n in notities" :key="n.id" class="tl-item"><span class="tl-spoor tl-spoor--contact" aria-hidden="true" /><div class="tl-kaart"><span class="tl-kop"><span class="tl-soort tl-soort--contact">Notitie</span><ItemMetaregel :contact="contactVan(n)" :door="n.gebruiker" :datum="datumLang(n.op)" /></span><span class="tl-tekst tl-tekst--vol">{{ n.tekst }}</span></div></li>
          </ol>
        </template>

        <!-- E-mails -->
        <template v-else-if="tab === 'mails'">
          <div class="ak-tabkop"><h2 class="ak-tabtitel">E-mails<template v-if="opContact"> met {{ onderwerp }}</template> ({{ t.mails.length }})</h2><button v-if="kanMail" type="button" class="dd-actie dd-actie--primair" data-test="mails-nieuw" @click="mailOpen = true"><Icoon naam="Plus" class="dd-actie-icoon" />Mail</button></div>
          <p v-if="!t.mails.length" class="ak-leeg">Nog geen mails met {{ opContact ? onderwerp : 'dit account' }}. Schrijf er een met <strong>+ Mail</strong>, of laat de Schrijver een concept klaarzetten.</p>
          <ol v-else class="tl-lijst">
            <li v-for="m in t.mails" :key="m.id" class="tl-item">
              <span class="tl-spoor" :class="m.concept ? 'tl-spoor--inzicht' : 'tl-spoor--mail'" aria-hidden="true" />
              <div class="tl-kaart" :class="{ 'tl-kaart--klik': m.concept }">
                <span class="tl-kop"><span class="tl-soort" :class="m.concept ? 'tl-soort--inzicht' : 'tl-soort--mail'">{{ m.concept ? 'Concept' : 'Mail' }}</span><span class="tl-type">{{ m.status }}</span><ItemMetaregel :contact="contactVan(m)" :door="m.gebruiker" :datum="tlDatum(Date.parse(m.op))" /></span>
                <NuxtLink v-if="m.concept" to="/concepten" class="tl-titel tl-strek">{{ m.onderwerp }}</NuxtLink>
                <span v-else class="tl-titel">{{ m.onderwerp }}</span>
                <span v-if="m.tekst" class="tl-tekst">{{ m.tekst.length > 220 ? `${m.tekst.slice(0, 220)}...` : m.tekst }}</span>
              </div>
            </li>
          </ol>
        </template>

        <!-- Afspraken -->
        <template v-else-if="tab === 'afspraken'">
          <div class="ak-tabkop"><h2 class="ak-tabtitel">Afspraken met {{ onderwerp }} ({{ t.afspraken.length }})</h2><button type="button" class="dd-actie dd-actie--zwart" data-test="afspraken-nieuw" @click="nieuweAfspraak = true"><Icoon naam="Plus" class="dd-actie-icoon" />Afspraak</button></div>
          <p v-if="!t.afspraken.length" class="ak-leeg">Nog geen afspraken voor {{ dit }}. Klik op <strong>+ Afspraak</strong> hierboven.<template v-if="opContact"> Alle afspraken bij {{ account.naam }} staan op de <NuxtLink :to="`/accounts/${account.id}?tab=afspraken`" class="tekst-link">accountkaart</NuxtLink>.</template></p>
          <ol v-else class="tl-lijst">
            <li v-for="x in t.afspraken" :key="x.id" class="tl-item">
              <span class="tl-spoor tl-spoor--afspraak" aria-hidden="true" />
              <div class="tl-kaart tl-kaart--klik">
                <span class="tl-kop"><span class="tl-soort tl-soort--afspraak">{{ x.soort }}</span><span class="tl-type">{{ VORM[x.vorm] ?? x.vorm }}</span><ItemMetaregel :contact="contactVan(x)" :door="x.gebruiker" :datum="wanneer(x.start)" /></span>
                <button type="button" class="tl-titel tl-strek" :data-test="`ak-afspraak-${x.id}`" @click="afspraakId = x.id"><template v-if="x.titel">{{ x.titel }}</template><template v-else>{{ x.soort }}<template v-if="x.contact"> met {{ x.contact }}</template></template></button>
                <span v-if="x.locatie" class="tl-tekst">{{ x.locatie }}</span>
                <Label class="tl-status" v-bind="tlStatus(x.status === 'afgerond' ? 'klaar' : x.status === 'gepland' ? 'open' : 'laat', `${AFSPRAAK_STATUS[x.status] ?? x.status}${x.heeftVerslag ? ' · verslag' : ''}`)" />
              </div>
            </li>
          </ol>
        </template>

        <!-- Gespreksverslagen -->
        <template v-else-if="tab === 'verslagen'">
          <div class="ak-tabkop"><h2 class="ak-tabtitel">Gespreksverslagen ({{ t.verslagen.length }})</h2><span class="meta">Uit beltaken en afspraken</span></div>
          <p v-if="!t.verslagen.length" class="ak-leeg">Nog geen gespreksverslagen. Leg ze vast bij het afronden van een beltaak of in het verslag van een afspraak.</p>
          <ul v-else class="ak-rijen">
            <li v-for="v in t.verslagen" :key="v.id" class="ak-rij">
              <span class="tl-soort" :class="v.bron === 'afspraak' ? 'tl-soort--afspraak' : 'tl-soort--taak'">{{ v.bronLabel }}</span>
              <span class="tl-type">{{ v.typeLabel }}</span>
              <span class="ak-rij-info">
                <button type="button" class="ak-rij-titel tl-strek" :data-test="`ak-verslag-${v.id}`" @click="verslag = v">{{ v.titel }}</button>
                <span class="ak-rij-meta"><ItemMetaregel los :contact="contactVan(v)" :door="v.gebruiker" :datum="datumLang(v.datum)" /><span class="meta tnum">{{ v.woorden }} woorden</span></span>
              </span>
              <span class="ak-rij-cta">Open →</span>
            </li>
          </ul>
        </template>

        <!-- Campagnes -->
        <template v-else-if="tab === 'campagnes'">
          <div class="ak-tabkop"><h2 class="ak-tabtitel">Campagnes ({{ t.campagnes.length }})</h2><NuxtLink to="/campagnes" class="dd-actie dd-actie--secundair">Alle campagnes →</NuxtLink></div>
          <p class="meta ak-hint">{{ opContact ? 'De campagnes met een taak of contactmoment voor dit contact, met de stand op het campagnebord.' : 'De campagnes waarin dit account meeloopt, met de stand op het campagnebord.' }}</p>
          <p v-if="!t.campagnes.length" class="ak-leeg">{{ opContact ? 'Dit contact' : 'Dit account' }} loopt in geen enkele campagne mee. Voeg het account toe op een campagnebord onder <NuxtLink to="/campagnes" class="tekst-link">Campagnes</NuxtLink>.</p>
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

        <!-- Documenten: gedeeld met de kennisbank (DocumentenTab). -->
        <template v-else-if="tab === 'documenten'">
          <DocumentenTab :account="accountRef" :contact="contact ? { id: contact.id, naam: contact.naam } : null" :documenten="t.documenten" :afspraak-bijlagen="t.afspraakBijlagen ?? []" @ververs="ververs" />
        </template>

        <!-- Accountplan: de inhoud levert de accountkaart. -->
        <template v-else-if="tab === 'accountplan'">
          <slot name="accountplan" />
        </template>

      </div>
    </section>

    <TaakFlyout :open="!!taakId" :taak-id="taakId" :lijst="openTaken.map((x: any) => x.id)" @sluit="taakId = null" @klaar="taakId = null; ververs()" @gewijzigd="ververs()" />
    <InzichtFlyout :open="!!inzicht" :inzicht="inzicht" @sluit="inzicht = null" @gewijzigd="inzicht = null; ververs()" />
    <AfspraakFlyout :open="!!afspraakId" :afspraak-id="afspraakId" @sluit="afspraakId = null" @gewijzigd="ververs()" />
    <VerslagFlyout :open="!!verslag" :verslag="verslag" @sluit="verslag = null" @afspraak="(id) => { verslag = null; afspraakId = id }" />
    <NieuweTaakFlyout :open="nieuweTaak" :account="accountRef" :contact="contact ? { id: contact.id, naam: contact.naam } : null" @sluit="nieuweTaak = false" @gemaakt="nieuweTaak = false; ververs()" />
    <PlanAfspraakFlyout :open="nieuweAfspraak" :account="accountRef" :contact-id="contact?.id ?? null" @sluit="nieuweAfspraak = false" @gepland="nieuweAfspraak = false; ververs()" />
    <MailFlyout v-if="kanMail" :open="mailOpen" :account="contact ? { id: account.id, naam: contact.naam } : accountRef" :aan="contact ? contact.naam : mailAan ?? null" :contact-id="contact?.id ?? null" @sluit="mailOpen = false" @verstuurd="mailOpen = false; ververs()" />
  </div>
</template>

<style scoped>
/* Tabbladen */
.ak-tabs { position: sticky; top: 0; z-index: 10; background: var(--wit); border-bottom: 1px solid var(--border); }
.ak-tabs-binnen { display: flex; gap: 24px; overflow-x: auto; scrollbar-width: thin; }
.ak-tab { display: inline-flex; align-items: center; gap: 8px; min-height: var(--touch-target-min); padding: 14px 2px; background: transparent; border: 0; border-bottom: 2px solid transparent; color: var(--muted); font-family: inherit; font-size: 13px; font-weight: 600; white-space: nowrap; cursor: pointer; transition: color var(--transition-fast), border-color var(--transition-fast); }
.ak-tab:hover { color: var(--ink); }
.ak-tab--aan { color: var(--ink); border-bottom-color: var(--yellow); }
.ak-tab-teller { padding: 1px 6px; font-size: 11px; font-weight: 700; background: var(--surface); color: var(--ink-soft); }
.ak-teller { padding: 1px 6px; font-size: 10px; font-weight: 800; background: var(--ink); color: var(--yellow); }

/* Secties */
.ak-sectie { padding: 32px 0; border-bottom: 1px solid var(--border); }
.ak-sectie--grijs { background: #f4f3ef; }

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

/* Tijdlijnkaarten (tl-*). De titel is de knop en strekt zich over de hele kaart uit (tl-strek), zodat de
   link naar het contact erboven klikbaar blijft. */
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
.tl-kaart { position: relative; display: flex; flex-direction: column; align-items: flex-start; width: 100%; padding: 12px 16px; background: var(--wit); border: 1px solid var(--border); color: inherit; font-family: inherit; text-align: left; text-decoration: none; transition: border-color var(--transition-fast), background var(--transition-fast); }
.tl-kaart--klik { cursor: pointer; }
.tl-kaart--klik:hover { border-color: var(--ink); background: var(--surface); }
.tl-strek { padding: 0; background: none; border: 0; text-align: left; text-decoration: none; cursor: pointer; }
.tl-strek::after { content: ''; position: absolute; inset: 0; }
.tl-strek:focus-visible { outline: none; }
.tl-strek:focus-visible::after { outline: 2px solid var(--ink); outline-offset: -2px; }
.tl-kop { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; width: 100%; margin-bottom: 6px; }
/* Soort en type zijn feiten: randlabels (UI-standaard, Labels). */
.tl-soort, .tl-type { display: inline-flex; align-items: center; height: var(--lbl-h); padding: 0 6px; border: 1px solid var(--lbl-rand-lijn); border-radius: 2px; font-size: var(--lbl-fs); font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--lbl-rand-tekst); }
.tl-soort { border-color: var(--lbl-rand-tekst); }
.tl-bron { font-size: 11px; color: var(--muted); }
.ak-rij-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 6px; }
.ak-rij-meta > .meta::before { content: '·'; margin-right: 6px; }
.tl-titel { margin: 0 0 3px; font-family: var(--font-serif); font-size: 15px; font-weight: 700; line-height: 1.35; color: var(--ink); }
.tl-tekst { font-size: 13px; line-height: 1.5; color: var(--ink-soft); }
.tl-tekst--vol { white-space: pre-wrap; }
.tl-status { margin-top: 8px; }

/* Rijen (verslagen, campagnes, documenten) */
.ak-rijen { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; background: var(--wit); border: 1px solid var(--border); }
.ak-rijen > li { border-bottom: 1px solid var(--border); }
.ak-rijen > li:last-child { border-bottom: 0; }
.ak-rij { position: relative; display: flex; flex-wrap: wrap; align-items: center; gap: 10px 12px; width: 100%; min-height: var(--touch-target-min); padding: 14px 18px; background: none; border: 0; color: inherit; font-family: inherit; text-align: left; text-decoration: none; cursor: pointer; }
.ak-rij:hover { background: var(--surface); }
.ak-rij-info { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; flex: 1; min-width: 180px; }
.ak-rij-titel { font-family: var(--font-serif); font-size: 15px; font-weight: 700; color: var(--ink); }
.ak-rij-cta { margin-left: auto; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink); }
.ak-doc { display: flex; align-items: center; gap: 8px; padding-right: 12px; }
.ak-doc-icoon { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; background: var(--surface); color: var(--ink); }

@media (max-width: 719px) {
  .ak-tabs-binnen { gap: 18px; }
}
</style>
