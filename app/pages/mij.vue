<script setup lang="ts">
// Account (/mij), in de opzet van SalesDNA /account: kop uit het gebruikersmenu, links je profiel
// (foto, voor- en achternaam, functie, telefoon, mobiel, je inlogadres), rechts je organisatie, het
// inloggen met een code en de tweestapsverificatie. Daaronder je persoonlijke instellingen die hier
// thuishoren (regels, routes, agenda, meldingen per kanaal en Toon minder). Toestellen, Telefoon,
// scripts, AI-verbruik, meldingen onderweg en offline staan op Mijn instellingen (/mijn-instellingen).
import { FUNCTIES } from '~~/shared/functies'
import { kanalenVoor, MELDING_KANAAL_LABEL, MELDING_KANALEN, MELDING_SOORT_LABEL, MELDING_SOORT_UITLEG, MELDING_SOORTEN, type MeldingKanaal, type MeldingSoort } from '~~/shared/kanalen'
import { controleerProfiel, PROFIEL_MAX, type ProfielVeld } from '~~/shared/profiel'
import { NIVEAU_LABEL, ROL_LABEL, WERKPLEK_LABEL, type Niveau, type Rol, type Werkplek } from '~~/shared/types'

const { me, laad, functie } = useMe()
const { voegToe } = useSyncQueue()
const toast = useToast()

interface Profiel {
  naam: string; voornaam: string; achternaam: string; functie: string; telefoon: string; mobiel: string; email: string
  fotoUrl: string | null; organisatie: string | null; team: string | null; rol: string; niveau: string; werkplek: string
  magOrganisatieBeheren: boolean; alleenLezen: boolean; tweestap: { aan: boolean; verplicht: boolean; mag: boolean }
}
const { data: profiel, refresh } = await useFetch<Profiel>('/api/mij/profiel')
const { data: toestellen } = await useFetch<{ id: string }[]>('/api/mij/toestellen', { default: () => [] })
const { data: pers } = await useFetch<{ id: string; data: Record<string, any>; versie: number }>('/api/mij/instellingen')
const alleenLezen = computed(() => !!profiel.value?.alleenLezen)

// Profiel: dezelfde controle als de server (shared/profiel.ts); de rode rand op het veld dat niet klopt.
const vorm = reactive({ voornaam: '', achternaam: '', functie: '', telefoon: '', mobiel: '' })
watch(profiel, (p) => { if (p) Object.assign(vorm, { voornaam: p.voornaam, achternaam: p.achternaam, functie: p.functie, telefoon: p.telefoon, mobiel: p.mobiel }) }, { immediate: true })
const ongeldig = ref<ProfielVeld[]>([])
const melding = ref<string | null>(null)
const meldingFout = ref(false)
const bezig = ref(false)
const initialen = computed(() => [vorm.voornaam, vorm.achternaam].map((w) => w.trim()[0] ?? '').join('').toUpperCase())
function zegt(tekst: string, fout: boolean) { melding.value = tekst; meldingFout.value = fout }

async function bewaarProfiel() {
  melding.value = null
  const c = controleerProfiel(vorm)
  ongeldig.value = c.ongeldig
  if (c.melding) { zegt(c.melding, true); nextTick(() => document.getElementById(`acc-${c.ongeldig[0]}`)?.focus()); return }
  bezig.value = true
  try {
    await $fetch('/api/mij/profiel', { method: 'PUT', body: { ...vorm } })
    zegt('Je gegevens zijn opgeslagen.', false)
    await Promise.all([refresh(), laad()])
  } catch (e: any) {
    ongeldig.value = e?.data?.data?.ongeldig ?? []
    zegt(foutTekst(e), true)
  } finally { bezig.value = false }
}

