<script setup lang="ts">
// Gebruikers en teams (F22, 3.2, 6.1). De beheerder ziet iedereen; de salesmanager
// alleen zijn teams en zet daar het niveau. Verlagen vraagt een reden.
// Pakket B: wijzigen in een flyout (naam, e-mail, eigen portefeuille), archiveren met overdracht,
// tabblad Gearchiveerd met Heractiveren, kolommen laatste inlog en status, teams beheren in TeamKaart.
import { NIVEAUS, NIVEAU_LABEL, ROL_LABEL, WERKPLEKKEN, WERKPLEK_LABEL, type Niveau, type Rol, type Werkplek } from '~~/shared/types'

interface Gebruiker { id: string; naam: string; email: string; rol: Rol; niveau: Niveau; teamId: string | null; werkplek: Werkplek; laatsteInlog: string | null; status: string; eigenPortefeuille: boolean | null }
interface Team { id: string; naam: string; managerIds: string[]; gekoppeldeTeams: string[] }

const { me, functie, laad } = useMe()
const toast = useToast()
if (!functie('nav.instellingen')?.beschikbaar) throw createError({ statusCode: 403, statusMessage: 'Geen toegang tot gebruikers' })
const beheerder = computed(() => me.value?.gebruiker.rol === 'beheerder')
const magNiveau = computed(() => !!functie('gebruikers.niveau')?.beschikbaar)

const [{ data: gebruikers, refresh: herlaadGebruikers }, { data: teams, refresh: herlaadTeams }] = await Promise.all([
  useFetch<Gebruiker[]>('/api/gebruikers', { default: () => [] }),
  useFetch<Team[]>('/api/teams', { default: () => [] }),
])
const route = useRoute()
const tab = ref<'gebruikers' | 'gearchiveerd' | 'teams'>(route.query.tab === 'teams' ? 'teams' : route.query.tab === 'gearchiveerd' ? 'gearchiveerd' : 'gebruikers')
const teamNaam = (id: string | null) => teams.value.find((t) => t.id === id)?.naam ?? 'Geen team'
const actief = computed(() => gebruikers.value.filter((g) => g.status !== 'gearchiveerd'))
const gearchiveerd = computed(() => beheerder.value ? gebruikers.value.filter((g) => g.status === 'gearchiveerd') : [])

/** Laatste inlog in woorden: vandaag 14:58, gisteren, 3 dagen geleden, 12 sep, nog niet. */
function inlog(t: string | null) {
  if (!t) return 'Nog niet'
  const d = new Date(t)
  const dag = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const verschil = Math.round((dag(new Date()) - dag(d)) / 864e5)
  if (verschil <= 0) return `Vandaag ${d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`
  if (verschil === 1) return 'Gisteren'
  if (verschil < 14) return `${verschil} dagen geleden`
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })
}
const gemarkeerd = computed(() => route.query.gebruiker as string | undefined)

function fout(e: any) { toast.toon(e?.data?.statusMessage ?? e?.statusMessage ?? 'Opslaan mislukt', 'fout') }

// Niveau
const verlaging = ref<{ g: Gebruiker; naar: Niveau } | null>(null)
async function kiesNiveau(g: Gebruiker, naar: Niveau) {
  if (g.niveau === naar) return
  if (NIVEAUS.indexOf(naar) < NIVEAUS.indexOf(g.niveau)) { verlaging.value = { g, naar }; return }
  await zetNiveau(g, naar)
}
async function zetNiveau(g: Gebruiker, naar: Niveau, reden?: string) {
  try {
    await $fetch(`/api/gebruikers/${g.id}/niveau`, { method: 'POST', body: { niveau: naar, reden } })
    toast.toon(`${g.naam} staat nu op ${NIVEAU_LABEL[naar]}.`)
    await herlaadGebruikers()
    if (g.id === me.value?.gebruiker.id) await laad()
  } catch (e) { fout(e) }
}
const niveauUit = (g: Gebruiker) => !magNiveau.value || (g.id === me.value?.gebruiker.id && !beheerder.value)

// Wijzigen (beheerder)
async function wijzig(g: Gebruiker, veld: 'werkplek' | 'teamId' | 'rol', waarde: string | null) {
  try {
    await $fetch(`/api/gebruikers/${g.id}`, { method: 'PUT', body: { [veld]: waarde } })
    await herlaadGebruikers()
    toast.toon('Opgeslagen.')
  } catch (e) { fout(e); await herlaadGebruikers() }
}
const bewerken = ref<Gebruiker | null>(null)
async function opgeslagen() { bewerken.value = null; await herlaadGebruikers() }

