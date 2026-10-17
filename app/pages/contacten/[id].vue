<script setup lang="ts">
// Contactkaart (F04) in de opzet van DealDrive: kop met avatar en rol, kruimel, functie en account (link),
// naam met rollabel, contactgegevens (mail, telefoon, mobiel, LinkedIn), de stuurstrip van het account en rechts
// Zoeken, Vraag AI, Info en Meer. Meer opent een venster met korte kaders (Briefing, Volgen, Invloed, Belscript,
// Dossier, Kwalificatie, Reis, Campagnes, Accountplan als het contact in een plan staat, en Klaarzetten) die elk
// hun eigen venster openen, met "Meer" terug in de kop; ?meer=<id> opent er direct een. Dossier, Kwalificatie en
// Reis tonen de stand van het account. Bellen gaat via het nummer in de kop. Daaronder de statstrook en
// dezelfde tabbladen als de accountkaart (KaartTabbladen), met alleen wat bij dit contact hoort; eigen velden
// staan in het Info-venster. De avatar toont de foto van het contact (uploaden, wijzigen en verwijderen via het
// potlood), anders de initialen. Op de telefoon een plakkende actiebalk.
import { CONTACTROL_LABEL, ROLLEN_CONTACT, type ContactRol } from '~~/shared/contactgegevens'
import type { Ref } from 'vue'
import type { MeerKader } from '~/components/account/MeerFlyout.vue'
import { STATUS_LABEL, initialen, telLink, toonTelefoon } from '~/utils/accountWeergave'
const route = useRoute()
const toast = useToast()
const { functie, me } = useMe()
if (!functie('contacten.basis')?.beschikbaar) throw createError({ statusCode: 403, statusMessage: 'Geen toegang' })
const leeg = { taken: [], inzichten: [], afspraken: [], mails: [], verslagen: [], deals: [], gebeurtenissen: [], campagnes: [], documenten: [], momenten: [] }
const [{ data: c, refresh }, { data: t, refresh: refreshTabs }] = await Promise.all([
  useFetch<any>(() => `/api/contacten/${route.params.id}`),
  useFetch<any>(() => `/api/contacten/${route.params.id}/tabbladen`, { default: () => leeg }),
])
if (!c.value) throw createError({ statusCode: 404, statusMessage: 'Contact onbekend' })
// De stand van het account (stuurstrip, eigenaar, reis en kwalificatie, deals); zonder recht blijft dit leeg.
const { data: a, refresh: refreshAccount } = await useFetch<any>(() => `/api/accounts/${c.value?.accountId}`, { default: () => null })
async function ververs() { await Promise.all([refresh(), refreshTabs(), refreshAccount()]) }
async function wijzig(patch: Record<string, unknown>) {
  try { await $fetch(`/api/contacten/${c.value.id}`, { method: 'PUT', body: patch }); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
useHead({ title: computed(() => `${c.value?.naam ?? 'Contact'} · Dealtrace`) })
const infoOpen = ref(false)
const fotoOpen = ref(false)
const fotoMislukt = ref(false)
async function fotoGewijzigd() { fotoOpen.value = false; fotoMislukt.value = false; await refresh() }
const briefingOpen = ref(false)
// F2 en F7: Volgen; de volgende stap gaat over dit contact binnen zijn account.
const volgenOpen = ref(false)
// F8: de invloedskaart van het account, met dit contact geselecteerd.
const invloedOpen = ref(false)
// Meer: korte kaders die elk hun eigen venster openen. Bellen gaat via het nummer in de kop en op de telefoon via de actiebalk.
const meerOpen = ref(false)
const belscriptOpen = ref(false)
const dossierOpen = ref(false)
const kwalificatieOpen = ref(false)
const reisOpen = ref(false)
const klaarOpen = ref(false)
const campagnesOpen = ref(false)
const accountplanOpen = ref(false)
// De accountplannen waarin dit contact staat (als contactpersoon of met een actie); zonder de functie een lege lijst.
const { data: plannen } = useLazyFetch<any>(() => `/api/contacten/${route.params.id}/accountplannen`, { server: false, default: () => ({ plannen: [] }) })
const contactPlannen = computed<any[]>(() => plannen.value?.plannen ?? [])
const kanKlaarzetten = computed(() => !!functie('bezoeken.klaarzetten')?.beschikbaar && me.value?.gebruiker.werkplek !== 'buitendienst')
const datumKort = (d: string | null | undefined) => (d ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' }).format(new Date(d)).replace('.', '') : '')
const kaders = computed<MeerKader[]>(() => {
  const k: MeerKader[] = []
  const x = a.value
  if (c.value?.account) {
    k.push({ id: 'briefing', titel: 'Briefing', tekst: `Wat je moet weten over ${c.value.account.naam}`, icoon: 'FileText', test: 'briefing-knop' })
    if (functie('prospects.volgen')?.beschikbaar) k.push({ id: 'volgen', titel: 'Volgen', tekst: `Volgende beste stap met ${roepnaam.value}`, icoon: 'Route', test: 'knop-volgen' })
    k.push({ id: 'invloed', titel: 'Invloed', tekst: `${roepnaam.value} op de invloedskaart`, icoon: 'Network', test: 'knop-invloed' })
    if (functie('belscript.kiezen')?.beschikbaar) k.push({ id: 'belscript', titel: 'Belscript', tekst: `Het script voor je gesprek met ${roepnaam.value}`, icoon: 'ScrollText', test: 'meer-belscript' })
  }
  if (x) {
    k.push({ id: 'dossier', titel: 'Dossier', tekst: x.dossier?.op ? `Wat de Verrijker vond · ververst ${datumKort(x.dossier.op)}` : 'Nog geen dossier', icoon: 'Database', test: 'meer-dossier' })
    k.push({ id: 'kwalificatie', titel: 'Kwalificatie', tekst: `BAND ${band.value} van 4 · rol ${CONTACTROL_LABEL[c.value.rol as ContactRol] ?? c.value.rol}`, icoon: 'ClipboardCheck', test: 'meer-kwalificatie' })
    k.push({ id: 'reis', titel: 'Reis', tekst: x.reis ? `${x.reis.naam} · ${x.reis.fase?.label ?? ''} · ${STATUS_LABEL[x.status] ?? x.status}` : x.soort === 'klant' ? 'Klanten lopen geen prospectreis' : 'Nog geen reis', icoon: 'Compass', test: 'meer-reis' })
  }
  const nCamp = t.value.campagnes.length
  k.push({ id: 'campagnes', titel: 'Campagnes', tekst: nCamp ? `${roepnaam.value} in ${nCamp} ${nCamp === 1 ? 'campagne' : 'campagnes'}` : 'In geen campagne', icoon: 'Megaphone', test: 'meer-campagnes' })
  const p = contactPlannen.value[0]
  if (p) k.push({ id: 'accountplan', titel: 'Accountplan', tekst: contactPlannen.value.length > 1 ? `${p.titel} en ${contactPlannen.value.length - 1} meer` : `${p.titel} · ${p.voortgang.klaar} van ${p.voortgang.totaal} acties klaar`, icoon: 'Target', test: 'meer-accountplan' })
  if (c.value?.account && kanKlaarzetten.value) k.push({ id: 'klaarzetten', titel: 'Klaarzetten', tekst: 'Zet klaar voor de regiodag van een collega', icoon: 'MapPin', test: 'klaarzetten-knop' })
  return k
})
const OPEN: Record<string, Ref<boolean>> = { info: infoOpen, briefing: briefingOpen, volgen: volgenOpen, invloed: invloedOpen, belscript: belscriptOpen, dossier: dossierOpen, kwalificatie: kwalificatieOpen, reis: reisOpen, campagnes: campagnesOpen, accountplan: accountplanOpen, klaarzetten: klaarOpen }
// Een venster dat vanuit Meer opent, heeft "Meer" terug in de kop (FlyoutShell); Escape gaat ook terug.
const meerTerug = maakMeerTerug(() => { meerOpen.value = true })
function kies(id: string, uitMeer = true) { meerOpen.value = false; const r = OPEN[id]; if (!r) return; if (uitMeer) meerTerug.markeer(); r.value = true }
// ?meer=<id> opent een venster direct; ?meer=info het Info-venster en het oude ?tab=campagnes het venster Campagnes.
onMounted(() => {
  const q = route.query.meer ?? (route.query.tab === 'campagnes' ? 'campagnes' : null)
  if (q === 'info') { infoOpen.value = true; return }
  if (typeof q === 'string' && kaders.value.some((x) => x.id === q && !x.href)) kies(q, false)
})
// Het accountplan-kader komt pas na het laden van de plannen; ?meer=accountplan wacht daarop.
watch(contactPlannen, (l) => { if (l.length && route.query.meer === 'accountplan' && !accountplanOpen.value) kies('accountplan', false) })

// Kop: avatar met initialen in een vaste kleur per naam, de rol als label met eigen icoon (kies via de keuzelijst eronder).
const KLEUR = ['#194c8f', '#1e7c4a', '#c0392b', '#4c1d95', '#b45309', '#0a0a0a', '#0f766e']
const kleur = computed(() => KLEUR[[...c.value.naam].reduce((s: number, x: string) => s + x.charCodeAt(0), 0) % KLEUR.length])
const roepnaam = computed(() => c.value.voornaam || c.value.naam)
const belNummer = computed(() => (c.value.belMeNiet ? null : c.value.mobiel ?? c.value.telefoon ?? null))
const whatsapp = computed(() => (c.value.consent?.whatsapp?.status === 'ja' ? c.value.mobiel ?? null : null))
const linkedinUrl = computed(() => (c.value.linkedin ? (/^https?:\/\//.test(c.value.linkedin) ? c.value.linkedin : `https://${c.value.linkedin}`) : null))
const datumLang = (d: string | null | undefined) => (d ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Amsterdam' }).format(new Date(d)).replace('.', '') : '–')

// Statstrook (opzet uit DealDrive): per persoon, met deals en eigenaar van het account.
const openTaken = computed(() => t.value.taken.filter((x: any) => ['open', 'bezig'].includes(x.status)))
const achterstallig = computed(() => openTaken.value.filter((x: any) => x.achterstallig).length)
const nieuweInzichten = computed(() => t.value.inzichten.filter((x: any) => x.status === 'nieuw').length)
const komend = computed(() => t.value.afspraken.filter((x: any) => x.status === 'gepland' && Date.parse(x.start) > Date.now()).length)
const openDeals = computed(() => t.value.deals.filter((d: any) => !['gewonnen', 'verloren', 'mislukt'].includes(d.fase)).length)
const laatsteContact = computed(() => {
  const d = (t.value.momenten ?? []).find((m: any) => m.soort !== 'notitie')?.op
  if (!d) return 'nog nooit'
  const dagen = Math.floor((Date.now() - Date.parse(d)) / 864e5)
  return dagen < 1 ? 'vandaag' : dagen < 31 ? `${dagen} ${dagen === 1 ? 'dag' : 'dagen'}` : `${Math.floor(dagen / 30)} mnd`
})
const band = computed(() => (a.value?.band ? Object.values(a.value.band).filter((b: any) => b?.ja).length : 0))
</script>

<template>
  <div v-if="c" class="accountkaart contactkaart">
    <!-- Kop -->
    <header class="ck-kop">
      <div class="container">
        <NuxtLink to="/contacten/alle" class="ck-kruimel" data-test="kruimel"><Icoon naam="ArrowLeft" :grootte="12" /> Alle contacten</NuxtLink>
        <div class="ck-kop-binnen">
          <div class="ck-avatar" :class="{ 'ck-avatar--foto': c.fotoUrl && !fotoMislukt }" :style="{ background: kleur }" data-test="contact-avatar">
            <img v-if="c.fotoUrl && !fotoMislukt" :src="c.fotoUrl" :alt="`Foto van ${c.naam}`" class="ck-foto" data-test="contact-foto" @error="fotoMislukt = true">
            <span v-else class="ck-initialen" aria-hidden="true">{{ initialen(c.naam) }}</span>
            <button type="button" class="ck-foto-potlood" :aria-label="c.fotoUrl ? 'Foto wijzigen' : 'Foto uploaden'" :aria-expanded="fotoOpen" data-test="contact-foto-potlood" @click="fotoOpen = !fotoOpen"><Icoon naam="Pencil" :grootte="14" /></button>
            <div v-if="fotoOpen" class="ck-foto-paneel" data-test="contact-foto-paneel">
              <p class="ck-foto-titel">Foto van {{ roepnaam }}</p>
              <p class="ck-foto-uitleg">Een jpg of png; we verkleinen hem tot 256 px.</p>
              <ContactFotoKnoppen :contact-id="c.id" :foto-url="c.fotoUrl" @gewijzigd="fotoGewijzigd" />
              <button type="button" class="dd-act ck-foto-sluit" @click="fotoOpen = false">Sluiten</button>
            </div>
          </div>
          <div class="ck-info">
            <p class="ck-eyebrow" data-test="contact-functie"><template v-if="c.functie">{{ c.functie }}</template><template v-if="c.functie && c.account"> · </template><NuxtLink v-if="c.account" :to="`/accounts/${c.accountId}`" class="ck-account" data-test="contact-account">{{ c.account.naam }}</NuxtLink></p>
            <h1 class="ck-titel" data-test="contact-naam">{{ c.naam }}
              <span class="lbl-kies ck-rolkies"><Label soort="rol" :waarde="c.rol || 'onbekend'" data-test="contact-rol-label" /><Icoon naam="ChevronDown" :grootte="12" /><select :value="c.rol" aria-label="Rol" data-test="contact-rol" @change="wijzig({ rol: ($event.target as HTMLSelectElement).value })"><option v-for="r in ROLLEN_CONTACT" :key="r" :value="r">{{ CONTACTROL_LABEL[r] }}</option></select></span>
            </h1>
            <div v-if="c.status === 'vertrokken' || c.belMeNiet" class="ck-pillen">
              <Label v-if="c.belMeNiet" soort="urgentie" waarde="bel-me-niet" data-test="bel-me-niet-pil" />
              <Label v-if="c.status === 'vertrokken'" soort="status" waarde="vertrokken" :tekst="c.vertrokkenOp ? `Vertrokken ${c.vertrokkenOp}` : null" data-test="vertrokken" />
            </div>
            <div class="ck-contactstrip" data-test="contactgegevens">
              <a v-if="c.email" :href="`mailto:${c.email}`"><Icoon naam="Mail" :grootte="14" /> {{ c.email }}</a>
              <a v-if="c.telefoon" :href="c.belMeNiet ? undefined : telLink(c.telefoon)" class="tnum" :class="{ 'ck-uit': c.belMeNiet }"><Icoon naam="Phone" :grootte="14" /> {{ toonTelefoon(c.telefoon) }}</a>
              <a v-if="c.mobiel" :href="c.belMeNiet ? undefined : telLink(c.mobiel)" class="tnum" :class="{ 'ck-uit': c.belMeNiet }"><Icoon naam="Smartphone" :grootte="14" /> {{ toonTelefoon(c.mobiel) }}</a>
              <a v-if="linkedinUrl" :href="linkedinUrl" target="_blank" rel="noopener" class="ck-linkedin"><Icoon naam="Linkedin" :grootte="14" /> LinkedIn <span class="ck-ext">↗</span></a>
              <span v-if="!c.email && !c.telefoon && !c.mobiel && !linkedinUrl" class="meta">Nog geen contactgegevens. Vul ze in bij Info.</span>
            </div>
            <dl v-if="c.account" class="ck-stuurstrip alleen-groot" data-test="stuurstrip">
              <div><dt>Laatste actie</dt><dd class="tnum">{{ datumLang(a?.stuur?.laatsteActie ?? c.account.laatsteContactOp) }}</dd></div>
              <div><dt>Laatste call</dt><dd class="tnum">{{ datumLang(a?.stuur?.laatsteCall ?? c.account.laatsteCall) }}</dd></div>
              <div><dt>Laatste bezoek</dt><dd class="tnum">{{ datumLang(a?.stuur?.laatsteBezoek) }}</dd></div>
              <div v-if="a?.reis"><dt>Fase</dt><dd>{{ a.reis.fase?.label ?? '–' }}</dd></div>
            </dl>
          </div>
          <div class="ck-acties">
            <KopIconen zonder-hulp :ai="{ accountId: c.accountId, label: c.account?.naam ?? c.naam }" />
            <button type="button" class="dd-actie dd-actie--secundair" aria-haspopup="dialog" :aria-expanded="infoOpen" title="Contactgegevens, toestemming en Bel me niet" data-test="contact-info-knop" @click="infoOpen = true"><Icoon naam="Info" class="dd-actie-icoon" />Info</button>
            <button type="button" class="dd-actie dd-actie--secundair" aria-haspopup="dialog" :aria-expanded="meerOpen" data-test="kop-meer" @click="meerOpen = true"><Icoon naam="Ellipsis" class="dd-actie-icoon" />Meer</button>
          </div>
        </div>
      </div>
    </header>

    <!-- Statstrook -->
    <section class="ck-stats" data-test="statstrook">
      <div class="container ck-stat-raster">
        <div class="ck-stat"><span class="ck-stat-label">Open acties</span><span class="ck-stat-num tnum">{{ openTaken.length }}</span><span v-if="achterstallig" class="ck-stat-voet ck-stat-voet--rood">{{ achterstallig }} achterstallig</span></div>
        <div class="ck-stat"><span class="ck-stat-label">Inzichten</span><span class="ck-stat-num tnum">{{ t.inzichten.length }}</span><span v-if="nieuweInzichten" class="ck-stat-voet">{{ nieuweInzichten }} ongezien</span></div>
        <div class="ck-stat"><span class="ck-stat-label">Afspraken</span><span class="ck-stat-num tnum">{{ t.afspraken.length }}</span><span v-if="komend" class="ck-stat-voet">{{ komend }} gepland</span></div>
        <div class="ck-stat"><span class="ck-stat-label">Open deals</span><span class="ck-stat-num tnum">{{ openDeals }}</span><span class="ck-stat-voet">van het account</span></div>
        <div class="ck-stat"><span class="ck-stat-label">Laatste contact</span><span class="ck-stat-tekst">{{ laatsteContact }}</span></div>
        <div class="ck-stat"><span class="ck-stat-label">Eigenaar</span><span class="ck-stat-tekst">{{ a?.eigenaar?.naam?.replace(/^Testgebruiker /, '') ?? 'Niemand' }}</span></div>
      </div>
    </section>

    <!-- Tabbladen: dezelfde als op de accountkaart, voor dit contact. -->
    <KaartTabbladen :account="{ id: c.accountId, naam: c.account?.naam ?? '', soort: a?.soort ?? c.account?.soort ?? null }" :tabbladen="t" :contact="{ id: c.id, naam: c.naam, email: c.email }" @ververs="ververs">
    </KaartTabbladen>

    <!-- Telefoon: plakkende actiebalk. -->
    <div class="actiebalk" data-test="actiebalk">
      <a class="actiebalk-knop" :class="{ 'actiebalk-knop--uit': !belNummer }" :href="belNummer ? telLink(belNummer) : undefined" :aria-disabled="!belNummer" :title="belNummer ? undefined : 'Geen telefoonnummer'" data-test="ab-bellen"><Icoon naam="Phone" />Bellen</a>
      <a class="actiebalk-knop" :class="{ 'actiebalk-knop--uit': !c.email }" :href="c.email ? `mailto:${c.email}` : undefined" :aria-disabled="!c.email" :title="c.email ? undefined : 'Geen e-mailadres'"><Icoon naam="Mail" />Mail</a>
      <a class="actiebalk-knop" :class="{ 'actiebalk-knop--uit': !whatsapp }" :href="whatsapp ? `https://wa.me/${whatsapp.replace('+', '')}` : undefined" :aria-disabled="!whatsapp" :title="whatsapp ? undefined : 'Geen toestemming voor WhatsApp'"><Icoon naam="MessageCircle" />WhatsApp</a>
      <NuxtLink class="actiebalk-knop" :to="`/accounts/${c.accountId}`"><Icoon naam="Building2" />Account</NuxtLink>
    </div>

    <ContactInfoFlyout :open="infoOpen" :contact="c" @sluit="infoOpen = false" @gewijzigd="ververs" />
    <BriefingFlyout v-if="c.account" :open="briefingOpen" :account="{ id: c.accountId, naam: c.account.naam }" @sluit="briefingOpen = false" />
    <VolgenFlyout v-if="c.account && functie('prospects.volgen')?.beschikbaar" :open="volgenOpen" :account-id="c.accountId" :naam="c.account.naam" :contact-id="c.id" :contact-naam="c.naam" @sluit="volgenOpen = false" @gewijzigd="ververs" />
    <MeerFlyout :open="meerOpen" :onderwerp="c.naam" :kaders="kaders" @sluit="meerOpen = false" @kies="kies" />
    <template v-if="a">
      <KaartFlyout :open="dossierOpen" kicker="Dossier" :titel="a.naam" :meta="`Het dossier van het account van ${roepnaam}.`" test="dossier-flyout" maat="breed" @sluit="dossierOpen = false">
        <AgentBlokken :account="a" @gewijzigd="refreshAccount" />
      </KaartFlyout>
      <KaartFlyout :open="kwalificatieOpen" kicker="Kwalificatie" :titel="a.naam" meta="BAND en het buying committee horen bij het account." test="kwalificatie-flyout" maat="breed" @sluit="kwalificatieOpen = false">
        <KwalificatieBlokken :account="a" :contact="{ naam: c.naam, roepnaam, rol: c.rol, functie: c.functie }" @gewijzigd="ververs" />
      </KaartFlyout>
      <KaartFlyout :open="reisOpen" kicker="Reis" :titel="a.naam" meta="De prospectreis van het account en elke fasewissel." test="reis-flyout" @sluit="reisOpen = false">
        <ReisOverzicht :account="a" />
        <p class="meta"><NuxtLink :to="`/accounts/${c.accountId}?meer=reis`" class="tekst-link" data-test="naar-accountkaart">Ritme en reis aanpassen op de accountkaart van {{ a.naam }} →</NuxtLink></p>
      </KaartFlyout>
    </template>
    <KaartFlyout :open="campagnesOpen" kicker="Campagnes" :titel="c.naam" :meta="`De campagnes met een taak of contactmoment voor ${roepnaam}.`" test="campagnes-flyout" :account-id="c.accountId" @sluit="campagnesOpen = false">
      <KaartCampagnes :campagnes="t.campagnes" op-contact />
    </KaartFlyout>
    <KaartFlyout v-if="contactPlannen.length" :open="accountplanOpen" kicker="Accountplan" :titel="c.naam" :meta="`De accountplannen waarin ${roepnaam} staat.`" test="accountplan-flyout" maat="breed" :account-id="c.accountId" @sluit="accountplanOpen = false">
      <ContactAccountplannen :plannen="contactPlannen" :roepnaam="roepnaam" />
    </KaartFlyout>
    <BelscriptFlyout v-if="c.account && functie('belscript.kiezen')?.beschikbaar" :open="belscriptOpen" :account-id="c.accountId" :naam="c.account.naam" :contact-id="c.id" @sluit="belscriptOpen = false" />
    <KlaarzetFlyout v-if="c.account" :open="klaarOpen" :account="{ id: c.accountId, naam: c.account.naam }" @sluit="klaarOpen = false" />
    <InvloedFlyout v-if="c.account" :open="invloedOpen" :account-id="c.accountId" :contact-id="c.id" @sluit="invloedOpen = false" @gewijzigd="ververs" />
  </div>
</template>

<style scoped>
/* Kop (opzet uit DealDrive: portrait-header van het contact) */
.ck-kop { padding: 28px 0; background: var(--wit); border-bottom: 1px solid var(--border); }
.ck-kruimel { display: inline-flex; align-items: center; gap: 4px; min-height: 28px; margin-bottom: 10px; font-size: 12px; font-weight: 600; color: var(--muted); text-decoration: none; }
.ck-kruimel:hover { color: var(--ink); }
.ck-kop-binnen { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 24px; align-items: start; }
@media (min-width: 1000px) { .ck-kop-binnen { grid-template-columns: 140px minmax(0, 1fr) auto; } }
.ck-avatar { position: relative; display: flex; align-items: center; justify-content: center; aspect-ratio: 4 / 3; }
.ck-avatar::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 50%, rgba(0, 0, 0, 0.15)); pointer-events: none; }
.ck-avatar--foto { background: var(--bg) !important; }
.ck-foto { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.ck-foto-potlood { position: absolute; right: 6px; bottom: 6px; z-index: 2; display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; padding: 0; border: 1px solid var(--border-strong); border-radius: 2px; background: var(--wit); color: var(--ink); cursor: pointer; opacity: 0; }
.ck-avatar:hover .ck-foto-potlood, .ck-foto-potlood:focus-visible, .ck-foto-potlood[aria-expanded="true"] { opacity: 1; }
@media (hover: none) { .ck-foto-potlood { opacity: 1; } }
.ck-foto-paneel { position: absolute; top: calc(100% + 6px); left: 0; z-index: 20; display: flex; flex-direction: column; gap: 8px; width: 260px; padding: 14px; background: var(--wit); border: 1px solid var(--border-strong); box-shadow: 0 6px 18px rgba(10, 10, 10, 0.12); }
.ck-foto-titel { margin: 0; font-family: var(--font-serif); font-size: 14px; font-weight: 700; color: var(--ink); }
.ck-foto-uitleg { margin: 0; font-size: 12px; color: var(--muted); }
.ck-foto-sluit { align-self: flex-start; }
.ck-initialen { position: relative; z-index: 1; font-family: var(--font-serif); font-size: 40px; font-weight: 700; letter-spacing: -0.02em; color: #fff; }
.ck-eyebrow { margin: 0; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: var(--muted); }
.ck-account { color: var(--ink); text-decoration: none; border-bottom: 2px solid var(--yellow); }
.ck-account:hover { color: var(--ink-soft); }
.ck-titel { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; margin: 6px 0 0; font-family: var(--font-serif); font-size: clamp(26px, 3.4vw, 36px); font-weight: 700; line-height: 1.1; letter-spacing: -0.01em; color: var(--ink); }
.ck-pillen { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.ck-contactstrip { display: flex; flex-wrap: wrap; gap: 6px 18px; margin-top: 12px; font-size: 13px; }
.ck-contactstrip a { display: inline-flex; align-items: center; gap: 6px; min-height: 28px; color: var(--ink); text-decoration: none; border-bottom: 1px solid transparent; overflow-wrap: anywhere; }
.ck-contactstrip a:hover { border-bottom-color: var(--yellow); }
.ck-contactstrip a.ck-uit { opacity: 0.45; pointer-events: none; text-decoration: line-through; }
.ck-linkedin { color: var(--blue) !important; }
.ck-ext { font-size: 11px; font-weight: 700; color: var(--muted); }
.ck-stuurstrip { display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 12px 0 0; font-size: 13px; color: var(--ink-soft); }
.ck-stuurstrip div { display: inline-flex; align-items: baseline; gap: 6px; }
.ck-stuurstrip dt { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.ck-stuurstrip dd { margin: 0; }
.ck-acties { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-start; }
@media (min-width: 1000px) { .ck-acties { grid-column: auto; justify-content: flex-end; max-width: 620px; } }

/* Statstrook */
.ck-stats { padding: 24px 0; background: var(--bg); border-bottom: 1px solid var(--border); }
.ck-stat-raster { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
@media (min-width: 700px) { .ck-stat-raster { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 1000px) { .ck-stat-raster { grid-template-columns: repeat(6, 1fr); } }
.ck-stat { display: flex; flex-direction: column; gap: 4px; padding: 8px 0; }
.ck-stat-label { font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: var(--muted); }
.ck-stat-num { font-family: var(--font-serif); font-size: 22px; font-weight: 700; line-height: 1.1; color: var(--ink); }
.ck-stat-tekst { font-size: 14px; font-weight: 600; line-height: 1.3; color: var(--ink); }
.ck-stat-voet { font-size: 10px; letter-spacing: 0.04em; color: var(--muted); }
.ck-stat-voet--rood { font-weight: 700; color: var(--red); }


@media (max-width: 719px) {
  .ck-kop { padding: 16px 0 20px; }
  .ck-kop-binnen { grid-template-columns: 76px minmax(0, 1fr); gap: 14px; }
  .ck-avatar { aspect-ratio: 1; }
  .ck-initialen { font-size: 24px; }
  .ck-foto-potlood { width: 44px; height: 44px; right: -6px; bottom: -6px; }
  .ck-foto-paneel { width: min(280px, calc(100vw - 32px)); }
  .ck-foto-paneel .dd-act { min-height: 44px; }
  .ck-kruimel { min-height: 44px; margin-bottom: 4px; }
  .ck-contactstrip a { min-height: 44px; }
  .ck-stats { padding: 12px 0; }
}
/* Telefoon: Info en Meer op één regel (zoeken en AI staan in de mobiele kop). */
@media (max-width: 767px) { .ck-acties { gap: 6px; } .ck-acties :deep(.dd-actie:not(.dd-actie--icoon)) { gap: 6px; padding-left: 10px; padding-right: 10px; } }
</style>
