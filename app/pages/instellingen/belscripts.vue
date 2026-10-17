<script setup lang="ts">
// Belscripts in Instellingen (F08): statkaarten als filter, filters in de URL, de tabel en de
// editor. Wie beheert (salesmanager, beheerder) maakt, activeert en archiveert; Expert ziet de
// vergelijking. Beter op een groot scherm.
import { DOEL_LABEL, SCRIPT_DOELEN, TE_WEINIG } from '~~/shared/belscripts'
const { functie } = useMe()
const aan = !!functie('belscript.kiezen')?.beschikbaar
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { data, refresh } = await useFetch<any>('/api/belscripts', { immediate: aan, default: () => ({ scripts: [], mijn: [], tellers: {}, kan: {}, teams: [] }) })
const filter = computed(() => ({ doel: (route.query.doel as string) || '', status: (route.query.status as string) || '' }))
const zet = (q: Record<string, string | undefined>) => router.replace({ query: { ...route.query, ...q } })
const lijst = computed(() => data.value.scripts.filter((s: any) => (!filter.value.doel || s.doel === filter.value.doel) && (!filter.value.status || s.status === filter.value.status)).sort((a: any, b: any) => b.bijgewerktOp.localeCompare(a.bijgewerktOp)))
const open = ref<string | null>((route.query.script as string) || null)
const teamNaam = (ids: any) => (ids === 'alle' ? 'Alle' : (ids as string[]).map((i) => data.value.teams.find((t: any) => t.id === i)?.naam ?? i).join(', ') || 'Geen')
const datum = (iso: string) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' }).format(new Date(iso))
async function nieuw() {
  try { const r = await $fetch<any>('/api/belscripts', { method: 'POST', body: { naam: 'Nieuw script', doel: filter.value.doel || 'koud' } }); await refresh(); open.value = r.id } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function opzet() {
  try { const r = await $fetch<any>('/api/belscripts/opzet', { method: 'POST', body: { doel: filter.value.doel || 'koud' } }); await refresh(); open.value = r.id; toast.toon('Opzet gemaakt als concept. Controleer en activeer.') } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function startset() {
  try { const r = await $fetch<any>('/api/belscripts/startset', { method: 'POST' }); toast.toon(r.toegevoegd ? `${r.toegevoegd} scripts uit de startset toegevoegd.` : 'De startset staat er al.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const STATUS: Record<string, string> = { concept: 'Concept', actief: 'Actief', gearchiveerd: 'Gearchiveerd' }
useHead({ title: 'Belscripts · Instellingen · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="belscript.kiezen" />
    <template v-else>
      <PaginaKop kicker="Instellingen · Verkoop" titel="Belscripts" uitleg="Standaardscripts die je team kiest in het belpaneel. AI vult per account de aanleiding en het winpunt in." helpartikel="belscripts-maken">
        <template #acties>
          <FunctieLink v-if="!data.kan.beheer" to="/belscripts" class="dd-actie dd-actie--secundair" data-test="naar-studio"><Icoon naam="ScrollText" class="dd-actie-icoon" />Belscript Studio</FunctieLink>
          <template v-else>
          <button type="button" class="dd-actie dd-actie--primair" data-test="nieuw-script" @click="nieuw"><Icoon naam="Plus" class="dd-actie-icoon" />Nieuw script</button>
          <button type="button" class="dd-actie dd-actie--secundair" data-test="ai-opzet" @click="opzet"><Icoon naam="Sparkles" class="dd-actie-icoon" />AI-opzet</button>
          <!-- Minder gebruikt: onder Meer, zodat de kop op 1280 px op één regel blijft. -->
          <KopMeer :items="[{ label: 'Kopieer uit startset', icoon: 'Copy', actie: startset, test: 'kopieer-startset' }, { label: 'Belscript Studio', icoon: 'ScrollText', to: '/belscripts', test: 'naar-studio' }]" />
          </template>
        </template>
      </PaginaKop>
      <section class="section section--laatste">
        <div class="container">
          <p class="alleen-groot-melding kaart kaart--geel">Beter op een groot scherm.</p>
          <p v-if="!data.kan.beheer" class="kaart kaart--geel mt-8">Je kunt meekijken. Je salesmanager maakt en activeert de scripts.<template v-if="data.kan.variant"> Een eigen variant maak je bij <FunctieLink als-tekst to="/instellingen/mijn-scripts">Mijn scripts</FunctieLink>.</template></p>
          <div class="stat-grid stat-grid--4 mt-16">
            <button type="button" class="stat-card" :class="{ 'stat-card--actief': filter.status === 'actief' }" @click="zet({ status: filter.status === 'actief' ? undefined : 'actief' })"><span class="stat-label">Actief</span><span class="stat-num tnum">{{ data.tellers.actief ?? 0 }}</span></button>
            <button type="button" class="stat-card" :class="{ 'stat-card--actief': filter.status === 'concept' }" @click="zet({ status: filter.status === 'concept' ? undefined : 'concept' })"><span class="stat-label">Concept</span><span class="stat-num tnum">{{ data.tellers.concept ?? 0 }}</span></button>
            <div class="stat-card"><span class="stat-label">Gebruikt in 30 dagen</span><span class="stat-num tnum">{{ data.tellers.gebruikt30 ?? 0 }}</span></div>
            <div class="stat-card"><span class="stat-label">Beste conversie</span><span class="stat-num">{{ data.tellers.beste ? data.tellers.beste.conversie : '–' }}</span><span v-if="data.tellers.beste" class="meta">{{ data.tellers.beste.naam }}</span></div>
          </div>
          <div class="rijtje mt-16">
            <label class="veld"><span class="veld-label">Doel</span><select class="invoer" :value="filter.doel" @change="zet({ doel: ($event.target as HTMLSelectElement).value || undefined })"><option value="">Alle doelen</option><option v-for="d in SCRIPT_DOELEN" :key="d" :value="d">{{ DOEL_LABEL[d] }}</option></select></label>
            <label class="veld"><span class="veld-label">Status</span><select class="invoer" :value="filter.status" @change="zet({ status: ($event.target as HTMLSelectElement).value || undefined })"><option value="">Alle</option><option v-for="(l, k) in STATUS" :key="k" :value="k">{{ l }}</option></select></label>
          </div>
          <LegeStaat v-if="!data.scripts.length" class="mt-16" titel="Er zijn nog geen belscripts. Begin met de startset van zes scripts." tekst="" />
          <div v-else class="tabel-schuif mt-16">
            <table class="tabel" data-test="script-tabel">
              <thead><tr><th>Naam</th><th>Doel</th><th>Teams</th><th>Versie</th><th>Status</th><th>Gesprekken 30 d</th><th>Naar afspraak</th><th>Laatst gewijzigd</th></tr></thead>
              <tbody>
                <tr v-for="s in lijst" :key="s.id" class="tabel-rij--klik" :data-test="`script-${s.naam}`" @click="open = s.id">
                  <td><strong>{{ s.naam }}</strong><span v-if="s.controleren" class="pil pil--geel">Controleren</span></td><td>{{ s.doelLabel }}</td><td>{{ teamNaam(s.data.teamIds) }}</td><td class="tnum">{{ s.versie }}</td>
                  <td><span class="pil pil--leeg">{{ STATUS[s.status] }}</span></td><td class="tnum">{{ s.gesprekken30 }}</td><td>{{ s.conversie ?? '–' }}</td><td>{{ datum(s.bijgewerktOp) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <article v-if="data.vergelijking" class="kaart mt-24" data-test="vergelijking">
            <h2 class="kaart-titel">Scripts vergelijken</h2>
            <p v-if="data.vergelijking.melding" class="kaart-meta">{{ data.vergelijking.melding === TE_WEINIG ? 'Te weinig gesprekken om te vergelijken.' : data.vergelijking.melding }} Per versie zijn minimaal 30 gesprekken nodig.</p>
            <p v-else class="kaart-meta">Beste: {{ data.scripts.find((s: any) => s.id === data.vergelijking.beste.scriptId)?.naam }} versie {{ data.vergelijking.beste.versie }}, {{ data.vergelijking.beste.conversie }} procent naar afspraak.</p>
          </article>
        </div>
      </section>
      <ScriptEditor :script-id="open" :teams="data.teams" :kan-bezwaren="data.kan.beheer || data.kan.vergelijken" @sluit="open = null" @gewijzigd="refresh()" />
    </template>
  </div>
</template>