// Archiveren met overdracht en heractiveren (beheerder)
const archiveren = ref<Gebruiker | null>(null)
async function gearchiveerdKlaar(o: { naar: string | null; prospects: number; taken: number; reeksen: number }) {
  const g = archiveren.value
  archiveren.value = null
  await Promise.all([herlaadGebruikers(), herlaadAbonnement()])
  if (!g) return
  toast.toon(o.naar && o.prospects + o.taken + o.reeksen > 0 ? `${g.naam} is gearchiveerd. Het werk staat nu bij ${naamVan(o.naar)}.` : `${g.naam} is gearchiveerd.`)
}
const heractiveerFout = ref<{ id: string; tekst: string; seats: boolean } | null>(null)
async function heractiveer(g: Gebruiker) {
  heractiveerFout.value = null
  try {
    await $fetch(`/api/gebruikers/${g.id}/heractiveer`, { method: 'POST' })
    await Promise.all([herlaadGebruikers(), herlaadAbonnement()])
    toast.toon(`${g.naam} is weer actief.`)
  } catch (e: any) {
    heractiveerFout.value = { id: g.id, tekst: e?.data?.statusMessage ?? 'Heractiveren mislukt', seats: !!e?.data?.data?.aanvragen }
  }
}

// Toevoegen (beheerder)
const nieuw = reactive({ open: false, naam: '', email: '', rol: 'accountmanager', werkplek: 'binnendienst', teamId: '' })
// Seats en stand van de leverancier (F23): binnen de seats zelf toevoegen, anders aanvragen.
const { data: abonnement, refresh: herlaadAbonnement } = beheerder.value
  ? await useFetch<any>('/api/instellingen/abonnement')
  : { data: ref(null), refresh: async () => {} }
const { data: aanvragen, refresh: herlaadAanvragen } = beheerder.value
  ? await useFetch<any[]>('/api/instellingen/gebruikersaanvragen', { default: () => [] })
  : { data: ref<any[]>([]), refresh: async () => {} }
const zelfToevoegen = computed(() => abonnement.value?.gebruikersStand === 'zelf' && (abonnement.value?.seats ?? 0) > (abonnement.value?.gebruikers ?? 0))
const openAanvragen = computed(() => (aanvragen.value ?? []).filter((a: any) => a.status === 'open'))
async function voegToe() {
  try {
    if (!zelfToevoegen.value) {
      await $fetch('/api/instellingen/gebruikersaanvragen', { method: 'POST', body: { naam: nieuw.naam, email: nieuw.email, rol: nieuw.rol, werkplek: nieuw.werkplek, teamId: nieuw.teamId || null } })
      toast.toon(`Aanvraag voor ${nieuw.naam} verstuurd naar Dealtrace.`)
      Object.assign(nieuw, { open: false, naam: '', email: '' })
      await herlaadAanvragen()
      return
    }
    await $fetch('/api/gebruikers', { method: 'POST', body: { naam: nieuw.naam, email: nieuw.email, rol: nieuw.rol, werkplek: nieuw.werkplek, teamId: nieuw.teamId || null } })
    await herlaadAbonnement()
    toast.toon(`${nieuw.naam} is uitgenodigd.`)
    Object.assign(nieuw, { open: false, naam: '', email: '' })
    await herlaadGebruikers()
  } catch (e) { fout(e) }
}

