<script setup lang="ts">
// Gestapelde staafgrafiek van DealDrive (Activiteiten per dag): een y-as van 0 tot een nette bovenkant,
// staven die op de nullijn staan en in legendavolgorde van onder naar boven stapelen. Gewone CSS, geen
// bibliotheek. Voor schermlezers staat dezelfde reeks als tabel in de pagina. Op de telefoon worden de
// staven smaller en blijven alleen de kernlabels (maandagen of om de week) staan.
import { asMax } from '~~/shared/dashboard'

interface StaafPunt { sleutel: string; label: string; titel: string; kern?: boolean; totaal: number; delen: Record<string, number> }
interface StaafSerie { sleutel: string; label: string; kleur: 'blauw' | 'geel' | 'groen' | 'paars' | 'oranje' | 'inkt' | 'rood' }
const props = defineProps<{ titel: string; meta?: string; punten: StaafPunt[]; series: StaafSerie[]; hoogte?: number; leeg?: string }>()
const top = computed(() => asMax(Math.max(0, ...props.punten.map((p) => p.totaal))))
const h = computed(() => props.hoogte ?? 200)
const px = (n: number) => (n > 0 ? Math.max(2, Math.round((n / top.value) * h.value)) : 0)
const titelVan = (p: StaafPunt) => `${p.titel}: ${p.totaal} totaal${props.series.filter((s) => p.delen[s.sleutel]).map((s) => `, ${p.delen[s.sleutel]} ${s.label.toLowerCase()}`).join('')}`
const totaal = computed(() => props.punten.reduce((s, p) => s + p.totaal, 0))
</script>

<template>
  <div class="chart-block sg">
    <header class="chart-head">
      <h3 class="chart-title">{{ titel }}</h3>
      <span v-if="meta" class="chart-meta">{{ meta }}</span>
    </header>
    <p v-if="!totaal && leeg" class="sg-leeg">{{ leeg }}</p>
    <div class="sg-wrap" aria-hidden="true">
      <div class="sg-as" :style="{ height: `${h}px` }">
        <span class="sg-tick tnum">{{ top }}</span>
        <span class="sg-tick tnum">{{ Math.round(top / 2) === top / 2 ? top / 2 : '' }}</span>
        <span class="sg-tick tnum">0</span>
      </div>
      <div class="sg-vlak" :class="{ 'sg-vlak--veel': punten.length > 16, 'sg-vlak--vol': punten.length > 10 }">
        <div v-for="p in punten" :key="p.sleutel" class="sg-kol" :title="titelVan(p)">
          <div class="sg-stapel" :style="{ height: `${h}px` }">
            <div v-for="s in series" :key="s.sleutel" class="sg-seg" :class="`sg-seg--${s.kleur}`" :style="{ height: `${px(p.delen[s.sleutel] ?? 0)}px` }" />
          </div>
          <span class="sg-label" :class="{ 'sg-label--kern': p.kern }">{{ p.label }}</span>
        </div>
      </div>
    </div>
    <div class="chart-legend sg-legenda">
      <span v-for="s in series" :key="s.sleutel" class="legend-chip"><span class="legend-dot" :class="`sg-seg--${s.kleur}`" />{{ s.label }}</span>
    </div>
    <div class="sr-only"><table>
      <caption>{{ titel }}</caption>
      <thead><tr><th scope="col">Periode</th><th v-for="s in series" :key="s.sleutel" scope="col">{{ s.label }}</th><th scope="col">Totaal</th></tr></thead>
      <tbody><tr v-for="p in punten" :key="p.sleutel"><th scope="row">{{ p.titel }}</th><td v-for="s in series" :key="s.sleutel">{{ p.delen[s.sleutel] ?? 0 }}</td><td>{{ p.totaal }}</td></tr></tbody>
    </table></div>
  </div>
</template>

<style scoped>
.sg { position: relative; }
.chart-block { background: var(--wit); border: 1px solid var(--border); padding: var(--kaart-padding); border-radius: var(--radius); min-width: 0; }
.chart-head { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
.chart-title { margin: 0; font-family: var(--font-serif); font-size: 18px; font-weight: 700; color: var(--ink); }
.chart-meta { font-size: 12px; color: var(--muted); }
.sg-leeg { margin: 0 0 12px; font-size: 13px; color: var(--muted); }
.sg-wrap { display: flex; gap: 10px; align-items: flex-start; }
.sg-as { display: flex; flex-direction: column; justify-content: space-between; flex: 0 0 auto; }
.sg-tick { font-size: var(--fs-label); font-weight: 700; line-height: 1; color: var(--muted); min-height: 1em; }
.sg-vlak { flex: 1; min-width: 0; display: flex; gap: 6px; align-items: flex-end; padding: 0 4px 6px; border-bottom: 2px solid var(--ink); }
.sg-vlak--veel { gap: 3px; }
.sg-kol { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; }
/* column-reverse: het eerste segment staat onderop en de stapel groeit omhoog vanaf de nullijn. */
.sg-stapel { width: 100%; max-width: 40px; display: flex; flex-direction: column-reverse; justify-content: flex-start; }
.sg-seg { width: 100%; border-top: 1px solid rgba(255, 255, 255, 0.5); }
.sg-seg--blauw { background: var(--blue); }
.sg-seg--geel { background: var(--yellow); }
.sg-seg--groen { background: var(--green); }
.sg-seg--paars { background: var(--purple); }
.sg-seg--oranje { background: var(--orange); }
.sg-seg--inkt { background: var(--ink-soft); }
.sg-seg--rood { background: var(--red); }
.sg-label { font-size: var(--fs-label); color: var(--muted); font-feature-settings: "tnum"; white-space: nowrap; min-height: 1.2em; }
.sg-vlak--veel .sg-label:not(.sg-label--kern) { visibility: hidden; }
.chart-legend { display: flex; flex-wrap: wrap; gap: 8px 12px; margin-top: 16px; font-size: 12px; font-weight: 600; color: var(--ink-soft); }
.legend-chip { display: inline-flex; align-items: center; padding: 4px 10px; background: var(--surface); border-radius: var(--radius); }
.legend-dot { display: inline-block; width: 10px; height: 10px; margin-right: 6px; border-radius: 2px; }
@media (max-width: 720px) {
  .chart-block { padding: 16px; }
  .sg-vlak { gap: 2px; padding: 0 0 6px; }
  .sg-vlak--vol .sg-label:not(.sg-label--kern) { visibility: hidden; }
}
</style>
