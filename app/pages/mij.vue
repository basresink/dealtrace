<script setup lang="ts">
// Mijn instellingen (F22): profiel, werkplek (alleen lezen), meldingen per soort
// en "Toon minder". Meldingen lopen via de sync-wachtrij en werken ook offline.
import { FUNCTIES } from '~~/shared/functies'
import { kanalenVoor, MELDING_KANAAL_LABEL, MELDING_KANALEN, MELDING_SOORT_LABEL, MELDING_SOORT_UITLEG, MELDING_SOORTEN, type MeldingKanaal, type MeldingSoort } from '~~/shared/kanalen'
import { NIVEAU_LABEL, ROL_LABEL, WERKPLEK_LABEL, type Niveau, type Rol, type Werkplek } from '~~/shared/types'

const { me, laad, functie } = useMe()
const { voegToe } = useSyncQueue()
const toast = useToast()
const { data: ai } = await useFetch<any>('/api/assistent/credits', { default: () => null })
const { data: pers } = await useFetch<{ id: string; data: Record<string, any>; versie: number }>('/api/mij/instellingen')

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
const g = computed(() => me.value!.gebruiker)

// Offline (P30): de stand van het dagpakket, foto's en opnames alleen via wifi, en "Ververs nu".
const dp = useDagpakket()
const bijl = useBijlagen()
onMounted(async () => { if (!dp.pakket.value) dp.pakket.value = await dp.uitOpslag() })
const pakketStand = computed(() => { const p = dp.pakket.value; return p ? `Klaar voor vandaag · ${p.accounts.length} accounts · ${(p.grootte / 1024 / 1024).toLocaleString('nl-NL', { maximumFractionDigits: 1 })} MB · bijgewerkt ${new Date(p.gemaaktOp).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}` : 'Nog geen dagpakket op deze telefoon.' })
async function ververs() { await dp.laad({ forceer: true }); toast.toon(dp.fout.value ?? 'Dagpakket bijgewerkt.', dp.fout.value ? 'fout' : 'succes') }

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
useHead({ title: 'Mijn instellingen · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Mijn instellingen" titel="Mijn instellingen" uitleg="Je profiel, je meldingen en wat je in de zijbalk ziet." helpartikel="mijn-instellingen" />
    <section class="section">
      <div class="container">
        <div class="instellingen-raster">
          <article class="kaart" data-test="profiel">
            <header class="kaart-kop"><h2 class="kaart-titel">Profiel</h2></header>
            <dl class="gegevens">
              <dt>Naam</dt><dd>{{ g.naam }}</dd>
              <dt>E-mail</dt><dd>{{ g.email }}</dd>
              <dt>Rol</dt><dd>{{ ROL_LABEL[g.rol as Rol] }}</dd>
              <dt>Niveau</dt><dd>{{ NIVEAU_LABEL[g.niveau as Niveau] }}</dd>
              <dt>Werkplek</dt><dd>{{ WERKPLEK_LABEL[g.werkplek as Werkplek] }}</dd>
              <dt>Team</dt><dd>{{ me?.team?.naam ?? 'Geen team' }}</dd>
            </dl>
            <p class="veld-uitleg">Je werkplek en niveau stelt je beheerder of salesmanager in.</p>
          </article>
          <article v-if="functie('regels.lezen')?.beschikbaar" class="kaart" data-test="mijn-regels">
            <header class="kaart-kop"><h2 class="kaart-titel">{{ functie('regels.persoonlijk')?.beschikbaar ? 'Mijn regels' : 'Regels bekijken' }}</h2></header>
            <p class="kaart-meta">Welke regels jouw taken en inzichten klaarzetten{{ functie('regels.persoonlijk')?.beschikbaar ? ', en je eigen regels voor je eigen accounts' : '' }}.</p>
            <div class="reis-knoppen mt-16"><NuxtLink to="/instellingen/regels" class="dd-act">Naar de regels</NuxtLink><NuxtLink to="/instellingen/ritme" class="dd-act">Accountmatrix</NuxtLink></div>
          </article>
          <article v-if="functie('belscript.variant')?.beschikbaar" class="kaart" data-test="mijn-scripts-kaart">
            <header class="kaart-kop"><h2 class="kaart-titel">Mijn scripts</h2></header>
            <p class="kaart-meta">Je eigen varianten van de belscripts van je team.</p>
            <div class="reis-knoppen mt-16"><NuxtLink to="/instellingen/mijn-scripts" class="dd-act">Naar mijn scripts</NuxtLink></div>
          </article>
          <article v-if="ai" class="kaart" data-test="mijn-ai-verbruik">
            <header class="kaart-kop"><h2 class="kaart-titel">Jouw AI-verbruik deze maand</h2></header>
            <p class="kaart-meta">{{ ai.eigen.plafond != null ? `${ai.eigen.verbruikt} van ${ai.eigen.plafond} credits` : `${ai.eigen.verbruikt} credits` }} · de organisatie heeft er nog {{ ai.over }} over.</p>
            <ul v-if="ai.eigen.perSoort.length" class="schakel-lijst"><li v-for="s in ai.eigen.perSoort" :key="s.soort" class="schakel-rij"><span>{{ s.soort }}</span><span class="meta tnum">{{ s.handelingen }} keer · {{ s.credits }} credits</span></li></ul>
          </article>
          <MijnToestellen />
          <OnderwegMeldingen :pers="pers ?? null" />
          <article v-if="functie('onderweg.dagpakket')?.beschikbaar" class="kaart" data-test="mijn-offline">
            <header class="kaart-kop"><h2 class="kaart-titel">Offline</h2></header>
            <p class="kaart-meta" data-test="dagpakket-stand">{{ pakketStand }}</p>
            <p class="schakel-rij"><span>Foto's en opnames alleen via wifi versturen</span><Schakelaar :aan="bijl.alleenWifi.value" label="Foto's en opnames alleen via wifi versturen" @wissel="bijl.zetAlleenWifi($event)" /></p>
            <p v-if="bijl.wachtend.value" class="meta">{{ bijl.wachtend.value }} bijlagen wachten op verzending.</p>
            <button type="button" class="dd-act mt-8" :disabled="dp.bezig.value" data-test="dagpakket-ververs" @click="ververs"><Icoon naam="RefreshCw" />Ververs nu</button>
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
          <article class="kaart" data-test="mijn-meldingen">
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
  </div>
</template>
