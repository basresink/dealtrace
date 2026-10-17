<script setup lang="ts">
// Analyse (P21, F20): tabbladen Funnel, Activiteit, Campagnes, Scripts, Regels en agents, Reizen, Bronnen,
// Regio en Prospectmix. Filters in de URL; elk tabblad heeft Download CSV met precies de getoonde rijen.
// Op de telefoon alleen lezen.
const { functie } = useMe()
const aan = computed(() => !!functie('nav.analyse')?.beschikbaar)
const route = useRoute()
const router = useRouter()
const toast = useToast()
const TABS = [['funnel', 'Funnel'], ['activiteit', 'Activiteit'], ['campagnes', 'Campagnes'], ['scripts', 'Scripts'], ['regels', 'Regels en agents'], ['reizen', 'Reizen'], ['bronnen', 'Bronnen'], ['regio', 'Regio'], ['prospectmix', 'Prospectmix']] as const
const tab = computed(() => (TABS.some(([k]) => k === route.query.tab) ? String(route.query.tab) : 'funnel'))
const filters = computed(() => ({ periode: route.query.periode || undefined, team: route.query.team || undefined, persoon: route.query.persoon || undefined }))
const { data, refresh } = await useFetch<any>(() => `/api/analyse/${tab.value === 'regio' ? 'funnel' : tab.value}`, { query: filters, immediate: aan.value, default: () => ({ tabellen: [] }) })
const { data: team } = await useFetch<any>('/api/coaching', { immediate: aan.value, default: () => ({ teams: [], leden: [] }) })
function zet(k: string, v: string) { router.replace({ query: { ...route.query, [k]: v || undefined } }) }
watch(tab, (t) => { if (t === 'regio') navigateTo('/bezoek-analyse?scope=team') })
const csv = (i: number) => `/api/analyse/${tab.value}?${new URLSearchParams({ ...(Object.fromEntries(Object.entries(filters.value).filter(([, v]) => v)) as Record<string, string>), formaat: 'csv', tabel: String(i) }).toString()}`
async function besluit(id: string, b: string) { try { const r = await $fetch<any>(`/api/analyse/voorstellen/${id}`, { method: 'POST', body: { besluit: b } }); toast.toon(b === 'accepteer' ? 'Geaccepteerd. Er staat een conceptversie van de reis klaar.' : b === 'later' ? 'Het voorstel komt over 30 dagen terug.' : 'Voorstel afgewezen.'); if (r.conceptId) navigateTo(`/reizen/${r.conceptId}`); else refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') } }
useHead({ title: 'Analyse · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="nav.analyse" />
    <template v-else>
      <PaginaKop kicker="Analyse" titel="Wat werkt, wat niet en waarom?" helpartikel="analyse-lezen" />
      <section class="section">
        <div class="container">
          <nav class="tabbalk" aria-label="Tabbladen"><button v-for="[k, l] in TABS.filter(([x]) => x !== 'regio' || $magNaar('/bezoek-analyse'))" :key="k" type="button" class="tab" :class="{ 'tab--actief': tab === k }" :data-test="`tab-${k}`" @click="zet('tab', k === 'funnel' ? '' : k)">{{ l }}</button></nav>
          <div class="cp-filters mt-16 alleen-groot">
            <label class="veld"><span class="veld-label">Periode</span><select class="invoer" :value="route.query.periode ?? 'maand'" @change="zet('periode', ($event.target as HTMLSelectElement).value === 'maand' ? '' : ($event.target as HTMLSelectElement).value)"><option value="week">Deze week</option><option value="maand">Deze maand</option><option value="kwartaal">Kwartaal</option></select></label>
            <label class="veld"><span class="veld-label">Team</span><select class="invoer" :value="route.query.team ?? ''" @change="zet('team', ($event.target as HTMLSelectElement).value)"><option value="">Al mijn teams</option><option v-for="t in team.teams" :key="t.id" :value="t.id">{{ t.naam }}</option></select></label>
            <label class="veld"><span class="veld-label">Persoon</span><select class="invoer" :value="route.query.persoon ?? ''" @change="zet('persoon', ($event.target as HTMLSelectElement).value)"><option value="">Iedereen</option><option v-for="l in team.leden" :key="l.id" :value="l.id">{{ l.naam.replace(/^Testgebruiker /, '') }}</option></select></label>
          </div>
          <p class="alleen-telefoon meta mt-8">Alleen lezen. Filters en export: open op laptop.</p>
          <p v-if="data.melding" class="kaart kaart--vlak mt-16">{{ data.melding }}</p>

          <article v-for="(t, i) in (data.tabellen as any[])" :key="t.titel" class="kaart mt-16" :data-test="`analyse-tabel-${i}`">
            <header class="kaart-kop"><h2 class="kaart-titel">{{ t.titel }}</h2><a class="dd-act alleen-groot" :href="csv(i)" :data-test="`csv-${i}`"><Icoon naam="Download" :grootte="14" /> Download CSV</a></header>
            <p v-if="!t.rijen.length" class="kaart-meta">Nog niets in deze periode.</p>
            <div v-else class="tabel-schuif">
              <table class="tabel tabel--kaarten">
                <thead><tr><th v-for="k in t.kolommen" :key="k.sleutel" :class="{ tnum: k.getal }">{{ k.label }}</th></tr></thead>
                <tbody><tr v-for="(r, j) in t.rijen" :key="j"><td v-for="k in t.kolommen" :key="k.sleutel" :class="{ tnum: k.getal, meta: r[k.sleutel] === 'Te weinig om te vergelijken' }" :data-label="k.label">{{ r[k.sleutel] }}</td></tr></tbody>
              </table>
            </div>
          </article>

          <article v-if="tab === 'reizen' && functie('analyse.verbetervoorstel')?.beschikbaar" class="kaart mt-16" data-test="verbetervoorstellen">
            <h2 class="kaart-titel">Verbetervoorstellen van de Coach</h2>
            <p v-if="!data.voorstellen?.length" class="kaart-meta">Geen open voorstellen. De Coach kijkt elke maand naar reisversies met minstens 20 accounts.</p>
            <ul class="schakel-lijst"><li v-for="v in data.voorstellen" :key="v.id" class="schakel-rij an-voorstel"><span><strong>{{ v.titel }}</strong><br>{{ v.voorstel }}<br><span class="meta">{{ (v.onderbouwing?.cijfers ?? []).join(' · ') }}</span></span>
              <span class="dd-acties"><button type="button" class="dd-act dd-act--primair" @click="besluit(v.id, 'accepteer')">Accepteer</button><button type="button" class="dd-act" @click="besluit(v.id, 'wijs-af')">Wijs af</button><button type="button" class="dd-act" @click="besluit(v.id, 'later')">Later</button></span></li></ul>
          </article>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.an-voorstel { flex-wrap: wrap; gap: 8px; }
</style>