// Teams (beheerder)
const nieuwTeam = ref('')
async function voegTeamToe() {
  try { await $fetch('/api/teams', { method: 'POST', body: { naam: nieuwTeam.value } }); toast.toon(`${nieuwTeam.value.trim()} is toegevoegd.`); nieuwTeam.value = ''; await herlaadTeams() } catch (e) { fout(e) }
}
const salesmanagers = computed(() => actief.value.filter((g) => g.rol === 'salesmanager'))
const ledenVan = (teamId: string) => actief.value.filter((g) => g.teamId === teamId).length
async function teamGewijzigd() { await Promise.all([herlaadTeams(), herlaadGebruikers()]) }
const naamVan = (id: string) => gebruikers.value.find((g) => g.id === id)?.naam ?? id
useHead({ title: 'Gebruikers · Instellingen · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Instellingen · Gebruikers" titel="Gebruikers en teams" :uitleg="beheerder ? 'Wie werkt in Dealtrace, op welk niveau en in welk team.' : 'De mensen in je teams en hun niveau.'" helpartikel="gebruikers-rollen-niveaus">
      <template #acties>
        <button v-if="beheerder && tab === 'gebruikers'" type="button" class="dd-actie dd-actie--primair" data-test="gebruiker-toevoegen" @click="nieuw.open = !nieuw.open"><Icoon naam="Plus" class="dd-actie-icoon" />{{ zelfToevoegen ? 'Gebruiker toevoegen' : 'Gebruiker aanvragen' }}</button>
      </template>
    </PaginaKop>
    <section class="section section--laatste">
      <div class="container">
        <nav class="tabbalk" aria-label="Gebruikers en teams">
          <button type="button" class="tab" :class="{ 'tab--actief': tab === 'gebruikers' }" :aria-current="tab === 'gebruikers' ? 'page' : undefined" data-test="tab-gebruikers" @click="tab = 'gebruikers'">Gebruikers <span class="tab-teller">{{ actief.length }}</span></button>
          <button v-if="beheerder" type="button" class="tab" :class="{ 'tab--actief': tab === 'gearchiveerd' }" :aria-current="tab === 'gearchiveerd' ? 'page' : undefined" data-test="tab-gearchiveerd" @click="tab = 'gearchiveerd'">Gearchiveerd <span class="tab-teller">{{ gearchiveerd.length }}</span></button>
          <button type="button" class="tab" :class="{ 'tab--actief': tab === 'teams' }" :aria-current="tab === 'teams' ? 'page' : undefined" data-test="tab-teams" @click="tab = 'teams'">Teams <span class="tab-teller">{{ teams.length }}</span></button>
        </nav>

        <template v-if="tab === 'gebruikers'">
          <form v-if="nieuw.open" class="kaart mt-16" data-test="nieuwe-gebruiker" @submit.prevent="voegToe">
            <div class="formulier-raster">
              <label class="veld"><span class="veld-label">Naam <span class="veld-verplicht">*</span></span><input v-model="nieuw.naam" class="invoer" required></label>
              <label class="veld"><span class="veld-label">E-mail <span class="veld-verplicht">*</span></span><input v-model="nieuw.email" class="invoer" type="email" required></label>
              <label class="veld"><span class="veld-label">Rol</span><select v-model="nieuw.rol" class="invoer"><option value="accountmanager">Accountmanager</option><option value="salesmanager">Salesmanager</option><option value="beheerder">Beheerder</option></select></label>
              <label class="veld"><span class="veld-label">Werkplek</span><select v-model="nieuw.werkplek" class="invoer"><option v-for="w in WERKPLEKKEN" :key="w" :value="w">{{ WERKPLEK_LABEL[w] }}</option></select></label>
              <label class="veld"><span class="veld-label">Team</span><select v-model="nieuw.teamId" class="invoer"><option value="">Geen team</option><option v-for="t in teams" :key="t.id" :value="t.id">{{ t.naam }}</option></select></label>
              <button type="submit" class="dd-actie dd-actie--primair" data-test="nieuwe-gebruiker-verstuur">{{ zelfToevoegen ? 'Uitnodigen' : 'Aanvragen' }}</button>
            </div>
            <p class="veld-uitleg">{{ zelfToevoegen ? 'Het niveau wordt het standaardniveau van je organisatie. Dat pas je daarna hieronder aan.' : `Dealtrace handelt je aanvraag af${abonnement?.seats ? ` (${abonnement.gebruikers} van ${abonnement.seats} seats in gebruik)` : ''}.` }}</p>
          </form>
          <div v-if="openAanvragen.length" class="kaart mt-16" data-test="open-aanvragen">
            <span class="veld-label">Aangevraagd bij Dealtrace</span>
            <ul class="schakel-lijst"><li v-for="a in openAanvragen" :key="a.id" class="schakel-rij"><span>{{ a.data.naam }} · {{ a.data.email }}</span><span class="pil pil--geel">open</span></li></ul>
          </div>

          <LegeStaat v-if="!actief.length" :titel="beheerder ? 'Nog geen gebruikers.' : 'Nog niemand in je teams.'" :tekst="beheerder ? 'Voeg je eerste collega toe met Gebruiker toevoegen.' : 'De beheerder zet accountmanagers in jouw teams.'" />
          <div v-else class="tabel-wrap gb-wrap mt-16">
            <table class="tabel tabel--kaarten gb-tabel" data-test="gebruikers-tabel">
              <thead><tr><th>Naam</th><th>Rol</th><th>Niveau</th><th>Werkplek</th><th>Team</th><th>Status</th><th v-if="beheerder"><span class="sr-only">Acties</span></th></tr></thead>
              <tbody>
                <tr v-for="g in actief" :key="g.id" :data-gebruiker="g.id" :class="{ 'tabel-rij--gemarkeerd': gemarkeerd === g.id }">
                  <td><div class="gebruiker-cel"><strong>{{ g.naam }}</strong><small>{{ g.email }}</small><small v-if="g.rol === 'salesmanager' && g.eigenPortefeuille">Met eigen portefeuille</small></div></td>
                  <td>
                    <select v-if="beheerder" class="invoer invoer--klein" :value="g.rol" :aria-label="`Rol van ${g.naam}`" @change="wijzig(g, 'rol', ($event.target as HTMLSelectElement).value)">
                      <option value="accountmanager">Accountmanager</option><option value="salesmanager">Salesmanager</option><option value="beheerder">Beheerder</option>
                    </select>
                    <template v-else>{{ ROL_LABEL[g.rol] }}</template>
                  </td>
                  <td>
                    <div class="keuzegroep keuzegroep--klein" role="group" :aria-label="`Niveau van ${g.naam}`">
                      <button
                        v-for="n in NIVEAUS" :key="n" type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': g.niveau === n }"
                        :aria-pressed="g.niveau === n" :disabled="niveauUit(g) || (g.rol === 'salesmanager' && n === 'beginner')" :data-test="`niveau-${g.id}-${n}`" @click="kiesNiveau(g, n)"
                      >{{ NIVEAU_LABEL[n] }}</button>
                    </div>
                  </td>
                  <td>
                    <select v-if="beheerder" class="invoer invoer--klein" :value="g.werkplek" :aria-label="`Werkplek van ${g.naam}`" @change="wijzig(g, 'werkplek', ($event.target as HTMLSelectElement).value)">
                      <option v-for="w in WERKPLEKKEN" :key="w" :value="w">{{ WERKPLEK_LABEL[w] }}</option>
                    </select>
                    <template v-else>{{ WERKPLEK_LABEL[g.werkplek] }}</template>
                  </td>
                  <td>
                    <select v-if="beheerder" class="invoer invoer--klein" :value="g.teamId ?? ''" :aria-label="`Team van ${g.naam}`" @change="wijzig(g, 'teamId', ($event.target as HTMLSelectElement).value || null)">
                      <option value="">Geen team</option><option v-for="t in teams" :key="t.id" :value="t.id">{{ t.naam }}</option>
                    </select>
                    <template v-else>{{ teamNaam(g.teamId) }}</template>
                  </td>
                  <td class="gb-status">
                    <span :data-test="`status-${g.id}`"><Label v-if="g.status === 'uitgenodigd'" soort="status" waarde="wachtend" tekst="Uitgenodigd" /><template v-else>Actief</template></span>
                    <small class="gb-inlog" :data-test="`inlog-${g.id}`">Laatste inlog {{ inlog(g.laatsteInlog).toLowerCase() }}</small>
                  </td>
                  <td v-if="beheerder">
                    <div class="gb-acties">
                      <button type="button" class="dd-act gb-ico" :data-test="`wijzig-${g.id}`" :aria-label="`${g.naam} wijzigen`" title="Wijzig naam, e-mail of portefeuille" @click="bewerken = g"><Icoon naam="Pencil" :grootte="16" /><span class="gb-ico-tekst">Wijzig</span></button>
                      <button v-if="g.id !== me?.gebruiker.id" type="button" class="dd-act gb-ico" :data-test="`archiveer-${g.id}`" :aria-label="`${g.naam} archiveren`" title="Archiveer met overdracht" @click="archiveren = g"><Icoon naam="Archive" :grootte="16" /><span class="gb-ico-tekst">Archiveer</span></button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <template v-else-if="tab === 'gearchiveerd'">
          <p class="veld-uitleg mt-16">Gearchiveerde gebruikers kunnen niet inloggen en tellen niet mee voor je seats. Hun geschiedenis blijft bewaard.<template v-if="abonnement?.seats"> Nu {{ abonnement.gebruikers }} van {{ abonnement.seats }} seats in gebruik.</template></p>
          <LegeStaat v-if="!gearchiveerd.length" titel="Niemand gearchiveerd." tekst="Archiveer je iemand die vertrekt, dan staat hij hier en kun je hem later heractiveren." />
          <ul v-else class="gb-archief mt-16" data-test="gearchiveerd-lijst">
            <li v-for="g in gearchiveerd" :key="g.id" class="kaart gb-archief-rij" :data-gebruiker="g.id">
              <div class="gebruiker-cel"><strong>{{ g.naam }}</strong><small>{{ g.email }}</small><small>{{ ROL_LABEL[g.rol] }} · {{ teamNaam(g.teamId) }} · laatste inlog {{ inlog(g.laatsteInlog).toLowerCase() }}</small></div>
              <Label soort="status" waarde="gedeactiveerd" tekst="Gearchiveerd" />
              <button type="button" class="dd-actie dd-actie--secundair gb-heractiveer" :data-test="`heractiveer-${g.id}`" @click="heractiveer(g)"><Icoon naam="Undo2" :grootte="16" />Heractiveren</button>
              <p v-if="heractiveerFout?.id === g.id" class="gb-fout" role="alert" data-test="heractiveer-fout">
                {{ heractiveerFout.tekst }}
                <NuxtLink v-if="heractiveerFout.seats" to="/instellingen/abonnement">Naar Abonnement</NuxtLink>
              </p>
            </li>
          </ul>
        </template>

        <template v-else>
          <form v-if="beheerder" class="kaart mt-16 formulier-raster" @submit.prevent="voegTeamToe">
            <label class="veld"><span class="veld-label">Nieuw team</span><input v-model="nieuwTeam" class="invoer" placeholder="Bijvoorbeeld Team Oost" data-test="nieuw-team"></label>
            <button type="submit" class="dd-actie dd-actie--primair" :disabled="!nieuwTeam.trim()" data-test="team-toevoegen">Team toevoegen</button>
          </form>
          <LegeStaat v-if="!teams.length" :titel="beheerder ? 'Nog geen teams.' : 'Je leidt nog geen team.'" :tekst="beheerder ? 'Een team bundelt accountmanagers onder een salesmanager. Geef het team hierboven een naam.' : 'De beheerder koppelt je als salesmanager aan een team.'" />
          <div class="instellingen-raster mt-16">
            <TeamKaart v-for="t in teams" :key="t.id" :team="t" :leden="ledenVan(t.id)" :beheerder="beheerder" :managers="salesmanagers" :teams="teams" :naam-van="naamVan" @gewijzigd="teamGewijzigd" />
          </div>
        </template>
      </div>
    </section>

    <BevestigVenster
      :open="!!verlaging" titel="Niveau verlagen" bevestig="Verlagen" met-reden
      :tekst="verlaging ? `${verlaging.g.naam} gaat van ${NIVEAU_LABEL[verlaging.g.niveau]} naar ${NIVEAU_LABEL[verlaging.naar]}. Functies die daarbij horen gaan uit. Zijn gegevens blijven bewaard.` : ''"
      @geannuleerd="verlaging = null" @bevestigd="(r) => { const v = verlaging!; verlaging = null; zetNiveau(v.g, v.naar, r) }"
    />
    <ArchiveerVenster :gebruiker="archiveren" @geannuleerd="archiveren = null" @gearchiveerd="gearchiveerdKlaar" />
    <GebruikerFlyout v-if="beheerder" :gebruiker="bewerken" @sluit="bewerken = null" @opgeslagen="opgeslagen" />
  </div>
</template>

<style scoped>
.gb-acties { display: flex; gap: 6px; }
.gb-acties .dd-act { display: inline-flex; align-items: center; justify-content: center; gap: 6px; white-space: nowrap; }
.gb-ico { width: 36px; height: 36px; padding: 0; }
.gb-ico-tekst { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.gb-tabel select.invoer { width: auto; max-width: 100%; }
.gb-tabel th, .gb-tabel td { padding-left: 8px; padding-right: 8px; }
.gb-status { min-width: 96px; font-size: 13px; }
.gb-status > span { display: block; }
.gb-inlog { display: block; margin-top: 2px; color: var(--muted); font-size: 12px; }
.gb-wrap { overflow-x: auto; }
.gb-archief { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; list-style: none; }
.gb-archief-rij { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.gb-archief-rij .gebruiker-cel { flex: 1 1 260px; min-width: 0; }
.gb-heractiveer { min-height: var(--touch-target-min); }
.gb-fout { flex-basis: 100%; margin: 0; color: var(--red); font-size: 13px; font-weight: 600; }
.gb-fout a { margin-left: 6px; color: var(--ink); }
@media (max-width: 767px) {
  .gb-acties .dd-act { min-height: var(--touch-target-min); }
  .gb-ico { width: auto; height: auto; padding: 0 14px; }
  .gb-ico-tekst { position: static; width: auto; height: auto; overflow: visible; clip: auto; }
  .gb-heractiveer { width: 100%; justify-content: center; }
}
</style>
