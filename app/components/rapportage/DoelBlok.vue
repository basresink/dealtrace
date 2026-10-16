<script setup lang="ts">
// Het doelblok van DealDrive (OmzetdoelBlok), hier voor je pogingendoel uit shared/team: gerealiseerd,
// doel over de hele periode, procent binnen en prognose, een balk met een streep voor waar je op deze dag
// zou staan, en wat er per werkdag nog moet. Daaronder de normen naast je eigen cijfers.
const props = defineProps<{
  kicker: string
  titel: string
  doel: { gerealiseerd: number; doel: number; verwacht: number; pct: number; verwachtPct: number; prognose: number; resterend: number; werkdagenRest: number; perDag: number; normPerDag: number; stand: 'voor' | 'op schema' | 'achter' | 'geen'; afgerond: boolean }
  normen: { sleutel: string; label: string; waarde: string; norm: string; procent: number | null; stand: 'boven' | 'onder' | 'geen'; hint: string }[]
}>()
const LABEL = { voor: 'Voor op schema', 'op schema': 'Op schema', achter: 'Achter', geen: 'Geen werkdagen' } as const
const nl = (n: number) => n.toLocaleString('nl-NL')
const chip = computed(() => props.doel.stand.replace(' ', '-'))
</script>

<template>
  <section class="od" data-test="doel-blok" aria-labelledby="od-titel">
    <header class="od-kop">
      <div>
        <span class="od-kicker">{{ kicker }}</span>
        <h2 id="od-titel" class="od-titel">{{ titel }}</h2>
      </div>
      <span class="od-chip" :class="`od-chip--${chip}`" data-test="doel-stand">{{ LABEL[doel.stand] }}</span>
    </header>

    <div class="od-cijfers">
      <div class="od-cijfer"><span class="od-getal tnum" data-test="doel-gerealiseerd">{{ nl(doel.gerealiseerd) }}</span><span class="od-label">pogingen</span></div>
      <div class="od-cijfer"><span class="od-getal tnum">{{ nl(doel.doel) }}</span><span class="od-label">doel</span></div>
      <div class="od-cijfer"><span class="od-getal tnum">{{ doel.pct }}%</span><span class="od-label">binnen</span></div>
      <div class="od-cijfer"><span class="od-getal tnum">{{ nl(doel.prognose) }}</span><span class="od-label">prognose</span></div>
    </div>

    <div class="od-balk" role="img" :aria-label="`${doel.pct} procent van het doel gehaald, ${doel.verwachtPct} procent verwacht op deze dag`">
      <div class="od-vulling" :class="`od-vulling--${chip}`" :style="{ width: `${Math.min(100, doel.pct)}%` }" />
      <div class="od-pace" :style="{ left: `${Math.min(100, doel.verwachtPct)}%` }" />
    </div>
    <p class="od-uitleg">
      <template v-if="doel.afgerond">Over deze periode stond er <strong class="tnum">{{ nl(doel.doel) }}</strong> pogingen als doel; je haalde <strong class="tnum">{{ doel.pct }}%</strong>.</template>
      <template v-else>Op deze dag zou je op <strong class="tnum">{{ doel.verwachtPct }}%</strong> staan ({{ nl(doel.verwacht) }} pogingen). Je staat op {{ doel.pct }}%.</template>
      De norm is {{ doel.normPerDag }} pogingen per werkdag voor jouw werkplek.
    </p>

    <div v-if="!doel.afgerond && doel.werkdagenRest" class="od-week">
      <div class="od-week-cijfer"><span class="od-week-getal tnum">{{ nl(doel.perDag) }}</span><span class="od-label">per werkdag te gaan</span></div>
      <p class="od-week-tekst">Nog <strong class="tnum">{{ nl(doel.resterend) }}</strong> pogingen in <strong class="tnum">{{ doel.werkdagenRest }}</strong> {{ doel.werkdagenRest === 1 ? 'werkdag' : 'werkdagen' }}.
        {{ doel.stand === 'achter' ? 'Zet een extra belblok in je agenda om bij te trekken.' : 'Houd je dit tempo vast, dan kom je uit.' }}</p>
    </div>

    <ul class="od-normen" data-test="normen">
      <li v-for="n in normen" :key="n.sleutel" class="od-norm" :data-test="`norm-${n.sleutel}`">
        <span class="od-norm-kop"><span class="od-norm-label">{{ n.label }}</span><span class="od-norm-stand" :class="`od-norm-stand--${n.stand}`">{{ n.stand === 'boven' ? 'Op norm' : n.stand === 'onder' ? 'Onder norm' : 'Nog geen cijfer' }}</span></span>
        <span class="od-norm-waarde tnum">{{ n.waarde }} <span class="od-norm-norm">norm {{ n.norm }}</span></span>
        <span class="od-norm-hint">{{ n.hint }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.od { background: var(--wit); border: 1px solid var(--border-strong); border-radius: var(--radius); padding: 20px 24px; }
.od-kop { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.od-kicker { font-size: var(--fs-label); font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.od-titel { margin: 4px 0 0; font-size: 18px; font-weight: 800; color: var(--ink); }
.od-chip { padding: 3px 10px; border: 1px solid transparent; border-radius: var(--radius); font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; white-space: nowrap; }
.od-chip--voor { background: color-mix(in srgb, var(--green) 12%, var(--wit)); color: var(--green); border-color: var(--green); }
.od-chip--op-schema, .od-chip--geen { background: var(--surface); color: var(--ink-soft); border-color: var(--border-strong); }
.od-chip--achter { background: var(--red-light); color: var(--red-dark); border-color: var(--red); }
.od-cijfers { display: flex; flex-wrap: wrap; gap: 28px; margin-bottom: 14px; }
.od-cijfer { display: flex; flex-direction: column; }
.od-getal { font-family: var(--font-serif); font-size: 28px; font-weight: 700; line-height: 1.05; color: var(--ink); }
.od-label { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.od-balk { position: relative; height: 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 2px; overflow: hidden; }
.od-vulling { height: 100%; background: var(--ink); }
.od-vulling--achter { background: var(--red); }
.od-vulling--voor { background: var(--green); }
.od-pace { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--yellow-dark); }
.od-uitleg { margin: 8px 0 0; font-size: 13px; line-height: 1.5; color: var(--muted); }
.od-uitleg strong { color: var(--ink); }
.od-week { display: flex; align-items: baseline; flex-wrap: wrap; gap: 16px; margin-top: 16px; padding: 12px 14px; background: var(--surface); border-left: 3px solid var(--yellow); }
.od-week-cijfer { display: flex; flex-direction: column; }
.od-week-getal { font-family: var(--font-serif); font-size: 22px; font-weight: 700; line-height: 1.05; color: var(--ink); }
.od-week-tekst { flex: 1; min-width: 200px; margin: 0; font-size: 13px; color: var(--ink-soft); }
.od-normen { list-style: none; margin: 18px 0 0; padding: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.od-norm { display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; border: 1px solid var(--border); border-radius: var(--radius); min-width: 0; }
.od-norm-kop { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 4px 8px; }
.od-norm-label { font-size: var(--fs-label); font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.od-norm-stand { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; padding: 1px 6px; border-radius: 2px; }
.od-norm-stand--boven { background: var(--green); color: var(--wit); }
.od-norm-stand--onder { background: var(--red); color: var(--wit); }
.od-norm-stand--geen { background: var(--surface); color: var(--ink-soft); }
.od-norm-waarde { font-family: var(--font-serif); font-size: 22px; font-weight: 700; color: var(--ink); }
.od-norm-norm { font-family: var(--font-sans, inherit); font-size: 12px; font-weight: 600; color: var(--muted); }
.od-norm-hint { font-size: 12px; color: var(--muted); }
@media (max-width: 900px) { .od-normen { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 720px) {
  .od { padding: 16px; }
  .od-kop { flex-direction: column; gap: 8px; }
  .od-cijfers { gap: 16px; }
  .od-getal { font-size: 24px; }
  .od-normen { grid-template-columns: 1fr; }
}
</style>
