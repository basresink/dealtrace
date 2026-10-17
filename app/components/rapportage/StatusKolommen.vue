<script setup lang="ts">
// Status prospect op Mijn dashboard: een kolom per status (koud, lauw, warm, heet) met het label, het aantal,
// het deel van de prospects met een status en een staaf. Elke kolom met prospects is een knop (kies) die de
// lijst erachter opent; daaronder hoeveel prospects nog geen status hebben (ook een knop).
import type { StatusKolom } from '~~/shared/prospectStatus'

const props = defineProps<{ kolommen: StatusKolom[]; zonder: number; totaal: number }>()
const emit = defineEmits<{ kies: [sleutel: string] }>()
const top = computed(() => Math.max(1, ...props.kolommen.map((k) => k.aantal)))
const hoogte = (n: number) => `${n ? Math.max(6, Math.round((n / top.value) * 100)) : 0}%`
</script>

<template>
  <div class="sk">
    <ul class="sk-raster" aria-label="Prospects per status">
      <li v-for="k in kolommen" :key="k.sleutel">
        <button type="button" class="sk-kol" :class="`sk-kol--${k.sleutel}`" :disabled="!k.aantal" :aria-label="`${k.aantal} ${k.aantal === 1 ? 'prospect' : 'prospects'} ${k.label.toLowerCase()}, bekijk de lijst`" :data-test="`status-${k.sleutel}`" @click="emit('kies', k.sleutel)">
          <Label soort="prospectstatus" :waarde="k.sleutel" />
          <span class="sk-staafvak" aria-hidden="true"><span class="sk-staaf" :style="{ height: hoogte(k.aantal) }" /></span>
          <span class="sk-num tnum">{{ k.aantal }}</span>
          <span class="sk-pct tnum">{{ k.procent }}%</span>
        </button>
      </li>
    </ul>
    <button v-if="zonder" type="button" class="sk-zonder" data-test="status-geen" @click="emit('kies', 'geen')">{{ zonder }} van {{ totaal }} {{ totaal === 1 ? 'prospect heeft' : 'prospects hebben' }} nog geen status <Icoon naam="ArrowRight" :grootte="14" /></button>
  </div>
</template>

<style scoped>
.sk { display: flex; flex-direction: column; gap: 12px; }
.sk-raster { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.sk-kol { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 14px 8px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); font: inherit; color: var(--ink); cursor: pointer; }
.sk-kol:hover:not(:disabled) { border-color: var(--ink); }
.sk-kol:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
.sk-kol:disabled { cursor: default; opacity: 0.6; }
.sk-staafvak { position: relative; width: 36px; height: 72px; display: flex; align-items: flex-end; background: var(--bg); border-bottom: 2px solid var(--ink); }
.sk-staaf { width: 100%; }
.sk-kol--koud .sk-staaf { background: var(--lbl-cyaan-tekst, var(--blue)); }
.sk-kol--lauw .sk-staaf { background: var(--muted-light, var(--muted)); }
.sk-kol--warm .sk-staaf { background: var(--orange); }
.sk-kol--heet .sk-staaf { background: var(--red); }
.sk-num { font-family: var(--font-serif); font-size: 26px; font-weight: 700; line-height: 1; }
.sk-pct { font-size: 11px; font-weight: 700; color: var(--muted); }
.sk-zonder { display: inline-flex; align-items: center; gap: 6px; align-self: flex-start; min-height: 36px; padding: 0; background: none; border: 0; font: inherit; font-size: 12px; color: var(--muted); text-decoration: underline; cursor: pointer; }
.sk-zonder:hover { color: var(--ink); }
@media (max-width: 720px) {
  .sk-raster { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .sk-zonder { min-height: var(--touch-target-min); }
}
</style>
