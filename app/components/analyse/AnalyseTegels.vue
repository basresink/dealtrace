<script setup lang="ts">
// De cijferrij van de analyses (opzet DealDrive): witte tegels met een groot getal, een label in
// kapitalen en een voetregel. Een tegel is { waarde, label, voet?, rood?, test? }.
defineProps<{ tegels: { waarde: string | number; label: string; voet?: string | null; rood?: boolean; test?: string }[]; klein?: boolean }>()
</script>

<template>
  <div class="at" :class="{ 'at--klein': klein }">
    <div v-for="t in tegels" :key="t.label" class="at-tegel" :data-test="t.test">
      <span class="at-num tnum" :class="{ 'at-num--rood': t.rood }">{{ t.waarde }}</span>
      <span class="at-label">{{ t.label }}</span>
      <p v-if="t.voet" class="at-voet">{{ t.voet }}</p>
    </div>
  </div>
</template>

<style scoped>
.at { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--kaart-gap, 16px); }
.at--klein { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
.at-tegel { display: flex; flex-direction: column; gap: 6px; min-width: 0; padding: 22px 16px; background: var(--wit); border: 1px solid var(--border); border-radius: var(--radius); }
.at--klein .at-tegel { padding: 16px; }
.at-num { font-family: var(--font-serif); font-size: 30px; font-weight: 700; line-height: 1.05; color: var(--ink); overflow-wrap: anywhere; }
.at--klein .at-num { font-size: 24px; }
.at-num--rood { color: var(--red); }
.at-label { font-size: var(--fs-label); font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.at-voet { margin: 0; font-size: 12px; line-height: 1.4; color: var(--muted); }
@media (max-width: 719px) { .at, .at--klein { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; } .at-tegel { padding: 14px 12px; } .at-num { font-size: 24px; } }
</style>
