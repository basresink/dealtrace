<script setup lang="ts">
// Dashboard op Vandaag (opzet uit DealDrive, SalesIntelligenceStats): zwart vlak met kicker, een kop die de
// stand in één zin samenvat, een cursieve duiding en tegels. De brede tegel verdeelt je prospects per status;
// de andere tegels volgen Mijn resultaten en de funnel. Alle getallen komen uit /api/vandaag/dashboard.
const props = defineProps<{ c: any }>()
const KLEUR: Record<string, string> = { inReis: 'groen', nieuw: 'geel', wacht: 'grijs', over: 'blauw' }
const pct = (n: number) => (props.c.verdeling.totaal ? Math.round((n / props.c.verdeling.totaal) * 100) : 0)
const tempoPct = computed(() => Math.min(100, props.c.gesprekken.procent))
</script>

<template>
  <section class="vd-blok" data-test="vandaag-dashboard" aria-labelledby="vd-kop">
    <header class="vd-head">
      <div class="vd-head-tekst">
        <span class="vd-kicker">Jouw resultaten · deze maand</span>
        <h2 id="vd-kop" class="vd-titel" data-test="dashboard-kop">{{ c.kop }}</h2>
        <p class="vd-duiding">{{ c.duiding }}</p>
      </div>
      <NuxtLink to="/mijn-dashboard" class="vd-link" data-test="dashboard-link">Mijn dashboard →</NuxtLink>
    </header>

    <div class="vd-raster">
      <article class="vd-tegel vd-tegel--breed" data-test="dashboard-verdeling">
        <span class="vd-label">Prospects</span>
        <span class="vd-num tnum">{{ c.verdeling.totaal }}</span>
        <span class="vd-balk" role="img" :aria-label="c.verdeling.delen.map((d: any) => `${d.aantal} ${d.label}`).join(', ')">
          <span v-for="d in c.verdeling.delen" :key="d.sleutel" class="vd-vul" :class="`vd-vul--${KLEUR[d.sleutel]}`" :style="{ width: `${pct(d.aantal)}%` }" />
        </span>
        <span class="vd-legenda">
          <span v-for="d in c.verdeling.delen" :key="d.sleutel"><span class="vd-stip" :class="`vd-vul--${KLEUR[d.sleutel]}`" />{{ d.aantal }} {{ d.label }} · {{ pct(d.aantal) }}%</span>
        </span>
        <span v-if="c.verdeling.dekking" class="vd-hint" data-test="dashboard-dekking">Prospectdekking <strong class="tnum">{{ c.verdeling.dekking.procent }}%</strong>: {{ c.verdeling.dekking.recent }} van {{ c.verdeling.dekking.actief }} actieve prospects gesproken in de laatste 30 dagen</span>
      </article>

      <article class="vd-tegel" data-test="dashboard-gesprekken">
        <span class="vd-label">Gesprekken deze week</span>
        <span class="vd-num tnum">{{ c.gesprekken.aantal }}</span>
        <span class="vd-voortgang" :aria-label="`${c.gesprekken.procent}% van het doel`"><span :class="{ 'vd-voortgang--op': c.gesprekken.stand === 'op schema' }" :style="{ width: `${tempoPct}%` }" /></span>
        <span class="vd-hint tnum">{{ c.gesprekken.pogingen }} van {{ c.gesprekken.norm }} pogingen · {{ c.gesprekken.stand === 'op schema' ? 'op schema' : c.gesprekken.stand === 'achter' ? 'achter op doel' : 'geen doel' }}</span>
      </article>
      <article class="vd-tegel" data-test="dashboard-afspraken">
        <span class="vd-label">Afspraken gemaakt</span>
        <span class="vd-num tnum">{{ c.afspraken.aantal }}</span>
        <span class="vd-hint tnum">uit {{ c.afspraken.gesprekken }} gesprekken deze maand</span>
      </article>
      <article class="vd-tegel" data-test="dashboard-conversie">
        <span class="vd-label">Gesprek naar afspraak</span>
        <span class="vd-num tnum">{{ c.conversie.noemer ? `${c.conversie.procent}%` : '-' }}</span>
        <span class="vd-hint">norm {{ c.conversie.norm }}%<template v-if="c.conversie.noemer && c.conversie.procent >= c.conversie.norm"> · erboven</template></span>
      </article>
      <article class="vd-tegel" data-test="dashboard-overdrachten">
        <span class="vd-label">Overdrachten</span>
        <span class="vd-num tnum">{{ c.overdrachten }}</span>
        <span class="vd-hint">naar DealDrive deze maand</span>
      </article>
      <article class="vd-tegel" data-test="dashboard-inzichten">
        <span class="vd-label">Inzichten 7 dagen</span>
        <span class="vd-num tnum">{{ c.inzichten.aantal }}</span>
        <span class="vd-hint tnum" :class="{ 'vd-hint--let-op': c.inzichten.open }">{{ c.inzichten.open }} nog niet behandeld</span>
      </article>
      <article class="vd-tegel" data-test="dashboard-taken">
        <span class="vd-label">Afgeronde taken 7 dagen</span>
        <span class="vd-num tnum">{{ c.taken.klaar }}</span>
        <span class="vd-hint tnum">{{ c.taken.open }} open · <span :class="{ 'vd-hint--let-op': c.taken.verlopen }">{{ c.taken.verlopen }} verlopen</span></span>
      </article>
    </div>
  </section>
