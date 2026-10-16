<script setup lang="ts">
// De coachingkaart (P21, F20): kop met niveau, cijfers tegen norm en team, de funnel naast die van het team,
// drie gesprekken om te bespreken, hoogstens drie coachingpunten (pas zichtbaar na Deel), afspraken,
// privénotities en historie. Op de telefoon: punten en afspraken eerst, cijfers ingeklapt.
import { NIVEAU_LABEL } from '~~/shared/types'
import { NORMEN } from '~~/shared/team'
const route = useRoute()
const toast = useToast()
const { functie } = useMe()
const { data: k, refresh, error } = await useFetch<any>(() => `/api/coaching/${route.params.id}`)
const pct = (m: { waarde: number; noemer: number | null } | null | undefined) => (!m || !m.noemer ? '-' : `${Math.round(m.waarde * 100)}%`)
const kort = (n: string) => n?.replace(/^Testgebruiker /, '') ?? ''
const punten = ref<any[]>([])
watch(() => k.value?.sessie, (s) => { punten.value = JSON.parse(JSON.stringify(s?.punten ?? [])) }, { immediate: true })
async function nieuweSessie() {
  try { await $fetch(`/api/coaching/${route.params.id}/sessie`, { method: 'POST', body: { datum: new Date().toISOString().slice(0, 10) } }); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const coachBezig = ref(false)
async function coach() {
  coachBezig.value = true
  try { await $fetch(`/api/coaching/${route.params.id}/voorstel`, { method: 'POST' }); toast.toon('De Coach stelde punten voor. Ze zijn nog niet gedeeld.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { coachBezig.value = false }
}
async function bewaarPunten(melding?: string) {
  if (!k.value.sessie) return
  try { await $fetch(`/api/coaching/sessie/${k.value.sessie.id}`, { method: 'PUT', body: { punten: punten.value } }); if (melding) toast.toon(melding); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
function deel(i: number) { punten.value[i].gedeeld = true; bewaarPunten('Coachingpunt gedeeld.') }
const nieuw = reactive({ soort: 'afspraak', tekst: '', termijn: '' })
async function voegNotitieToe() {
  try {
    await $fetch(`/api/coaching/${route.params.id}/notities`, { method: 'POST', body: { soort: nieuw.soort, tekst: nieuw.tekst, termijn: nieuw.termijn || null, sessieId: k.value.sessie?.id ?? null, sleutel: crypto.randomUUID() } })
    toast.toon(nieuw.soort === 'afspraak' ? 'Afspraak vastgelegd en gedeeld.' : 'Privénotitie bewaard.'); Object.assign(nieuw, { soort: 'afspraak', tekst: '', termijn: '' }); await refresh()
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function zetStatus(id: string, status: string) { try { await $fetch(`/api/coaching/notities/${id}`, { method: 'PUT', body: { status } }); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') } }
const planMoment = ref('')
async function plan() {
  try { const r = await $fetch<any>(`/api/coaching/${route.params.id}/plan`, { method: 'POST', body: { start: planMoment.value } }); toast.toon(r.tekst); planMoment.value = '' } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const trendMax = computed(() => Math.max(1, ...((k.value?.cijfers?.trend ?? []) as any[]).map((t) => t.pogingen)))
const SOORT_LABEL: Record<string, string> = { goed: 'Een goede', verloren: 'Een verloren', bezwaar: 'Vaak terugkomend bezwaar' }
useHead({ title: computed(() => `Coaching ${kort(k.value?.persoon?.naam ?? '')} · Dealtrace`) })
</script>

<template>
  <div>
    <LegeStaat v-if="error" class="mt-16" titel="Deze persoon valt niet onder jou." tekst="Je ziet alleen de coachingkaarten van je eigen teams." />
    <template v-else-if="k">
      <PaginaKop :kicker="`Coaching · ${NIVEAU_LABEL[k.persoon.niveau as 'beginner']} · ${k.persoon.werkplek}`" :titel="kort(k.persoon.naam)" helpartikel="coachingsgesprek">
        <template #acties><NuxtLink v-if="k.kan.niveau" class="dd-actie dd-actie--secundair" :to="`/team#niveaus`">Wijzig niveau</NuxtLink></template>
      </PaginaKop>
      <section class="section">
        <div class="container cg-kaart">
          <article class="kaart cg-punten" data-test="coachingpunten">
            <header class="kaart-kop"><h2 class="kaart-titel">Coachingpunten</h2>
              <span class="dd-acties"><button v-if="!k.sessie" type="button" class="dd-act" @click="nieuweSessie">Nieuw gesprek</button><button v-if="k.kan.coach" type="button" class="dd-act" :disabled="coachBezig" data-test="coach-voorstel" @click="coach"><Icoon naam="Sparkles" class="dd-actie-icoon" />Laat de Coach voorstellen</button></span></header>
            <p v-if="!punten.length" class="kaart-meta">Nog geen coachingpunten. Schrijf er zelf een of laat de Coach er hoogstens drie voorstellen.</p>
            <div v-for="(p, i) in punten" :key="i" class="cg-punt">
              <textarea v-model="p.tekst" class="invoer" rows="2" :aria-label="`Coachingpunt ${i + 1}`" @change="bewaarPunten()" />
              <p v-if="p.onderbouwing?.cijfers?.length" class="meta">{{ p.onderbouwing.cijfers.join(' · ') }}<template v-if="p.artikelSleutel"> · <NuxtLink :to="`/help/${p.artikelSleutel}`">artikel</NuxtLink></template></p>
              <div class="dd-acties"><span v-if="p.gedeeld" class="pil pil--groen">Gedeeld</span><button v-else type="button" class="dd-act dd-act--primair" :data-test="`deel-${i}`" @click="deel(i)">Deel</button><button type="button" class="dd-act" @click="punten.splice(i, 1); bewaarPunten()">Weg</button></div>
            </div>
            <button v-if="k.sessie && punten.length < 3" type="button" class="dd-act mt-8" @click="punten.push({ tekst: '', gedeeld: false })">+ Punt</button>
          </article>

          <article class="kaart" data-test="afspraken">
            <h2 class="kaart-titel">Afspraken</h2>
            <ul class="schakel-lijst">
              <li v-for="a in k.afspraken" :key="a.id" class="schakel-rij cg-afspraak"><span>{{ a.tekst }}<br><span class="meta">{{ a.termijn ? `Termijn ${a.termijn}` : 'Geen termijn' }}<template v-if="a.reactie"> · Reactie: {{ a.reactie.tekst }}</template></span></span>
                <select class="invoer invoer--klein" :value="a.status" aria-label="Status" @change="zetStatus(a.id, ($event.target as HTMLSelectElement).value)"><option value="open">Open</option><option value="gehaald">Gehaald</option><option value="niet_gehaald">Niet gehaald</option></select></li>
            </ul>
            <p v-if="k.afsprakenGehaald.noemer" class="meta">Gehaald: {{ pct(k.afsprakenGehaald) }} van {{ k.afsprakenGehaald.noemer }} (norm {{ NORMEN.afsprakenGehaald * 100 }}%)</p>
            <form class="cg-nieuw mt-8" @submit.prevent="voegNotitieToe">
              <select v-model="nieuw.soort" class="invoer invoer--klein" aria-label="Soort"><option value="afspraak">Afspraak (ziet de accountmanager)</option><option value="prive">Privé (alleen managers)</option></select>
              <input v-model="nieuw.tekst" class="invoer" placeholder="Doel, gedrag en termijn" aria-label="Tekst" data-test="notitie-tekst">
              <input v-if="nieuw.soort === 'afspraak'" v-model="nieuw.termijn" type="date" class="invoer invoer--klein" aria-label="Termijn">
              <button type="submit" class="dd-act" :disabled="!nieuw.tekst.trim()" data-test="notitie-opslaan">+ {{ nieuw.soort === 'afspraak' ? 'Afspraak' : 'Notitie' }}</button>
            </form>
            <details v-if="k.prive.length" class="mt-8"><summary class="meta">Privénotities ({{ k.prive.length }})</summary><ul class="schakel-lijst"><li v-for="n in k.prive" :key="n.id" class="schakel-rij">{{ n.tekst }}</li></ul></details>
          </article>

          <details class="kaart cg-cijfers" data-test="cijfers" open>
            <summary class="kaart-titel">Cijfers tegen norm en team</summary>
            <div class="stat-grid stat-grid--4 mt-8">
              <div class="stat-card"><span class="stat-label">Pogingen per dag</span><span class="stat-num tnum">{{ k.cijfers.kpi.pogingenPerDag.waarde.toLocaleString('nl-NL') }}</span><span class="meta">tempo {{ k.cijfers.tempo.procent }}%</span></div>
              <div class="stat-card"><span class="stat-label">Gesprek naar afspraak</span><span class="stat-num tnum">{{ pct(k.cijfers.conversie.gesprekNaarAfspraak) }}</span><span class="meta">team {{ Math.round((k.cijfers.team?.gesprekNaarAfspraak ?? 0) * 100) }}% · norm 15%</span></div>
              <div class="stat-card"><span class="stat-label">Beslisser bereikt</span><span class="stat-num tnum">{{ pct(k.cijfers.kpi.beslisserBereikt) }}</span><span class="meta">team {{ Math.round((k.cijfers.team?.beslisserBereikt ?? 0) * 100) }}% · norm 20%</span></div>
              <div class="stat-card"><span class="stat-label">Pogingen tot afspraak</span><span class="stat-num tnum">{{ k.cijfers.kpi.pogingenTotAfspraak.noemer ? k.cijfers.kpi.pogingenTotAfspraak.waarde.toLocaleString('nl-NL') : '-' }}</span><span class="meta">norm 4 tot 5</span></div>
              <div class="stat-card"><span class="stat-label">Gepland naar gehouden</span><span class="stat-num tnum">{{ pct(k.cijfers.conversie.geplandNaarGehouden) }}</span></div>
              <div class="stat-card"><span class="stat-label">Gehouden naar overgedragen</span><span class="stat-num tnum">{{ pct(k.cijfers.conversie.gehoudenNaarOvergedragen) }}</span></div>
              <div class="stat-card"><span class="stat-label">Taken op de dag</span><span class="stat-num tnum">{{ pct(k.cijfers.discipline.takenOpDag) }}</span></div>
              <div class="stat-card"><span class="stat-label">Winpunt uitgevoerd</span><span class="stat-num tnum">{{ pct(k.cijfers.discipline.winpuntUitgevoerd) }}</span><span class="meta">norm 90%</span></div>
            </div>
            <div class="cg-trend mt-16" aria-label="Pogingen per week">
              <div v-for="t in k.cijfers.trend" :key="t.van" class="cg-week"><div class="cg-balk" :style="{ height: `${(t.pogingen / trendMax) * 100}%` }" /><span class="meta">{{ t.van.slice(5) }}</span><span class="meta tnum">{{ t.pogingen }} · {{ t.afspraken }} afspr.</span></div>
            </div>
          </details>

          <article class="kaart" data-test="funnel-persoon">
            <h2 class="kaart-titel">Funnel naast het team</h2>
            <ul class="schakel-lijst"><li v-for="f in k.funnel.persoon" :key="f.faseId" class="schakel-rij"><span>{{ f.label }}</span><span class="tnum">{{ f.aantal }} <span class="meta">· team {{ k.funnel.team.find((x: any) => x.faseId === f.faseId)?.aantal ?? 0 }}</span></span></li></ul>
          </article>

          <article class="kaart" data-test="gesprekken">
            <h2 class="kaart-titel">Gesprekken om te bespreken</h2>
            <p v-if="!k.gesprekken.length" class="kaart-meta">Deze week geen gesprekken met een verslag.</p>
            <ul class="schakel-lijst"><li v-for="g in k.gesprekken" :key="g.id" class="schakel-rij"><span><strong>{{ SOORT_LABEL[g.soort] }}</strong>: <NuxtLink v-if="g.accountId" :to="`/accounts/${g.accountId}`">{{ g.account }}</NuxtLink><br><span class="meta">{{ g.uitkomst }} · {{ new Date(g.op).toLocaleDateString('nl-NL') }}<template v-if="g.tekst"> · {{ g.tekst }}</template></span></span></li></ul>
          </article>

          <article v-if="k.oefening" class="kaart kaart--geel"><h2 class="kaart-titel">Oefening</h2><p>{{ k.oefening }}. Er is een nieuwe versie van het verkoopverhaal bevestigd.</p></article>

          <article class="kaart">
            <h2 class="kaart-titel">Plan coachingsgesprek</h2>
            <form class="cg-nieuw" @submit.prevent="plan"><input v-model="planMoment" type="datetime-local" class="invoer" aria-label="Moment" required><button type="submit" class="dd-act" :disabled="!planMoment" data-test="plan-gesprek">Plan coachingsgesprek</button></form>
            <h3 class="kaart-meta mt-16">Historie</h3>
            <ul class="schakel-lijst"><li v-for="h in k.historie" :key="h.id" class="schakel-rij"><span>{{ h.datum }}</span><span class="meta">{{ h.punten }} {{ h.punten === 1 ? 'punt' : 'punten' }} · {{ h.afspraken }} {{ h.afspraken === 1 ? 'afspraak' : 'afspraken' }}</span></li></ul>
          </article>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.cg-kaart { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.cg-cijfers { grid-column: 1 / -1; }
.cg-punt { border-top: 1px solid var(--border); padding: 12px 0; display: grid; gap: 8px; }
.cg-afspraak { gap: 8px; }
.cg-nieuw { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.cg-nieuw .invoer:not(.invoer--klein) { flex: 1 1 200px; }
.cg-trend { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; height: 140px; align-items: end; }
.cg-week { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; gap: 4px; }
.cg-balk { width: 28px; min-height: 2px; background: var(--ink); }
@media (max-width: 767px) {
  .cg-kaart { grid-template-columns: 1fr; }
  .cg-cijfers { order: 3; }
  .cg-cijfers:not([open]) { padding-bottom: 8px; }
}
</style>
