<script setup lang="ts">
// Mijn dashboard (P21, eerder Mijn resultaten op /resultaten): dezelfde cijfers als op je coachingkaart. Vanaf Gevorderd trend en het
// teamgemiddelde (zonder namen), de afspraken uit coachingsgesprekken met Reageer en de gedeelde punten;
// vanaf Expert "Wat kan ik deze week beter doen?".
const toast = useToast()
const { toon: toonUitleg } = useNietAangezet()
const { data, refresh } = await useFetch<any>('/api/resultaten/mij', { default: () => null })
const pct = (m: { waarde: number; noemer: number | null } | null | undefined) => (!m || !m.noemer ? '-' : `${Math.round(m.waarde * 100)}%`)
const reactie = reactive<Record<string, string>>({})
async function reageer(id: string) { try { await $fetch(`/api/coaching/notities/${id}`, { method: 'PUT', body: { reactie: reactie[id] } }); reactie[id] = ''; toast.toon('Reactie verstuurd.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') } }
const zelf = ref<any[] | null>(null)
const bezig = ref(false)
async function zelfanalyse() { bezig.value = true; try { zelf.value = (await $fetch<any>('/api/coaching/zelfanalyse', { method: 'POST' })).punten } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false } }
const max = computed(() => Math.max(1, ...((data.value?.trend ?? []) as any[]).map((t) => t.pogingen)))
useHead({ title: 'Mijn dashboard · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Mijn dashboard · laatste vier weken" titel="Je cijfers" helpartikel="je-cijfers-lezen">
      <template #acties>
        <NuxtLink to="/data-kwaliteit" class="dd-actie dd-actie--secundair" data-test="knop-data" title="Datakwaliteit"><Icoon naam="Database" class="dd-actie-icoon" />Data</NuxtLink>
      </template>
    </PaginaKop>
    <section v-if="data" class="section">
      <div class="container">
        <div class="stat-grid stat-grid--4" data-test="mijn-cijfers">
          <div class="stat-card"><span class="stat-label">Pogingen</span><span class="stat-num tnum">{{ data.kpi.pogingen }}</span><span v-if="data.team" class="meta">team gemiddeld {{ data.team.pogingen.toLocaleString('nl-NL') }}</span></div>
          <div class="stat-card"><span class="stat-label">Gesprekken</span><span class="stat-num tnum">{{ data.kpi.gesprekken }}</span><span v-if="data.team" class="meta">team gemiddeld {{ data.team.gesprekken.toLocaleString('nl-NL') }}</span></div>
          <div class="stat-card"><span class="stat-label">Afspraken</span><span class="stat-num tnum">{{ data.kpi.afspraken }}</span><span v-if="data.team" class="meta">team gemiddeld {{ data.team.afspraken.toLocaleString('nl-NL') }}</span></div>
          <div class="stat-card"><span class="stat-label">Gesprek naar afspraak</span><span class="stat-num tnum">{{ pct(data.conversie.gesprekNaarAfspraak) }}</span><span class="meta">{{ data.conversie.gesprekNaarAfspraak.noemer }} gesprekken<template v-if="data.team"> · team {{ Math.round(data.team.gesprekNaarAfspraak * 100) }}%</template></span></div>
          <div class="stat-card"><span class="stat-label">Beslisser bereikt</span><span class="stat-num tnum">{{ pct(data.kpi.beslisserBereikt) }}</span></div>
          <div class="stat-card"><span class="stat-label">Gepland naar gehouden</span><span class="stat-num tnum">{{ pct(data.conversie.geplandNaarGehouden) }}</span></div>
          <div class="stat-card"><span class="stat-label">Gehouden naar overgedragen</span><span class="stat-num tnum">{{ pct(data.conversie.gehoudenNaarOvergedragen) }}</span></div>
          <div class="stat-card"><span class="stat-label">Taken op de dag</span><span class="stat-num tnum">{{ pct(data.discipline.takenOpDag) }}</span></div>
        </div>

        <article v-if="data.trend" class="kaart mt-16" data-test="mijn-trend">
          <h2 class="kaart-titel">Trend per week</h2>
          <div class="rs-trend"><div v-for="t in data.trend" :key="t.van" class="rs-week"><div class="rs-balk" :style="{ height: `${(t.pogingen / max) * 100}%` }" /><span class="meta">{{ t.van.slice(5) }}</span><span class="meta tnum">{{ t.pogingen }}</span></div></div>
        </article>

        <article class="kaart mt-16" data-test="mijn-afspraken">
          <h2 class="kaart-titel">Afspraken uit je coachingsgesprek</h2>
          <p v-if="!data.afspraken.length && !data.punten.length" class="kaart-meta">Nog geen afspraken.</p>
          <ul class="schakel-lijst">
            <li v-for="p in data.punten" :key="p.tekst" class="schakel-rij"><span><strong>Coachingpunt</strong>: {{ p.tekst }}<br><span class="meta">{{ (p.onderbouwing?.cijfers ?? []).join(' · ') }}<template v-if="p.artikelSleutel"> · <NuxtLink :to="`/help/${p.artikelSleutel}`">artikel</NuxtLink></template></span></span></li>
            <li v-for="a in data.afspraken" :key="a.id" class="schakel-rij rs-afspraak"><span>{{ a.tekst }}<br><span class="meta">{{ a.termijn ? `Termijn ${a.termijn}` : '' }} · {{ a.status === 'open' ? 'Open' : a.status === 'gehaald' ? 'Gehaald' : 'Niet gehaald' }}<template v-if="a.reactie"> · Je reageerde: {{ a.reactie.tekst }}</template></span></span>
              <form class="rs-reageer" @submit.prevent="reageer(a.id)"><input v-model="reactie[a.id]" class="invoer invoer--klein" placeholder="Hoe gaat het?" :aria-label="`Reactie op ${a.tekst}`"><button type="submit" class="dd-act" :disabled="!reactie[a.id]?.trim()">Reageer</button></form></li>
          </ul>
        </article>

        <article v-if="data.kan.trend || data.kan.zelfanalyse" class="kaart mt-16" data-test="zelfanalyse">
          <h2 class="kaart-titel">Wat kan ik deze week beter doen?</h2>
          <template v-if="data.kan.zelfanalyse">
            <button type="button" class="dd-act dd-act--primair" :disabled="bezig" data-test="zelfanalyse-knop" @click="zelfanalyse"><Icoon naam="Sparkles" class="dd-actie-icoon" />Vraag de Coach</button>
            <span class="meta"> Kost 20 credits</span>
            <ul v-if="zelf" class="schakel-lijst mt-8"><li v-for="p in zelf" :key="p.tekst" class="schakel-rij"><span>{{ p.tekst }}<br><span class="meta">{{ p.onderbouwing.cijfers.join(' · ') }} · <NuxtLink :to="`/help/${p.artikelSleutel}`">artikel</NuxtLink></span></span></li></ul>
          </template>
          <button v-else type="button" class="dd-act knop-slot" data-test="zelfanalyse-slot" @click="toonUitleg('resultaten.zelfanalyse')"><Icoon naam="Lock" :grootte="14" /> Vraag de Coach</button>
        </article>
        <p v-if="!data.kan.trend" class="kaart kaart--vlak mt-16" data-test="trend-uit"><span class="kicker">Nog niet aangezet</span><br>Trend en vergelijking met je team. Deze functie hoort bij Gevorderd.</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.rs-trend { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; height: 120px; align-items: end; }
.rs-week { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; gap: 4px; }
.rs-balk { width: 28px; min-height: 2px; background: var(--ink); }
.rs-afspraak { flex-wrap: wrap; gap: 8px; }
.rs-reageer { display: flex; gap: 8px; }
</style>