</template>

<style scoped>
.vd-blok { background: var(--ink); color: #fff; padding: 28px; border-radius: var(--radius); }
.vd-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
.vd-head-tekst { display: flex; flex-direction: column; gap: 8px; max-width: 760px; min-width: 0; }
.vd-kicker { font-size: 11px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--yellow); }
.vd-titel { margin: 0; font-family: var(--font-serif); font-size: clamp(22px, 2.6vw, 30px); font-weight: 700; line-height: 1.2; color: #fff; }
.vd-duiding { margin: 0; font-size: 14px; line-height: 1.55; font-style: italic; color: rgba(255, 255, 255, 0.78); }
.vd-link { flex-shrink: 0; display: inline-flex; align-items: center; min-height: 44px; font-size: 12px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: var(--yellow); text-decoration: none; white-space: nowrap; }
.vd-link:hover { color: #fff; }
.vd-link:focus-visible { outline: 2px solid var(--yellow); outline-offset: 2px; }
.vd-raster { display: grid; gap: 12px; grid-template-columns: 1fr; }
@media (min-width: 560px) { .vd-raster { grid-template-columns: repeat(2, 1fr); } .vd-tegel--breed { grid-column: span 2; } }
@media (min-width: 1000px) { .vd-raster { grid-template-columns: repeat(4, 1fr); } }
.vd-tegel { display: flex; flex-direction: column; gap: 6px; min-width: 0; padding: 18px; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: var(--radius); }
.vd-tegel--breed { background: rgba(254, 216, 0, 0.08); border-color: rgba(254, 216, 0, 0.32); }
.vd-label { font-size: 11px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255, 255, 255, 0.62); }
.vd-num { font-family: var(--font-serif); font-size: 34px; font-weight: 700; line-height: 1.05; color: #fff; }
.vd-hint { font-size: 12px; line-height: 1.45; color: rgba(255, 255, 255, 0.62); }
.vd-hint strong { color: #fff; }
.vd-hint--let-op { color: var(--yellow); }
.vd-balk { display: flex; height: 10px; margin-top: 4px; overflow: hidden; border-radius: 2px; background: rgba(255, 255, 255, 0.1); }
.vd-vul { height: 100%; transition: width 600ms ease-out; }
.vd-vul--groen { background: #2fa866; }
.vd-vul--geel { background: var(--yellow); }
.vd-vul--grijs { background: rgba(255, 255, 255, 0.32); }
.vd-vul--blauw { background: #5b8def; }
.vd-legenda { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 12px; font-weight: 600; color: rgba(255, 255, 255, 0.78); }
.vd-stip { display: inline-block; width: 8px; height: 8px; margin-right: 6px; border-radius: 2px; vertical-align: middle; }
.vd-voortgang { display: block; height: 4px; overflow: hidden; border-radius: 2px; background: rgba(255, 255, 255, 0.1); }
.vd-voortgang > span { display: block; height: 100%; background: var(--yellow); }
.vd-voortgang > .vd-voortgang--op { background: #2fa866; }
@media (max-width: 767px) {
  .vd-blok { padding: 20px 16px; }
  .vd-head { flex-direction: column; gap: 8px; margin-bottom: 16px; }
  .vd-num { font-size: 28px; }
}
</style>
