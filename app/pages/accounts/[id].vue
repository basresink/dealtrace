<script setup lang="ts">
// Accountkaart (F03, 8.5.5) in de opzet van DealDrive: kop met logovlak, kruimel, branche en plaats, naam met
// klassepil, website en de stuurstrip; rechts Info, Contacten en Briefing. Het logovlak toont het logo
// (eigen logo-URL of het favicon van de website) en anders de initialen. Daaronder de statstrook over de
// volle breedte, de aanleiding en de tabbladen Tijdlijn, Inzichten, Taken, Notities, E-mails, Afspraken,
// Gespreksverslagen, Campagnes en Documenten, plus Reis en kwalificatie. Eigen velden staan in het
// Info-venster. Het tabblad staat in de URL (?tab=); ze staan in KaartTabbladen, gedeeld met de
// contactkaart, en tonen bij elk item het contact.
// Op de telefoon compact met een plakkende actiebalk (Bellen, Mail, WhatsApp, Navigeer).
import { CONTACTROL_LABEL, type ContactRol } from '~~/shared/contactgegevens'
import { STATUS_LABEL, STATUS_PIL, datumKort, fasePil, klasseKort, telLink, toonTelefoon } from '~/utils/accountWeergave'
const route = useRoute()
const { functie, me } = useMe()
if (!functie('prospects.kaart')?.beschikbaar) throw createError({ statusCode: 403, statusMessage: 'Geen toegang' })
const toast = useToast()
const { data: a, refresh } = await useFetch<any>(() => `/api/accounts/${route.params.id}`)
const leeg = { taken: [], inzichten: [], afspraken: [], mails: [], verslagen: [], deals: [], gebeurtenissen: [], campagnes: [], documenten: [], momenten: [] }
const { data: t, refresh: refreshTabs } = await useFetch<any>(() => `/api/accounts/${route.params.id}/tabbladen`, { default: () => leeg })
async function ververs() { await Promise.all([refresh(), refreshTabs()]) }
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
// F2 en F7: Volgen (volgende beste stap en opvolgreeks); ?volgen=1 opent het venster (link uit een melding).
const volgenOpen = ref(route.query.volgen === '1')
// F8: de invloedskaart van het account (knop Invloed).
const invloedOpen = ref(false)
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
async function verwijder() {
  verwijderOpen.value = false
  try { await $fetch(`/api/accounts/${a.value.id}`, { method: 'DELETE' }); toast.toon(`${a.value.naam} is verwijderd.`); await navigateTo('/prospects/alle') } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const SOORT: Record<string, string> = { gebeld: 'Gebeld', mail: 'Mail', notitie: 'Notitie', bericht: 'Bericht', linkedin: 'LinkedIn', afspraak: 'Afspraak', bezoek: 'Bezoek', 'account verwijderd': 'Verwijderd', reis: 'Reis', import: 'Import' }
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
const extern = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`)
// Het logovlak is 64 px, op de telefoon 48 px (zoals de initialen eerder).
const logoMaat = ref(64)
onMounted(() => { if (window.matchMedia('(max-width: 719px)').matches) logoMaat.value = 48 })
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
</script>

<template>
  <div v-if="a" class="accountkaart">
    <!-- Kop -->
    <header class="ak-kop">
      <div class="container">
        <div class="ak-kop-binnen">
          <AccountLogo class="ak-merk" :naam="a.naam" :initialen="initialen" :kleur="merkKleur ?? 'var(--ink)'" :logo-url="a.logoUrl" :website="a.website" :domein="a.domein" :logo-uit="a.logoUit" :grootte="logoMaat" />
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
              <a v-if="a.website" :href="extern(a.website)" target="_blank" rel="noopener" data-test="ak-website"><Icoon naam="Globe" :grootte="14" /> {{ websiteKort }} <span class="ak-ext">↗</span></a>
              <a v-if="a.telefoon" :href="telLink(a.telefoon)" class="tnum"><Icoon naam="Phone" :grootte="14" /> {{ toonTelefoon(a.telefoon) }}</a>
              <a v-if="a.linkedin" :href="extern(a.linkedin)" target="_blank" rel="noopener"><Icoon naam="Linkedin" :grootte="14" /> LinkedIn <span class="ak-ext">↗</span></a>
              <a v-if="a.instagram" :href="extern(a.instagram)" target="_blank" rel="noopener" data-test="ak-instagram"><Icoon naam="Instagram" :grootte="14" /> Instagram <span class="ak-ext">↗</span></a>
              <a v-if="a.facebook" :href="extern(a.facebook)" target="_blank" rel="noopener" data-test="ak-facebook"><Icoon naam="Facebook" :grootte="14" /> Facebook <span class="ak-ext">↗</span></a>
              <a v-if="a.crm" :href="a.crm.url" target="_blank" rel="noopener" data-test="open-crm"><Icoon naam="Link" :grootte="14" /> Open in {{ a.crm.label }}</a>
            </div>
            <dl class="ak-stuurstrip alleen-groot" data-test="stuurstrip">
              <div><dt>Laatste actie</dt><dd class="tnum">{{ datumLang(a.stuur.laatsteActie) }}</dd></div>
              <div><dt>Laatste call</dt><dd class="tnum">{{ datumLang(a.stuur.laatsteCall) }}</dd></div>
              <div><dt>Laatste bezoek</dt><dd class="tnum">{{ datumLang(a.stuur.laatsteBezoek) }}</dd></div>
              <div><dt>Reis</dt><dd><NuxtLink v-if="a.reis && a.kan.reisBekijken" :to="`/reizen/${a.reis.id}`" data-test="reis-link">{{ a.reis.naam }}</NuxtLink><template v-else>{{ a.reis?.naam ?? 'Geen reis' }}</template></dd></div>
              <div v-if="a.terugkom"><dt>Terug op</dt><dd data-test="terug-op">{{ a.terugkom.tekst.replace(/^Terug op /, '').split(' · ').slice(0, 2).join(' · ') }}</dd></div>
            </dl>
          </div>
          <div class="ak-acties">
            <KopIconen artikel="de-accountkaart-lezen" :ai="{ accountId: a.id, label: a.naam }" />
            <button v-if="functie('contact.visitekaartje')?.beschikbaar" type="button" class="dd-actie dd-actie--secundair alleen-telefoon" data-test="scan-visitekaartje" @click="kaartjeOpen = true"><Icoon naam="Camera" class="dd-actie-icoon" />Scan visitekaartje</button>
            <button v-if="!inPakket && functie('onderweg.dagpakket')?.beschikbaar" type="button" class="dd-actie dd-actie--secundair alleen-telefoon" data-test="bewaar-offline" @click="bewaarOffline"><Icoon naam="Download" class="dd-actie-icoon" />Bewaar voor offline</button>
            <button v-if="kanKlaarzetten" type="button" class="dd-actie dd-actie--secundair" data-test="klaarzetten-knop" @click="klaarOpen = true"><Icoon naam="MapPin" class="dd-actie-icoon" />Klaarzetten</button>
            <button v-if="a.kanOverdragen && functie('overdracht.basis')?.beschikbaar" type="button" class="dd-actie dd-actie--primair" data-test="overdragen-knop" @click="overdragenOpen = true"><Icoon naam="ArrowRight" class="dd-actie-icoon" />Overdragen</button>
            <button type="button" class="dd-actie dd-actie--secundair" data-test="info-knop" @click="infoOpen = true">Info</button>
            <button type="button" class="dd-actie dd-actie--secundair" data-test="contacten-knop" @click="contactenOpen = true">Contacten <span class="ak-teller tnum">{{ a.contacten.filter((c: any) => c.status !== 'vertrokken').length }}</span></button>
            <button type="button" class="dd-actie dd-actie--zwart" data-test="briefing-knop" @click="briefingOpen = true">Briefing</button>
            <button v-if="functie('prospects.volgen')?.beschikbaar" type="button" class="dd-actie dd-actie--secundair" data-test="knop-volgen" @click="volgenOpen = true"><Icoon naam="Route" class="dd-actie-icoon" />Volgen</button>
            <button type="button" class="dd-actie dd-actie--secundair" data-test="knop-invloed" @click="invloedOpen = true"><Icoon naam="Network" class="dd-actie-icoon" />Invloed</button>
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

    <!-- Tabbladen: gedeeld met de contactkaart (KaartTabbladen). -->
    <KaartTabbladen :account="{ id: a.id, naam: a.naam, soort: a.soort }" :tabbladen="t" :mail-aan="primair?.email ? primair.naam : null" :kan-overdragen="a.kanOverdragen" @ververs="ververs" @overdragen="overdragenOpen = true">
      <template #kwalificatie>
        <div class="ak-blokken">
          <AccountplanBlok :account="{ id: a.id, naam: a.naam }" />
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
    </KaartTabbladen>

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
    <VolgenFlyout v-if="functie('prospects.volgen')?.beschikbaar" :open="volgenOpen" :account-id="a.id" :naam="a.naam" @sluit="volgenOpen = false" @gewijzigd="ververs" />
    <InvloedFlyout :open="invloedOpen" :account-id="a.id" @sluit="invloedOpen = false" @gewijzigd="refresh" />
    <BevestigVenster :open="verwijderOpen" :titel="`${a.naam} verwijderen?`" tekst="Het account en zijn contacten worden verwijderd. De activiteitenlog blijft bewaard." bevestig="Verwijderen" @geannuleerd="verwijderOpen = false" @bevestigd="verwijder" />
    <VisitekaartjeVenster :open="kaartjeOpen" :account="a ? { id: a.id, naam: a.naam } : null" @sluit="kaartjeOpen = false" @bewaard="refresh()" />
    <KlaarzetFlyout :open="klaarOpen" :account="a ? { id: a.id, naam: a.naam } : null" @sluit="klaarOpen = false" />
    <OverdrachtVenster :open="overdragenOpen" :account-id="a?.id ?? null" :account-naam="a?.naam ?? ''" @sluit="overdragenOpen = false" @overgedragen="ververs()" />
  </div>
  <OfflineAccount v-else :id="String(route.params.id)" />
</template>

<style scoped>
/* Kop (opzet uit DealDrive: klant-header) */
.ak-kop { padding: 28px 0; background: var(--wit); border-bottom: 1px solid var(--border); }
.ak-kop-binnen { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 18px; align-items: start; }
@media (min-width: 1000px) { .ak-kop-binnen { grid-template-columns: auto minmax(0, 1fr) auto; } }
.ak-merk { margin-top: 22px; }
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
@media (min-width: 1000px) { .ak-acties { grid-column: auto; justify-content: flex-end; max-width: 560px; margin-top: 22px; } }
.ak-teller { padding: 1px 6px; font-size: 10px; font-weight: 800; background: var(--ink); color: var(--yellow); }
.dd-actie--zwart .ak-teller { background: var(--yellow); color: var(--ink); }

/* Statstrook */
.ak-stats { padding: 24px 0; background: var(--bg); border-bottom: 1px solid var(--border); }
.ak-stats { padding: 0; }
/* Zes gelijke kolommen van links naar rechts over de volle breedte, gescheiden door een lijn. */
.ak-stat-raster { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); max-width: none; padding: 0; }
.ak-stat { display: flex; flex-direction: column; gap: 4px; min-width: 0; padding: 20px var(--pagina-marge, 24px); border-left: 1px solid var(--border); }
.ak-stat:first-child { border-left: 0; }
@media (max-width: 999px) { .ak-stat-raster { grid-template-columns: repeat(3, minmax(0, 1fr)); } .ak-stat:nth-child(3n + 1) { border-left: 0; } .ak-stat:nth-child(n + 4) { border-top: 1px solid var(--border); } }
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

.ak-blokken { display: grid; gap: var(--kaart-gap, 16px); grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
.mt-24 { margin-top: 24px; }
@media (max-width: 719px) {
  .ak-kop { padding: 20px 0; }
  .ak-merk { margin-top: 20px; }
}
</style>
