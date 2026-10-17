<script setup lang="ts">
// Team (P21, F20, 8.12): controle in tien minuten. Tabel per persoon met klikbare cellen, aandachtspunten,
// werkverdeling met Verplaats, goedkeuringen en het niveau per persoon. Op de telefoon drie stapels en per
// persoon één regel die een schuifvenster met de cijfers opent.
import { NIVEAU_LABEL, NIVEAUS } from '~~/shared/types'
const { functie } = useMe()
const aan = computed(() => !!functie('nav.team')?.beschikbaar)
const route = useRoute()
const router = useRouter()
const toast = useToast()
const query = computed(() => ({ team: route.query.team || undefined, periode: route.query.periode || undefined }))
const { data, refresh } = await useFetch<any>('/api/team', { query, immediate: aan.value, default: () => ({ rijen: [], teams: [], aandachtspunten: [], werkverdeling: [], goedkeuringen: [], stapels: { zonderVerslag: [], nietOvergedragen: [], achterOpRitme: [] } }) })
function zet(k: string, v: string) { router.replace({ query: { ...route.query, [k]: v || undefined } }) }
const PERIODES = [['vandaag', 'Vandaag'], ['week', 'Deze week'], ['maand', 'Deze maand'], ['kwartaal', 'Kwartaal']] as const
// Sorteren op elke kolom; standaard achter op schema eerst.
const sortering = ref<{ k: string; op: boolean }>({ k: 'tempo', op: true })
const waarde = (r: any, k: string) => (k === 'tempo' ? r.tempo.procent : k === 'naam' ? r.naam : k.startsWith('kpi.') ? r.kpi[k.slice(4)] : r[k])
const rijen = computed(() => [...data.value.rijen].sort((a: any, b: any) => { const x = waarde(a, sortering.value.k); const y = waarde(b, sortering.value.k); const c = typeof x === 'string' ? x.localeCompare(y) : (x ?? -1) - (y ?? -1); return sortering.value.op ? c : -c }))
function sorteer(k: string) { sortering.value = { k, op: sortering.value.k === k ? !sortering.value.op : k === 'tempo' } }
const KOLOMMEN: { k: string; label: string; cel?: string }[] = [
  { k: 'afgerondProcent', label: 'Taken op de dag', cel: 'afgerondOpDag' }, { k: 'achterstallig', label: 'Achterstallig', cel: 'achterstallig' },
  { k: 'kpi.pogingen', label: 'Pogingen', cel: 'pogingen' }, { k: 'kpi.gesprekken', label: 'Gesprekken', cel: 'gesprekken' }, { k: 'kpi.beslisser', label: 'Beslisser', cel: 'beslisser' },
  { k: 'kpi.afspraken', label: 'Afspraken', cel: 'afspraken' }, { k: 'afsprakenGehouden', label: 'Gehouden', cel: 'afsprakenGehouden' }, { k: 'overgedragen', label: 'Overgedragen', cel: 'overgedragen' },
  { k: 'belblokkenGehouden', label: 'Belblokken', cel: 'belblokkenGehouden' }, { k: 'conceptenWachten', label: 'Concepten', cel: 'concepten' },
]
const tekstCel = (r: any, k: string) => (k === 'afgerondProcent' ? (r.afgerondProcent == null ? '-' : `${r.afgerondProcent}%`) : k === 'kpi.pogingen' ? `${r.kpi.pogingen} / ${r.tempo.norm}` : k === 'belblokkenGehouden' ? `${r.belblokkenGehouden} / ${r.belblokkenGepland}` : String(waarde(r, k) ?? 0))
// De lijst achter een cel.
const cel = ref<{ titel: string; records: any[] } | null>(null)
async function openCel(r: any, metriek: string, label: string) {
  try { const x = await $fetch<any>('/api/team/cel', { query: { gebruiker: r.id, metriek, periode: route.query.periode || 'vandaag', team: route.query.team } }); cel.value = { titel: `${r.naam.replace(/^Testgebruiker /, '')}: ${label}`, records: x.records } } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const persoon = ref<any>(null)
// Werkverdeling en Verplaats.
const verplaats = ref<{ van: string; fase: string; label?: string } | null>(null)
const naar = ref('')
const reden = ref('')
async function doeVerplaats() {
  try {
    const r = await $fetch<any>('/api/accounts/verplaats', { method: 'POST', body: { van: { gebruiker: verplaats.value!.van, fase: verplaats.value!.fase }, naarGebruiker: naar.value, reden: reden.value } })
    toast.toon(`${r.aantal} accounts verplaatst.`); verplaats.value = null; reden.value = ''; await refresh()
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
// Niveau per persoon (4.2): geen voorstellen, de salesmanager kiest.
const niveauVraag = ref<{ id: string; naam: string; van: string; naar: string } | null>(null)
async function zetNiveau(reden?: string) {
  const n = niveauVraag.value!
  try { await $fetch(`/api/gebruikers/${n.id}/niveau`, { method: 'POST', body: { niveau: n.naar, reden } }); toast.toon(`${n.naam} staat nu op ${NIVEAU_LABEL[n.naar as 'beginner'].toLowerCase()}.`); niveauVraag.value = null; await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const kort = (n: string) => n.replace(/^Testgebruiker /, '')
// P23: de wekelijkse bundel suggesties naar SalesDNA, als regel onder de goedkeuringen.
const suggestiesAan = computed(() => !!functie('salesdna.suggesties.vrijgeven')?.beschikbaar)
const { data: sg, refresh: verversSg } = await useFetch<any>('/api/salesdna/suggesties', { immediate: aan.value && suggestiesAan.value, default: () => null })
const sgOpen = computed({ get: () => route.query.suggesties === '1', set: (v: boolean) => zet('suggesties', v ? '1' : '') })
const sgRegel = computed(() => sg.value ? `Suggesties naar SalesDNA · week ${Number(String(sg.value.week).split('-W')[1])} · ${sg.value.open} ${sg.value.open === 1 ? 'suggestie' : 'suggesties'}` : null)
useHead({ title: 'Team · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="nav.team" />
    <template v-else>
      <PaginaKop :kicker="`Team ${data.team?.naam ?? ''} · ${data.periode?.label ?? ''}`" :titel="data.kop ?? 'Team'" helpartikel="team-controleren" />
      <section class="section">
        <div class="container">
          <LegeStaat v-if="!data.team" titel="Je bent nog geen eigenaar van een team." tekst="Vraag je beheerder om je aan een team te koppelen." />
          <template v-else>
            <div class="cp-filters">
              <label class="veld"><span class="veld-label">Team</span><select class="invoer" :value="data.team.id" data-test="team-keuze" @change="zet('team', ($event.target as HTMLSelectElement).value)"><option v-for="t in data.teams" :key="t.id" :value="t.id">{{ t.naam }}</option></select></label>
              <div class="cp-tonen" role="radiogroup" aria-label="Periode"><button v-for="[k, l] in PERIODES" :key="k" type="button" class="filter-pil" :class="{ 'filter-pil--aan': (route.query.periode ?? 'vandaag') === k }" :aria-pressed="(route.query.periode ?? 'vandaag') === k" @click="zet('periode', k === 'vandaag' ? '' : k)">{{ l }}</button></div>
            </div>

            <div class="alleen-telefoon mt-16" data-test="team-stapels">
              <article v-for="[k, titel] in [['zonderVerslag', 'Gesprekken zonder verslag'], ['nietOvergedragen', 'Eerste afspraken nog niet overgedragen'], ['achterOpRitme', 'Achter op het ritme']]" :key="k" class="kaart mt-8">
                <h2 class="kaart-titel">{{ titel }}</h2>
                <p v-if="!data.stapels[k].length" class="kaart-meta">Niets.</p>
                <ul v-else class="schakel-lijst"><li v-for="p in data.stapels[k]" :key="p.id" class="schakel-rij"><span>{{ kort(p.naam) }}</span><span class="pil pil--leeg">{{ p.aantal }}</span></li></ul>
              </article>
            </div>

            <article class="kaart mt-16" data-test="aandachtspunten">
              <h2 class="kaart-titel">Aandachtspunten</h2>
              <p v-if="!data.aandachtspunten.length" class="kaart-meta">Niets dat opvalt in deze periode.</p>
              <ul v-else class="schakel-lijst"><li v-for="a in data.aandachtspunten" :key="a.tekst" class="schakel-rij">{{ a.tekst }}</li></ul>
            </article>

            <div class="tabel-schuif mt-16 alleen-groot-blok">
              <table class="tabel tm-tabel" data-test="team-tabel">
                <thead><tr>
                  <th><button type="button" class="tm-sorteer" @click="sorteer('naam')">Naam</button></th>
                  <th v-for="k in KOLOMMEN" :key="k.k"><button type="button" class="tm-sorteer" @click="sorteer(k.k)">{{ k.label }}</button></th>
                  <th><button type="button" class="tm-sorteer" @click="sorteer('tempo')">Tempo</button></th>
                </tr></thead>
                <tbody>
                  <tr v-for="r in rijen" :key="r.id" :data-test="`team-rij-${r.id}`">
                    <td><NuxtLink :to="`/coaching/${r.id}`">{{ kort(r.naam) }}</NuxtLink><br><span class="meta">{{ NIVEAU_LABEL[r.niveau as 'beginner'] }} · {{ r.werkplek }}</span></td>
                    <td v-for="k in KOLOMMEN" :key="k.k" class="tnum"><button type="button" class="tm-cel" :data-test="`cel-${r.id}-${k.cel}`" @click="openCel(r, k.cel!, k.label)">{{ tekstCel(r, k.k) }}</button></td>
                    <td><span class="pil" :class="r.tempo.stand === 'op schema' ? 'pil--groen' : r.tempo.stand === 'achter' ? 'pil--rood' : 'pil--leeg'">{{ r.tempo.stand === 'geen' ? 'Geen werkdag' : r.tempo.stand === 'op schema' ? 'Op schema' : 'Achter op schema' }}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <ul class="alleen-telefoon schakel-lijst mt-16" data-test="team-lijst">
              <li v-for="r in rijen" :key="r.id" class="schakel-rij"><button type="button" class="tm-persoon" @click="persoon = r"><span>{{ kort(r.naam) }}</span><span class="pil" :class="r.tempo.stand === 'op schema' ? 'pil--groen' : 'pil--rood'">{{ r.tempo.procent }}%</span><span class="meta">{{ r.achterstallig }} achterstallig</span></button></li>
            </ul>

            <div class="raster raster--2 mt-16">
              <article class="kaart" data-test="werkverdeling">
                <h2 class="kaart-titel">Werkverdeling</h2>
                <ul class="schakel-lijst">
                  <li v-for="p in data.werkverdeling" :key="p.id" class="schakel-rij tm-verdeling"><strong>{{ kort(p.naam) }}</strong>
                    <span class="chips"><button v-for="f in p.fases" :key="`${f.fase}-${f.status}`" type="button" class="chip" :title="`Verplaats ${f.label ?? f.fase}`" @click="verplaats = { van: p.id, fase: f.fase, label: f.label }">{{ f.label ?? f.fase }} · {{ f.aantal }}</button></span></li>
                </ul>
              </article>
              <article class="kaart" data-test="goedkeuringen">
                <h2 class="kaart-titel">Wacht op jouw goedkeuring</h2>
                <p v-if="!data.goedkeuringen.length && !sg?.open" class="kaart-meta">Niets.</p>
                <ul class="schakel-lijst">
                  <li v-if="suggestiesAan && sgRegel" class="schakel-rij" data-test="suggesties-regel"><button type="button" class="tekst-link" @click="sgOpen = true">{{ sgRegel }}</button><span class="meta">SalesDNA</span></li>
                  <li v-for="g in data.goedkeuringen" :key="g.id" class="schakel-rij"><NuxtLink :to="g.link">{{ g.titel }}</NuxtLink><span class="meta">{{ g.soort }}</span></li>
                </ul>
              </article>
            </div>

            <article class="kaart mt-16" data-test="niveaus">
              <h2 class="kaart-titel">Niveau per persoon</h2>
              <p class="kaart-meta">Een hoger niveau is jouw besluit. Dealtrace doet daar geen voorstel voor.</p>
              <ul class="schakel-lijst">
                <li v-for="r in data.rijen" :key="r.id" class="schakel-rij"><span>{{ kort(r.naam) }}</span>
                  <select class="invoer invoer--klein tm-niveau" :value="r.niveau" :aria-label="`Niveau van ${kort(r.naam)}`" :data-test="`niveau-${r.id}`" @change="niveauVraag = { id: r.id, naam: kort(r.naam), van: r.niveau, naar: ($event.target as HTMLSelectElement).value }"><option v-for="n in NIVEAUS" :key="n" :value="n">{{ NIVEAU_LABEL[n] }}</option></select></li>
              </ul>
            </article>
          </template>
        </div>
      </section>

      <FlyoutShell v-if="cel || persoon" open titel-id="fs-team0" breedte="smal" data-test="team-venster" @sluit="cel = null; persoon = null">
          <template #kop><span class="fo-kicker">{{ cel ? `${cel.records.length} records` : 'Cijfers' }}</span><h2 id="fs-team0" class="fo-titel">{{ cel?.titel ?? kort(persoon.naam) }}</h2></template>
            <div class="fo-body">
              <ul v-if="cel" class="schakel-lijst" data-test="cel-lijst"><li v-for="x in cel.records" :key="x.id" class="schakel-rij"><span><NuxtLink v-if="x.link" :to="x.link">{{ x.titel }}</NuxtLink><template v-else>{{ x.titel }}</template><br><span class="meta">{{ x.meta }}</span></span></li></ul>
              <ul v-else class="schakel-lijst">
                <li v-for="k in KOLOMMEN" :key="k.k" class="schakel-rij"><button type="button" class="tm-persoon" @click="openCel(persoon, k.cel!, k.label); persoon = null"><span>{{ k.label }}</span><strong class="tnum">{{ tekstCel(persoon, k.k) }}</strong></button></li>
              </ul>
            </div>
        </FlyoutShell>
      <FlyoutShell v-if="verplaats" open titel-id="fs-team1" breedte="smal" @sluit="verplaats = null">
          <template #kop><span class="fo-kicker">Verplaats</span><h2 id="fs-team1" class="fo-titel">Accounts in {{ verplaats.label ?? verplaats.fase }}</h2></template>
        <form id="tv-form" class="fs-form" @submit.prevent="doeVerplaats">
            <div class="fo-body fo-body--formulier">
              <label class="veld"><span class="veld-label">Naar</span><select v-model="naar" class="invoer" required data-test="verplaats-naar"><option value="" disabled>Kies een collega</option><option v-for="r in data.rijen.filter((x: any) => x.id !== verplaats!.van)" :key="r.id" :value="r.id">{{ kort(r.naam) }}</option></select></label>
              <label class="veld"><span class="veld-label">Reden</span><input v-model="reden" class="invoer" required placeholder="Bijvoorbeeld: verlof" data-test="verplaats-reden"></label>
            </div>
        </form>
          <template #voet>
            <footer class="fo-foot fs-voet">
          <button type="submit" form="tv-form" class="dd-actie dd-actie--zwart fs-hoofdactie" :disabled="!naar || !reden.trim()"><Icoon naam="Check" :grootte="16" />Verplaats</button>
          <span class="fo-foot-vul" />
        </footer>
          </template>
        </FlyoutShell>
      <BevestigVenster :open="!!niveauVraag" :titel="`Niveau van ${niveauVraag?.naam ?? ''} wijzigen?`" :tekst="`Van ${NIVEAU_LABEL[(niveauVraag?.van ?? 'beginner') as 'beginner']} naar ${NIVEAU_LABEL[(niveauVraag?.naar ?? 'beginner') as 'beginner']}. Functies die aangaan, krijgen een melding met uitleg.`" bevestig="Wijzig niveau" :met-reden="!!niveauVraag && NIVEAUS.indexOf(niveauVraag.naar as any) < NIVEAUS.indexOf(niveauVraag.van as any)" @bevestigd="zetNiveau" @geannuleerd="niveauVraag = null; refresh()" />
    </template>
    <SuggestiesFlyout :open="sgOpen" @sluit="sgOpen = false" @gewijzigd="verversSg()" />
  </div>
</template>

<style scoped>
.tm-tabel th, .tm-tabel td { white-space: nowrap; }
.tm-sorteer, .tm-cel { all: unset; cursor: pointer; min-height: 32px; display: inline-flex; align-items: center; }
.tm-cel { text-decoration: underline dotted; }
.tm-persoon { all: unset; cursor: pointer; display: flex; gap: 12px; align-items: center; justify-content: space-between; width: 100%; min-height: 44px; }
.tm-verdeling { flex-wrap: wrap; gap: 8px; }
.tm-niveau { width: auto; min-width: 160px; flex: 0 0 auto; }
@media (max-width: 767px) { .alleen-groot-blok { display: none; } }
</style>