// Foto: jpg of png tot 5 MB, verkleind tot 256 px voor hij de deur uit gaat.
const fotoWegVragen = ref(false)
const fotoInvoer = ref<HTMLInputElement | null>(null)
const naarBase64 = (b: Blob) => new Promise<string>((ok, nee) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] ?? ''); r.onerror = nee; r.readAsDataURL(b) })
async function kiesFoto(e: Event) {
  const el = e.target as HTMLInputElement
  const bestand = el.files?.[0]
  el.value = ''
  if (!bestand) return
  melding.value = null
  if (!['image/jpeg', 'image/png'].includes(bestand.type) || bestand.size > 5 * 1024 * 1024) return zegt('Kies een jpg of png van hooguit 5 MB.', true)
  bezig.value = true
  let blob: Blob
  try { blob = await verkleinFoto(bestand, 256) } catch { bezig.value = false; return zegt('Dit bestand is geen leesbare jpg of png. Kies een andere foto.', true) }
  try {
    await $fetch('/api/mij/foto', { method: 'POST', body: { data: await naarBase64(blob) } })
    zegt('Je foto is opgeslagen.', false)
    await Promise.all([refresh(), laad()])
  } catch (err) { zegt(foutTekst(err), true) } finally { bezig.value = false }
}
async function verwijderFoto() {
  fotoWegVragen.value = false
  try {
    await $fetch('/api/mij/foto', { method: 'DELETE' })
    zegt('Foto verwijderd.', false)
    await Promise.all([refresh(), laad()])
  } catch (e) { zegt(foutTekst(e), true) }
}

async function uitloggen() {
  await $fetch('/api/auth/uitloggen', { method: 'POST', body: {} })
  await navigateTo('/login', { external: true })
}

// Meldingen per soort en kanaal (P26): in de app, e-mail en push. Het oude veld meldingen[soort] = false
// (P01) zet een soort helemaal uit; een keuze per kanaal vervangt dat.
const kanalen = computed(() => pers.value?.data.kanalen ?? {})
const keuze = (s: MeldingSoort) => kanalenVoor(s, kanalen.value, pers.value?.data.meldingen)
async function wisselKanaal(s: MeldingSoort, k: MeldingKanaal, aan: boolean) {
  if (!pers.value) return
  const nieuw = { ...kanalen.value, [s]: { ...keuze(s), [k]: aan } }
  const meldingen = { ...(pers.value.data.meldingen ?? {}) }; delete meldingen[s]
  pers.value.data = { ...pers.value.data, kanalen: nieuw, meldingen }
  await voegToe({ tabel: 'persoonlijke_instellingen', op: 'patch', recordId: pers.value.id, patch: { kanalen: nieuw, meldingen } })
}

const magToonMinder = computed(() => functie('mij.toonMinder')?.beschikbaar)
const zichtbaar = computed(() => {
  const opZijbalk = new Set([...(me.value?.zijbalk.groepen ?? []).flatMap((g) => g.items.map((i) => i.sleutel)), ...(me.value?.gebruiker.verborgen ?? [])])
  return FUNCTIES.filter((f) => f.zijbalk && f.sleutel !== 'nav.vandaag' && opZijbalk.has(f.sleutel))
})
const verborgen = computed(() => new Set(me.value?.gebruiker.verborgen ?? []))
async function toonMinder(sleutel: string, tonen: boolean) {
  try {
    await $fetch('/api/mij/toon-minder', { method: 'POST', body: { functie: sleutel, verborgen: !tonen } })
    await laad()
  } catch (e: any) {
    toast.toon(e?.data?.statusMessage ?? 'Opslaan mislukt', 'fout')
  }
}

// Routes (P14): thuisbasis voor routes en de kaartapp voor navigeren.
const thuisbasis = ref(((me.value?.gebruiker as any)?.route?.thuisbasis ?? '') as string)
const kaartapp = ref(((me.value?.gebruiker as any)?.route?.kaartapp ?? 'google') as string)
async function bewaarRoute(veld: 'thuisbasis' | 'kaartapp') {
  try { await $fetch('/api/mij/route', { method: 'PUT', body: veld === 'thuisbasis' ? { thuisbasis: thuisbasis.value } : { kaartapp: kaartapp.value } }); toast.toon(veld === 'thuisbasis' ? 'Thuisbasis bewaard.' : 'Kaartapp bewaard.') } catch (e) { toast.toon(foutTekst(e), 'fout') }
}

