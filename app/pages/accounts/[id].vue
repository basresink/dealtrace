<script setup lang="ts">
// Accountkaart (F03, 8.5.5) in de opzet van DealDrive: kop met logovlak, kruimel, branche en plaats, naam met
// klasselabel, website en de stuurstrip; rechts Zoeken, Vraag AI, Contacten, Info en Meer. Meer opent een venster
// met korte kaders (Briefing, Volgen, Invloed, Belscript, Dossier, Kwalificatie, Reis, Campagnes, Accountplan,
// Klaarzetten, Overdragen en Deactiveren) die elk hun eigen venster openen, met "Meer" terug in de kop;
// ?meer=<id> opent er direct een. Het logovlak toont het logo (eigen logo-URL of het favicon van de website) en
// anders de initialen. Daaronder de statstrook over de volle breedte, de stand van een overdracht en de
// tabbladen Tijdlijn, Inzichten, Taken, Notities, E-mails, Afspraken, Gespreksverslagen en Documenten. Eigen velden en de
// huidige leverancier staan in het Info-venster. Het tabblad staat in de URL (?tab=); ze staan in
// KaartTabbladen, gedeeld met de contactkaart, en tonen bij elk item het contact.
// Op de telefoon compact met een plakkende actiebalk (Bellen, Mail, WhatsApp, Navigeer).
import { CONTACTROL_LABEL, type ContactRol } from '~~/shared/contactgegevens'
import { berichtKanaalLabel } from '~~/shared/taken'
import type { Ref } from 'vue'
import type { MeerKader } from '~/components/account/MeerFlyout.vue'
import { STATUS_LABEL, datumKort, klasseKort, telLink, toonTelefoon } from '~/utils/accountWeergave'
const route = useRoute()
const { functie, me } = useMe()
if (!functie('prospects.kaart')?.beschikbaar) throw createError({ statusCode: 403, statusMessage: 'Geen toegang' })
const toast = useToast()
const { data: a, refresh } = await useFetch<any>(() => `/api/accounts/${route.params.id}`)
const leeg = { taken: [], inzichten: [], afspraken: [], mails: [], verslagen: [], deals: [], gebeurtenissen: [], campagnes: [], documenten: [], momenten: [] }
const { data: t, refresh: refreshTabs } = await useFetch<any>(() => `/api/accounts/${route.params.id}/tabbladen`, { default: () => leeg })
async function ververs() { await Promise.all([refresh(), refreshTabs()]) }
// De naam voor de contextchip van de assistent, ook als die vanuit de mobiele kop opent.
const accountNaam = useState<string | null>('accountNaam', () => null)
watch(() => a.value?.naam, (n) => { accountNaam.value = n ?? null }, { immediate: true })
onBeforeUnmount(() => { accountNaam.value = null })
if (!a.value) throw createError({ statusCode: 404, statusMessage: 'Account onbekend' })
const infoOpen = ref(false)
const briefingOpen = ref(false)
// F2 en F7: Volgen (volgende beste stap en opvolgreeks); ?volgen=1 opent het venster (link uit een melding).
const volgenOpen = ref(route.query.volgen === '1')
// F8: de invloedskaart van het account.
const invloedOpen = ref(false)
// P17: overdracht na de eerste afspraak.
const overdragenOpen = ref(route.query.overdragen === '1')
const OV_NAAR: Record<string, string> = { dealdrive: 'DealDrive', crm: 'het CRM', collega: 'een collega' }
// P23: het antwoord op "Mag dit een bewijs worden?" na een gewonnen deal in DealDrive.
async function bewijs(ja: boolean) {
  try { await $fetch(`/api/accounts/${route.params.id}/bewijs`, { method: 'POST', body: { ja } }); toast.toon(ja ? 'Je salesmanager krijgt het als suggestie.' : 'Genoteerd. Er gaat niets naar je salesmanager.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function overdrachtOpnieuw() {
  try { const r = await $fetch<any>(`/api/overdrachten/${a.value.overdracht.id}/opnieuw`, { method: 'POST' }); toast.toon(r.status === 'mislukt' ? 'Opnieuw mislukt.' : 'Overdracht opnieuw verstuurd.'); await ververs() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const contactenOpen = ref(false)
// 0064: deactiveren in plaats van verwijderen, met een balk en Heractiveren bovenaan de kaart.
const deactiveerOpen = ref(false)
const heractiveerBezig = ref(false)
// P05: reis, fase en status
const geschiedenisOpen = ref(false)
const neeOpen = ref(false)
const handeling = ref<null | 'fase' | 'pauzeer' | 'verplaats' | 'terugop'>(null)
async function klaar(tekst: string) { neeOpen.value = false; handeling.value = null; toast.toon(tekst); await ververs() }
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
async function gedeactiveerd(tekst: string) { deactiveerOpen.value = false; infoOpen.value = false; toast.toon(tekst); await ververs() }
async function heractiveer() {
  heractiveerBezig.value = true
  try { await $fetch(`/api/accounts/${a.value.id}/heractiveren`, { method: 'POST' }); toast.toon(`${a.value.naam} is weer actief.`); await ververs() } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { heractiveerBezig.value = false }
}
const SOORT: Record<string, string> = { gebeld: 'Gebeld', mail: 'Mail', notitie: 'Notitie', bericht: 'Bericht', linkedin: 'LinkedIn', afspraak: 'Afspraak', bezoek: 'Bezoek', 'account verwijderd': 'Verwijderd', gedeactiveerd: 'Gedeactiveerd', geheractiveerd: 'Heractiveerd', reis: 'Reis', import: 'Import' }
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
const schermklasse = useSchermklasse()
const telefoon = computed(() => schermklasse.value === 'telefoon')
const kanOverdragen = computed(() => !!a.value?.kanOverdragen && !!functie('overdracht.basis')?.beschikbaar)
const aantalContacten = computed(() => a.value?.contacten.filter((c: any) => c.status !== 'vertrokken').length ?? 0)

// Meer: korte kaders die elk hun eigen venster openen.
const meerOpen = ref(false)
const dossierOpen = ref(false)
const kwalificatieOpen = ref(false)
const reisOpen = ref(false)
const campagnesOpen = ref(false)
const accountplanOpen = ref(false)
const metAccountplan = computed(() => !!functie('nav.accountplannen')?.beschikbaar)
// Het lopende accountplan voor de regel in Meer (alleen met de functie Accountplannen).
const { data: plannen } = useLazyFetch<any>('/api/accountplannen', { query: { accountId: route.params.id }, server: false, immediate: metAccountplan.value, default: () => ({ plannen: [] }) })
const lopendPlan = computed(() => plannen.value?.plannen?.find((p: any) => p.weergave === 'actueel') ?? plannen.value?.plannen?.[0] ?? null)
const belscriptOpen = ref(false)
const datumKortJaar = (d: string | null | undefined) => (d ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' }).format(new Date(d)).replace('.', '') : '')
const bandJa = computed(() => ['behoefte', 'autoriteit', 'noodzaak', 'draagvlak'].filter((k) => a.value?.band?.[k]?.ja).length)
const kaders = computed<MeerKader[]>(() => {
  const x = a.value
  const k: MeerKader[] = []
  if (kanOverdragen.value) k.push({ id: 'overdragen', titel: 'Overdragen', tekst: 'Draag dit account over na de eerste afspraak', icoon: 'ArrowRight', test: 'overdragen-knop', accent: true })
  k.push({ id: 'briefing', titel: 'Briefing', tekst: 'Wat je moet weten voor je volgende contact', icoon: 'FileText', test: 'briefing-knop' })
  if (functie('prospects.volgen')?.beschikbaar) k.push({ id: 'volgen', titel: 'Volgen', tekst: 'Volgende beste stap en opvolgreeks', icoon: 'Route', test: 'knop-volgen' })
  k.push({ id: 'invloed', titel: 'Invloed', tekst: `Wie beslist en wie beïnvloedt · ${aantalContacten.value} ${aantalContacten.value === 1 ? 'contact' : 'contacten'}`, icoon: 'Network', test: 'knop-invloed' })
  if (functie('belscript.kiezen')?.beschikbaar) k.push({ id: 'belscript', titel: 'Belscript', tekst: 'Het script voor je volgende gesprek', icoon: 'ScrollText', test: 'meer-belscript' })
  k.push({ id: 'dossier', titel: 'Dossier', tekst: x.dossier?.op ? `Wat de Verrijker vond · ververst ${datumKortJaar(x.dossier.op)}` : 'Nog geen dossier', icoon: 'Database', test: 'meer-dossier' })
  k.push({ id: 'kwalificatie', titel: 'Kwalificatie', tekst: `BAND ${bandJa.value} van 4 · buying committee`, icoon: 'ClipboardCheck', test: 'meer-kwalificatie' })
  k.push({ id: 'reis', titel: 'Reis', tekst: x.terugkom?.tekst ?? (x.reis ? `${x.reis.naam} · ${x.reis.fase?.label ?? ''} · ${STATUS_LABEL[x.status] ?? x.status}` : x.soort === 'klant' ? 'Klanten lopen geen prospectreis' : 'Nog geen reis'), icoon: 'Compass', test: 'meer-reis' })
  const nCamp = t.value.campagnes.length
  k.push({ id: 'campagnes', titel: 'Campagnes', tekst: nCamp ? `Loopt mee in ${nCamp} ${nCamp === 1 ? 'campagne' : 'campagnes'}` : 'Loopt in geen campagne mee', icoon: 'Megaphone', test: 'meer-campagnes' })
  if (metAccountplan.value) k.push({ id: 'accountplan', titel: 'Accountplan', tekst: lopendPlan.value ? `${lopendPlan.value.titel} · ${lopendPlan.value.acties?.klaar ?? 0} van ${lopendPlan.value.acties?.totaal ?? 0} acties klaar` : 'Nog geen accountplan', icoon: 'Target', test: 'meer-accountplan' })
  if (kanKlaarzetten.value) k.push({ id: 'klaarzetten', titel: 'Klaarzetten', tekst: 'Zet klaar voor de regiodag van een collega', icoon: 'MapPin', test: 'klaarzetten-knop' })
  if (telefoon.value && functie('contact.visitekaartje')?.beschikbaar) k.push({ id: 'visitekaartje', titel: 'Scan visitekaartje', tekst: 'Maak een contact van een foto', icoon: 'Camera', test: 'scan-visitekaartje' })
  if (telefoon.value && !inPakket.value && functie('onderweg.dagpakket')?.beschikbaar) k.push({ id: 'offline', titel: 'Bewaar voor offline', tekst: 'Neem dit account mee zonder verbinding', icoon: 'Download', test: 'bewaar-offline' })
  if (x.kan.deactiveren) k.push({ id: 'deactiveren', titel: 'Deactiveren', tekst: 'Haal het account uit de motor, met een reden', icoon: 'Archive', test: 'deactiveer-knop' })
  return k
})
const OPEN: Record<string, Ref<boolean>> = { info: infoOpen, briefing: briefingOpen, volgen: volgenOpen, invloed: invloedOpen, belscript: belscriptOpen, dossier: dossierOpen, kwalificatie: kwalificatieOpen, reis: reisOpen, campagnes: campagnesOpen, accountplan: accountplanOpen, klaarzetten: klaarOpen, overdragen: overdragenOpen, visitekaartje: kaartjeOpen, deactiveren: deactiveerOpen }
// Een venster dat vanuit Meer opent, heeft "Meer" terug in de kop (FlyoutShell); Escape gaat ook terug.
const meerTerug = maakMeerTerug(() => { meerOpen.value = true })
function kies(id: string, uitMeer = true) {
  meerOpen.value = false
  if (id === 'offline') { bewaarOffline(); return }
  const r = OPEN[id]
  if (!r) return
  if (uitMeer) meerTerug.markeer()
  r.value = true
}
// ?meer=<id> opent een venster direct (bijvoorbeeld vanaf de contactkaart). Oude links: ?meer=ritme opent Reis
// (Zet nee, Pauzeer, Terugkomdatum staan daar), ?tab=kwalificatie, ?tab=campagnes en ?tab=accountplan hun venster.
const OUDE_TAB: Record<string, string> = { kwalificatie: 'kwalificatie', campagnes: 'campagnes', accountplan: 'accountplan' }
onMounted(() => {
  let q = route.query.meer ?? (typeof route.query.tab === 'string' ? OUDE_TAB[route.query.tab] ?? null : null)
  if (q === 'ritme') q = 'reis'
  if (q === 'info') { infoOpen.value = true; return }
  if (typeof q === 'string' && kaders.value.some((x) => x.id === q)) kies(q, false)
})
// Een knop voor het ritme (in het venster Reis) opent zijn eigen venster; Reis gaat dan dicht.
function ritmeActie(soort: 'nee' | 'pauzeer' | 'verplaats' | 'fase' | 'terugop') {
  reisOpen.value = false
  if (soort === 'nee') neeOpen.value = true
  else handeling.value = soort
}

// Kop: logovlak met initialen in een vaste kleur per naam; klasse, fase en status als label (shared/labels.ts).
const MERK = ['#194c8f', '#1e7c4a', '#c0392b', '#4c1d95', '#b45309', '#0a0a0a', '#0f766e']
const initialen = computed(() => a.value.naam.replace(/^(Test)(?=[A-Z])/, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase())
const merkKleur = computed(() => MERK[[...a.value.naam].reduce((s: number, c: string) => s + c.charCodeAt(0), 0) % MERK.length])
const klasseNaam = computed(() => a.value.klassen.find((k: any) => k.id === a.value.klasse)?.naam ?? klasseKort(a.value.klasse, a.value.klassen))
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
    <!-- 0064: gedeactiveerd. De historie blijft leesbaar; heractiveren voor wie mag. -->
    <div v-if="a.gedeactiveerd" class="ak-gedeactiveerd" role="status" data-test="gedeactiveerd-balk">
      <div class="container ak-gedeactiveerd-binnen">
        <Icoon naam="Archive" :grootte="18" class="ak-gedeactiveerd-icoon" />
        <p class="ak-gedeactiveerd-tekst"><strong>{{ a.gedeactiveerd.tekst }}.</strong> <span>De motor zet hier niets meer klaar; alles wat er gebeurde blijft hieronder te lezen.</span></p>
        <button v-if="a.kan.heractiveren" type="button" class="dd-actie dd-actie--secundair ak-gedeactiveerd-knop" :disabled="heractiveerBezig" data-test="heractiveer-knop" @click="heractiveer"><Icoon naam="RefreshCw" class="dd-actie-icoon" />Heractiveren</button>
      </div>
    </div>
    <!-- Kop -->
    <header class="ak-kop">
      <div class="container">
        <div class="ak-kop-binnen">
          <AccountLogo class="ak-merk" :naam="a.naam" :initialen="initialen" :kleur="merkKleur ?? 'var(--ink)'" :logo-url="a.logoUrl" :website="a.website" :domein="a.domein" :logo-uit="a.logoUit" :grootte="logoMaat" />
          <div class="ak-kop-info">
            <NuxtLink :to="a.soort === 'klant' ? '/klanten' : '/prospects/alle'" class="ak-kruimel"><Icoon naam="ArrowLeft" :grootte="12" /> {{ a.soort === 'klant' ? 'Bestaande klanten' : 'Alle prospects' }}</NuxtLink>
            <p class="ak-eyebrow"><span v-for="(c, i) in [a.branche, a.plaats, a.land, a.vvBranche?.naam].filter(Boolean)" :key="i"><template v-if="i"> · </template>{{ c }}</span></p>
            <h1 class="ak-titel" data-test="account-naam">{{ a.naam }}
              <span v-if="a.kan.klasse" class="lbl-kies"><Label soort="klasse" :waarde="a.klasse ? klasseNaam : null" data-test="klasse-label" /><Icoon naam="ChevronDown" :grootte="12" /><select :value="a.klasse ?? ''" aria-label="Klasse" data-test="klasse" @change="zetKlasse(($event.target as HTMLSelectElement).value)">
                <option value="">Geen klasse</option><option v-for="k in a.klassen" :key="k.id" :value="k.id" :title="k.naam">{{ k.naam }}</option>
              </select></span>
              <Label v-else soort="klasse" :waarde="a.klasse ? klasseNaam : null" data-test="klasse-label" />
            </h1>
            <div class="ak-pillen">
              <Label v-if="a.reis?.fase" soort="fase" :waarde="a.reis.fase.hoofdfase" :tekst="a.reis.fase.label" knop :uit="!a.kan.geschiedenis" :titel="a.kan.geschiedenis ? `Fase ${a.reis.fase.label}. Open de reisgeschiedenis` : undefined" data-test="fasepil" @click="openFase" />
              <Label soort="status" :waarde="a.status" data-test="statuspil" />
              <Label v-if="a.dagenInFase !== null && a.reis && a.reis.fase?.overschreden" soort="status" waarde="te-lang-in-fase" :tekst="`${a.dagenInFase} d in fase`" titel="Langer in deze fase dan verwacht" data-test="dagen-in-fase" />
              <span v-else-if="a.dagenInFase !== null && a.reis" class="meta" data-test="dagen-in-fase">{{ a.dagenInFase }} dagen in fase</span>
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
            <KopIconen zonder-hulp :ai="{ accountId: a.id, label: a.naam }" />
            <button type="button" class="dd-actie dd-actie--secundair" data-test="contacten-knop" @click="contactenOpen = true"><Icoon naam="Users" class="dd-actie-icoon" />Contacten<span v-if="aantalContacten" class="ak-teller tnum">{{ aantalContacten }}</span></button>
            <button type="button" class="dd-actie dd-actie--secundair" aria-haspopup="dialog" :aria-expanded="infoOpen" title="Bedrijfsgegevens, leverancier en eigen velden" data-test="info-knop" @click="infoOpen = true"><Icoon naam="Info" class="dd-actie-icoon" />Info</button>
            <button type="button" class="dd-actie dd-actie--secundair" aria-haspopup="dialog" :aria-expanded="meerOpen" data-test="kop-meer" @click="meerOpen = true"><Icoon naam="Ellipsis" class="dd-actie-icoon" />Meer</button>
          </div>
        </div>

        <!-- Telefoon: compacte kaart (8.5.5): terugkomdatum, Pitstop, contacten, laatste momenten. -->
        <div class="ak-mobiel mt-16" data-test="compacte-kaart">
          <p v-if="a.terugkom" class="reis-terug" data-test="terug-op-mobiel">{{ a.terugkom.tekst }}</p>
          <div v-if="functie('briefing.lezen')?.beschikbaar" class="kaart mt-8" data-test="pitstop-compact"><span class="fo-blok-kicker">Pitstop</span><BriefingPaneel onderwerp="account" :id="a.id" ingeklapt /></div>
          <ul class="schakel-lijst kaart">
            <li v-for="c in a.contacten.filter((x: any) => x.status !== 'vertrokken')" :key="c.id" class="schakel-rij">
              <span><strong>{{ c.naam }}</strong><br><span class="meta">{{ CONTACTROL_LABEL[c.rol as ContactRol] }}</span></span>
              <a v-if="(c.mobiel || c.telefoon) && !c.belMeNiet" class="dd-act" :href="telLink(c.mobiel ?? c.telefoon)" :aria-label="`Bel ${c.naam}`"><Icoon naam="Phone" class="dd-act-icoon" />Bel</a>
            </li>
            <li v-if="!a.contacten.length" class="schakel-rij"><span class="meta">Geen contactpersoon</span></li>
          </ul>
          <ul v-if="momenten.length" class="schakel-lijst kaart mt-8"><li v-for="x in momenten" :key="x.id" class="schakel-rij"><span>{{ berichtKanaalLabel(x.soort, x.kanaal) ?? SOORT[x.soort] ?? x.soort }}<template v-if="x.uitkomst"> · {{ x.uitkomst }}</template></span><span class="meta">{{ datumKort(x.op) }}</span></li></ul>
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

    <!-- Overdracht -->
    <section v-if="a.overdracht" class="ak-sectie ak-sectie--wit">
      <div class="container stapel">
        <div v-if="a.overdracht" class="kaart ov-stand" :class="{ 'kaart--geel': a.overdracht.status === 'mislukt' }" data-test="overdracht-regel">
          <span>Overgedragen aan {{ OV_NAAR[a.overdracht.naar] }} op {{ new Date(a.overdracht.op).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' }) }} · {{ a.overdracht.door }}<template v-if="a.overdracht.dealdrive?.eigenaar"> · in DealDrive bij {{ a.overdracht.dealdrive.eigenaar }}</template></span>
          <Label soort="overdracht" :waarde="a.overdracht.status" data-test="overdracht-pil" />
          <Label v-if="a.overdracht.dealdrive?.gewonnenOp" soort="overdracht" waarde="gewonnen" data-test="gewonnen-na-overdracht" />
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
    <KaartTabbladen :account="{ id: a.id, naam: a.naam, soort: a.soort }" :tabbladen="t" :mail-aan="primair?.email ? primair.naam : null" :kan-overdragen="a.kanOverdragen" @ververs="ververs" @overdragen="overdragenOpen = true" />

    <!-- Telefoon: plakkende actiebalk (8.5.5). -->
    <div class="actiebalk" data-test="actiebalk">
      <a class="actiebalk-knop" :class="{ 'actiebalk-knop--uit': !belNummer }" :href="belNummer ? telLink(belNummer) : undefined" :aria-disabled="!belNummer" :title="belNummer ? undefined : 'Geen telefoonnummer'" data-test="ab-bellen"><Icoon naam="Phone" />Bellen</a>
      <a class="actiebalk-knop" :class="{ 'actiebalk-knop--uit': !mailAdres }" :href="mailAdres ? `mailto:${mailAdres}` : undefined" :aria-disabled="!mailAdres" :title="mailAdres ? undefined : 'Geen e-mailadres'"><Icoon naam="Mail" />Mail</a>
      <a class="actiebalk-knop" :class="{ 'actiebalk-knop--uit': !whatsapp }" :href="whatsapp ? `https://wa.me/${whatsapp.replace('+', '')}` : undefined" :aria-disabled="!whatsapp" :title="whatsapp ? undefined : 'Geen toestemming voor WhatsApp'"><Icoon naam="MessageCircle" />WhatsApp</a>
      <a class="actiebalk-knop" :class="{ 'actiebalk-knop--uit': !navigeer }" :href="navigeer ?? undefined" :aria-disabled="!navigeer" :title="navigeer ? undefined : 'Geen adres'" target="_blank" rel="noopener"><Icoon naam="Navigation" />Navigeer</a>
    </div>

    <MeerFlyout :open="meerOpen" :onderwerp="a.naam" :kaders="kaders" @sluit="meerOpen = false" @kies="kies" />
    <KaartFlyout :open="dossierOpen" kicker="Dossier" :titel="a.naam" meta="Wat de Verrijker en de andere agents over dit account vonden." test="dossier-flyout" maat="breed" @sluit="dossierOpen = false">
      <AgentBlokken :account="a" @gewijzigd="refresh" />
    </KaartFlyout>
    <KaartFlyout :open="kwalificatieOpen" kicker="Kwalificatie" :titel="a.naam" meta="BAND en het buying committee van dit account." test="kwalificatie-flyout" maat="breed" @sluit="kwalificatieOpen = false">
      <KwalificatieBlokken :account="a" @gewijzigd="ververs" />
    </KaartFlyout>
    <KaartFlyout :open="reisOpen" kicker="Reis" :titel="a.naam" meta="De prospectreis van dit account, het ritme en elke fasewissel." test="reis-flyout" :account-id="a.id" @sluit="reisOpen = false">
      <ReisOverzicht :account="a" />
      <!-- Het ritme (was het venster Ritme): Zet nee, Pauzeer, Verplaats, Fase corrigeren en Terugkomdatum. -->
      <article v-if="a.kan.reis" class="kaart" data-test="ritme">
        <header class="kaart-kop"><h2 class="kaart-titel">Ritme</h2></header>
        <p class="kaart-meta">Zet het account op nee, pauzeer het of kies wanneer het terugkomt.</p>
        <div class="reis-knoppen mt-16">
          <button v-if="a.kan.nee" type="button" class="dd-act" data-test="zet-nee-knop" @click="ritmeActie('nee')">Zet nee</button>
          <button v-if="a.kan.pauzeer" type="button" class="dd-act" data-test="pauzeer-knop" @click="ritmeActie('pauzeer')">Pauzeer tot</button>
          <button v-if="a.kan.verplaatsen" type="button" class="dd-act" data-test="verplaats-knop" @click="ritmeActie('verplaats')">Verplaats naar reis</button>
          <button v-if="a.kan.faseCorrigeren && a.reis" type="button" class="dd-act" data-test="fase-corrigeren-knop" @click="ritmeActie('fase')">Fase corrigeren</button>
          <button v-if="a.kan.terugOp" type="button" class="dd-act" data-test="terugop-knop" @click="ritmeActie('terugop')">Terugkomdatum</button>
        </div>
        <p v-if="!a.kan.nee && !a.kan.pauzeer && !a.kan.verplaatsen && !a.kan.faseCorrigeren && !a.kan.terugOp" class="meta mt-8">Er is nu niets aan het ritme te veranderen.</p>
      </article>
    </KaartFlyout>
    <KaartFlyout :open="campagnesOpen" kicker="Campagnes" :titel="a.naam" meta="De campagnes waarin dit account meeloopt." test="campagnes-flyout" :account-id="a.id" @sluit="campagnesOpen = false">
      <KaartCampagnes :campagnes="t.campagnes" />
    </KaartFlyout>
    <KaartFlyout v-if="metAccountplan" :open="accountplanOpen" kicker="Accountplan" :titel="a.naam" meta="Het lopende accountplan met samenvatting, acties en voortgang." test="accountplan-flyout" maat="breed" :account-id="a.id" @sluit="accountplanOpen = false">
      <AccountplanTab :account="{ id: a.id, naam: a.naam, soort: a.soort }" in-flyout />
    </KaartFlyout>
    <BelscriptFlyout v-if="functie('belscript.kiezen')?.beschikbaar" :open="belscriptOpen" :account-id="a.id" :naam="a.naam" @sluit="belscriptOpen = false" />
    <ReisgeschiedenisFlyout v-if="a.kan.geschiedenis" :open="geschiedenisOpen" :account-id="a.id" :naam="a.naam" @sluit="geschiedenisOpen = false" />
    <ZetNeeFlyout v-if="a.kan.nee" :open="neeOpen" :account="{ id: a.id, naam: a.naam }" :concurrenten="a.concurrenten" @sluit="neeOpen = false" @klaar="klaar" />
    <ReisHandelingFlyout v-if="handeling" :open="!!handeling" :soort="handeling" :account="a" @sluit="handeling = null" @klaar="klaar" />
    <InfoFlyout :open="infoOpen" :account="a" @sluit="infoOpen = false" @gewijzigd="refresh" @deactiveer="deactiveerOpen = true" />
    <ContactenFlyout :open="contactenOpen" :account="{ id: a.id, naam: a.naam }" :contacten="a.contacten" @sluit="contactenOpen = false" @gewijzigd="refresh" />
    <BriefingFlyout :open="briefingOpen" :account="{ id: a.id, naam: a.naam }" @sluit="briefingOpen = false" />
    <VolgenFlyout v-if="functie('prospects.volgen')?.beschikbaar" :open="volgenOpen" :account-id="a.id" :naam="a.naam" @sluit="volgenOpen = false" @gewijzigd="ververs" />
    <InvloedFlyout :open="invloedOpen" :account-id="a.id" @sluit="invloedOpen = false" @gewijzigd="refresh" />
    <DeactiveerFlyout v-if="a.kan.deactiveren" :open="deactiveerOpen" :account="{ id: a.id, naam: a.naam }" @sluit="deactiveerOpen = false" @klaar="gedeactiveerd" />
    <VisitekaartjeVenster :open="kaartjeOpen" :account="a ? { id: a.id, naam: a.naam } : null" @sluit="kaartjeOpen = false" @bewaard="refresh()" />
    <KlaarzetFlyout :open="klaarOpen" :account="a ? { id: a.id, naam: a.naam } : null" @sluit="klaarOpen = false" />
    <OverdrachtVenster :open="overdragenOpen" :account-id="a?.id ?? null" :account-naam="a?.naam ?? ''" @sluit="overdragenOpen = false" @overgedragen="ververs()" />
  </div>
  <OfflineAccount v-else :id="String(route.params.id)" />
</template>

<style scoped>
/* 0064: balk bij een gedeactiveerde prospect, boven de kop. */
.ak-gedeactiveerd { background: var(--surface); border-bottom: 1px solid var(--border-strong); padding: 12px 0; }
.ak-gedeactiveerd-binnen { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.ak-gedeactiveerd-icoon { flex: none; color: var(--muted); }
.ak-gedeactiveerd-tekst { flex: 1 1 280px; margin: 0; font-size: 14px; }
.ak-gedeactiveerd-tekst span { color: var(--muted); }
.ak-gedeactiveerd-knop { flex: none; }
/* Kop (opzet uit DealDrive: klant-header) */
.ak-kop { padding: 28px 0; background: var(--wit); border-bottom: 1px solid var(--border); }
.ak-kop-binnen { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 18px; align-items: start; }
@media (min-width: 1000px) { .ak-kop-binnen { grid-template-columns: auto minmax(0, 1fr) auto; } }
.ak-merk { margin-top: 22px; }
.ak-kruimel { display: inline-flex; align-items: center; gap: 4px; margin-bottom: 6px; font-size: 12px; font-weight: 600; color: var(--muted); text-decoration: none; }
.ak-kruimel:hover { color: var(--ink); }
.ak-eyebrow { margin: 0; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: var(--muted); }
.ak-titel { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; margin: 4px 0 0; font-family: var(--font-serif); font-size: clamp(28px, 4vw, 40px); font-weight: 700; line-height: 1.1; letter-spacing: -0.02em; color: var(--ink); }
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
@media (min-width: 1000px) { .ak-acties { grid-column: auto; justify-content: flex-end; max-width: 660px; margin-top: 22px; } }
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

.mt-24 { margin-top: 24px; }
@media (max-width: 719px) {
  .ak-kop { padding: 20px 0; }
  .ak-merk { margin-top: 20px; }
}
/* Telefoon: Contacten, Info en Meer op één regel (zoeken en AI staan in de mobiele kop). */
@media (max-width: 767px) { .ak-acties { gap: 6px; } .ak-acties :deep(.dd-actie:not(.dd-actie--icoon)) { gap: 6px; padding-left: 10px; padding-right: 10px; } }
</style>