// Gekoppelde agenda (P13): Microsoft 365 of Google; de beheerder zet de koppeling aan.
const { data: agenda, refresh: herlaadAgenda } = await useFetch<any>('/api/koppelingen/agenda', { default: () => null })
const route = useRoute()
if (import.meta.client && route.query.agenda === 'gekoppeld') toast.toon('Agenda gekoppeld.')
if (import.meta.client && route.query.agenda === 'fout') toast.toon('Koppelen is niet gelukt. Probeer het opnieuw.', 'fout')
async function zetAgendaAan(aan: boolean) {
  try { await $fetch('/api/koppelingen/agenda', { method: 'PUT', body: { aan } }); await herlaadAgenda() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function ontkoppelAgenda(p: string) {
  try { await $fetch(`/api/koppelingen/agenda/${p}`, { method: 'DELETE' }); toast.toon('Agenda ontkoppeld.'); await herlaadAgenda() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
useHead({ title: 'Account · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Gebruikersmenu" titel="Account" uitleg="Je eigen gegevens. Je naam en foto staan onder in het menu." helpartikel="mijn-instellingen" />
    <section class="section">
      <div class="container">
        <p v-if="alleenLezen" class="acc-alleen-lezen" data-test="account-alleen-lezen">Je werkt als founder in deze organisatie: je eigen account wijzig je daarbuiten.</p>
        <div v-if="profiel" class="acc-raster">
          <form class="kaart acc-profiel" data-test="profiel" novalidate @submit.prevent="bewaarProfiel">
            <header class="kaart-kop"><h2 class="kaart-titel">Profiel</h2></header>
            <div class="veld">
              <span class="veld-label">Foto</span>
              <div class="acc-foto-rij">
                <span class="acc-avatar" data-test="acc-avatar"><img v-if="profiel.fotoUrl" :src="profiel.fotoUrl" alt="Jouw profielfoto"><template v-else>{{ initialen }}</template></span>
                <template v-if="!alleenLezen">
                  <input id="acc-foto" ref="fotoInvoer" type="file" accept="image/png,image/jpeg" class="sr-only" tabindex="-1" aria-hidden="true" data-test="acc-foto-invoer" @change="kiesFoto">
                  <button type="button" class="dd-act" :disabled="bezig" data-test="acc-foto-kies" @click="fotoInvoer?.click()"><Icoon naam="Camera" />Foto kiezen</button>
                  <button v-if="profiel.fotoUrl" type="button" class="dd-act" data-test="acc-foto-weg" @click="fotoWegVragen = true">Foto verwijderen</button>
                </template>
              </div>
              <span class="veld-uitleg">jpg of png, hooguit 5 MB. We verkleinen hem tot 256 pixels.</span>
            </div>
            <div class="acc-velden mt-16">
              <label class="veld"><span class="veld-label">Voornaam</span><input id="acc-voornaam" v-model="vorm.voornaam" class="invoer" autocomplete="given-name" :maxlength="PROFIEL_MAX.voornaam" required :readonly="alleenLezen" :aria-invalid="ongeldig.includes('voornaam') ? 'true' : undefined" aria-describedby="acc-melding" data-test="acc-voornaam"></label>
              <label class="veld"><span class="veld-label">Achternaam</span><input id="acc-achternaam" v-model="vorm.achternaam" class="invoer" autocomplete="family-name" :maxlength="PROFIEL_MAX.achternaam" required :readonly="alleenLezen" :aria-invalid="ongeldig.includes('achternaam') ? 'true' : undefined" aria-describedby="acc-melding" data-test="acc-achternaam"></label>
              <label class="veld"><span class="veld-label">Functie</span><input id="acc-functie" v-model="vorm.functie" class="invoer" autocomplete="organization-title" :maxlength="PROFIEL_MAX.functie" :readonly="alleenLezen" data-test="acc-functie"></label>
              <label class="veld"><span class="veld-label">Telefoon</span><input id="acc-telefoon" v-model="vorm.telefoon" class="invoer" type="tel" autocomplete="tel" :maxlength="PROFIEL_MAX.telefoon" :readonly="alleenLezen" :aria-invalid="ongeldig.includes('telefoon') ? 'true' : undefined" aria-describedby="acc-melding" data-test="acc-telefoon"></label>
              <label class="veld"><span class="veld-label">Mobiel</span><input id="acc-mobiel" v-model="vorm.mobiel" class="invoer" type="tel" autocomplete="tel" :maxlength="PROFIEL_MAX.mobiel" :readonly="alleenLezen" :aria-invalid="ongeldig.includes('mobiel') ? 'true' : undefined" aria-describedby="acc-melding" data-test="acc-mobiel"></label>
            </div>
            <label class="veld mt-16"><span class="veld-label">E-mailadres om in te loggen</span><input class="invoer" :value="profiel.email" readonly aria-describedby="acc-email-hint" data-test="acc-email"><span id="acc-email-hint" class="veld-uitleg">Hierheen sturen we je inlogcode. Wijzigen gaat via je beheerder.</span></label>
            <p v-if="melding" id="acc-melding" class="acc-melding" :class="{ 'acc-melding--fout': meldingFout }" :role="meldingFout ? 'alert' : 'status'" data-test="acc-melding">{{ melding }}</p>
            <div v-if="!alleenLezen" class="mt-16"><button type="submit" class="dd-act dd-act--primair" :disabled="bezig" data-test="acc-opslaan">Opslaan</button></div>
          </form>

          <div class="acc-kolom">
            <section class="kaart" data-test="acc-organisatie" aria-labelledby="acc-org-kop">
              <header class="kaart-kop"><h2 id="acc-org-kop" class="kaart-titel">Organisatie en werkplek</h2></header>
              <dl class="gegevens">
                <dt>Organisatie</dt><dd>{{ profiel.organisatie ?? 'Geen organisatie' }}</dd>
                <dt>Team</dt><dd>{{ profiel.team ?? 'Geen team' }}</dd>
                <dt>Rol</dt><dd>{{ ROL_LABEL[profiel.rol as Rol] }}</dd>
                <dt>Niveau</dt><dd>{{ NIVEAU_LABEL[profiel.niveau as Niveau] }}</dd>
                <dt>Werkplek</dt><dd>{{ WERKPLEK_LABEL[profiel.werkplek as Werkplek] }}</dd>
              </dl>
              <p class="veld-uitleg">
                {{ profiel.magOrganisatieBeheren ? 'Je organisatie, teams, rollen en niveaus stel je in bij Instellingen.' : 'Je team, rol, niveau en werkplek stelt je beheerder of salesmanager in.' }}
                <NuxtLink v-if="profiel.magOrganisatieBeheren" to="/instellingen" class="tekst-link">Naar Instellingen</NuxtLink>
              </p>
            </section>

            <section class="kaart" data-test="acc-inloggen" aria-labelledby="acc-in-kop">
              <header class="kaart-kop"><h2 id="acc-in-kop" class="kaart-titel">Inloggen</h2></header>
              <p class="tekst">Je logt in met een code van zes cijfers die we mailen naar <strong>{{ profiel.email }}</strong>. Een wachtwoord heb je niet. De code is tien minuten geldig en werkt één keer.</p>
              <p class="meta mt-8" data-test="acc-toestellen-aantal">Je bent ingelogd op {{ toestellen.length }} {{ toestellen.length === 1 ? 'toestel' : 'toestellen' }}.</p>
              <div class="reis-knoppen mt-16">
                <NuxtLink :to="{ path: '/mijn-instellingen', hash: '#toestellen' }" class="dd-act" data-test="acc-naar-toestellen"><Icoon naam="Smartphone" />Toestellen en sessies</NuxtLink>
                <button type="button" class="dd-act" data-test="acc-uitloggen" @click="uitloggen"><Icoon naam="LogOut" />Uitloggen</button>
              </div>
            </section>

            <MijnTweestap :stand="profiel.tweestap" :alleen-lezen="alleenLezen" @gewijzigd="refresh()" />
          </div>
        </div>
      </div>
    </section>

    <section class="section" :class="{ 'section--laatste': !magToonMinder }">
      <div class="container">
        <span class="kicker kicker--streep">Persoonlijke instellingen</span>
        <h2 class="title">Hoe Dealtrace voor jou werkt</h2>
        <p class="subtitle">Je toestellen, scripts, AI-verbruik en de instellingen voor onderweg staan op <NuxtLink to="/mijn-instellingen" class="tekst-link" data-test="acc-naar-mijn-instellingen">Mijn instellingen</NuxtLink>.</p>
        <div class="instellingen-raster mt-16">
          <article v-if="functie('regels.lezen')?.beschikbaar" class="kaart" data-test="mijn-regels">
            <header class="kaart-kop"><h2 class="kaart-titel">{{ functie('regels.persoonlijk')?.beschikbaar ? 'Mijn regels' : 'Regels bekijken' }}</h2></header>
            <p class="kaart-meta">Welke regels jouw taken en inzichten klaarzetten{{ functie('regels.persoonlijk')?.beschikbaar ? ', en je eigen regels voor je eigen accounts' : '' }}.</p>
            <div class="reis-knoppen mt-16"><NuxtLink to="/instellingen/regels" class="dd-act">Naar de regels</NuxtLink><NuxtLink to="/instellingen/ritme" class="dd-act">Accountmatrix</NuxtLink></div>
          </article>
          <article class="kaart" data-test="mijn-routes">
            <header class="kaart-kop"><h2 class="kaart-titel">Routes en navigeren</h2></header>
            <label class="veld"><span class="veld-label">Thuisbasis voor routes</span><input v-model="thuisbasis" class="invoer" placeholder="Adres, postcode of plaats" data-test="thuisbasis" @change="bewaarRoute('thuisbasis')"><span class="veld-uitleg">Je route begint en eindigt hier. Je locatie zelf bewaart Dealtrace niet.</span></label>
            <label class="veld mt-16"><span class="veld-label">Kaartapp voor navigeren</span><select v-model="kaartapp" class="invoer" data-test="kaartapp" @change="bewaarRoute('kaartapp')"><option value="google">Google Maps</option><option value="apple">Apple Kaarten</option><option value="waze">Waze</option></select></label>
          </article>
          <article v-if="agenda" id="agenda" class="kaart" data-test="gekoppelde-agenda">
            <header class="kaart-kop"><h2 class="kaart-titel">Gekoppelde agenda</h2></header>
            <p class="kaart-meta">Wat in je agenda staat, telt mee als bezet. Afspraken uit Dealtrace komen erin, met een Teams- of Meet-link bij online.</p>
            <p v-if="agenda.beheerder" class="schakel-rij"><span>Agendakoppeling aan voor de organisatie</span><Schakelaar :aan="agenda.aanDoorBeheerder" label="Agendakoppeling aan voor de organisatie" @wissel="zetAgendaAan" /></p>
            <p v-if="!agenda.aanDoorBeheerder" class="meta">Je beheerder heeft de agendakoppeling nog niet aangezet.</p>
            <p v-else-if="!agenda.magKoppelen" class="meta">Agenda koppelen: nog niet aangezet voor jouw niveau.</p>
            <ul v-else class="schakel-lijst">
              <li v-for="p in agenda.providers" :key="p.provider" class="schakel-rij">
                <span>{{ p.naam }} <span class="meta">{{ p.status === 'actief' ? `gekoppeld${p.laatsteSync ? `, bijgewerkt ${new Date(p.laatsteSync).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })}` : ''}` : p.status === 'fout' ? 'ontkoppeld, koppel opnieuw' : 'niet gekoppeld' }}</span></span>
                <button v-if="p.status === 'actief'" type="button" class="dd-act" :data-test="`ontkoppel-${p.provider}`" @click="ontkoppelAgenda(p.provider)">Ontkoppel</button>
                <a v-else class="dd-act dd-act--primair" :href="`/api/koppelingen/agenda/${p.provider}/start`" :data-test="`koppel-${p.provider}`">Koppel {{ p.naam }}</a>
              </li>
            </ul>
          </article>
          <article class="kaart acc-breed" data-test="mijn-meldingen">
            <header class="kaart-kop"><h2 class="kaart-titel">Meldingen</h2></header>
            <p class="kaart-meta">Kies per soort hoe je hem krijgt. Gelezen geldt op al je toestellen.</p>
            <div class="kanaal-raster mt-8">
              <span /><span v-for="k in MELDING_KANALEN" :key="k" class="kr-kop">{{ MELDING_KANAAL_LABEL[k] }}</span>
              <template v-for="s in MELDING_SOORTEN" :key="s">
                <div><span class="schakel-naam">{{ MELDING_SOORT_LABEL[s] }}</span><span class="veld-uitleg">{{ MELDING_SOORT_UITLEG[s] }}</span></div>
                <span v-for="k in MELDING_KANALEN" :key="k" class="kr-cel"><Schakelaar :aan="keuze(s)[k]" :label="`${MELDING_SOORT_LABEL[s]}: ${MELDING_KANAAL_LABEL[k]}`" :data-test="`kanaal-${s}-${k}`" @wissel="wisselKanaal(s, k, $event)" /></span>
              </template>
            </div>
          </article>
        </div>
      </div>
    </section>
    <section v-if="magToonMinder" class="section section--laatste">
      <div class="container">
        <span class="kicker kicker--streep">Toon minder</span>
        <h2 class="title">Wat je in de zijbalk ziet</h2>
        <p class="subtitle">Verberg wat je nu niet gebruikt. Je zet hier nooit iets aan wat voor je niveau nog uit staat.</p>
        <ul class="schakel-lijst kaart mt-16" data-test="toon-minder">
          <li v-for="f in zichtbaar" :key="f.sleutel" class="schakel-rij">
            <span class="schakel-naam"><Icoon :naam="f.zijbalk!.icoon" :grootte="16" /> {{ f.naam }}</span>
            <Schakelaar :aan="!verborgen.has(f.sleutel)" :label="`${f.naam} tonen`" @wissel="toonMinder(f.sleutel, $event)" />
          </li>
        </ul>
      </div>
    </section>
    <BevestigVenster :open="fotoWegVragen" titel="Foto verwijderen?" tekst="Je foto verdwijnt; in het menu staan dan je initialen." bevestig="Foto verwijderen" gevaar @geannuleerd="fotoWegVragen = false" @bevestigd="verwijderFoto" />
  </div>
</template>

<style scoped>
.acc-raster { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--kaart-gap, 16px); align-items: start; }
@media (min-width: 1000px) { .acc-raster { grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); } }
.acc-kolom { display: flex; flex-direction: column; gap: var(--kaart-gap, 16px); min-width: 0; }
.acc-velden { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; }
@media (min-width: 560px) { .acc-velden { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
.acc-foto-rij { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.acc-foto-rij .dd-act { min-height: 44px; cursor: pointer; }
.acc-avatar { display: grid; place-items: center; flex: 0 0 64px; width: 64px; height: 64px; overflow: hidden; background: var(--yellow); border-radius: var(--radius); color: var(--ink); font-size: 22px; font-weight: 800; }
.acc-avatar img { width: 100%; height: 100%; object-fit: cover; }
.acc-melding { margin: 16px 0 0; font-size: var(--fs-meta); font-weight: 600; color: var(--green); }
.acc-melding--fout { color: var(--red); }
.acc-alleen-lezen { margin: 0 0 16px; padding: 12px 16px; background: var(--surface); border-left: 3px solid var(--yellow); font-size: var(--fs-body); }
.acc-breed { grid-column: 1 / -1; }
.acc-profiel :deep(.invoer[readonly]) { background: var(--surface); }
</style>
