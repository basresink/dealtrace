<script setup lang="ts">
// Prospectdekking als in DealDrive: zes blokken van vers (groen) naar ijskoud (donkerrood), met het aantal
// actieve prospects per laatste contact, en ernaast drie snelle cijfers. Alleen tokens, geen hex.
defineProps<{ bakken: { sleutel: string; label: string; toon: string; aantal: number }[]; recent: number; actief: number; zonderContact: number; procent: number }>()
</script>

<template>
  <div class="dr">
    <ul class="dr-raster" :aria-label="`Prospectdekking: ${procent}% van ${actief} actieve prospects gesproken in de laatste 30 dagen`">
      <li v-for="b in bakken" :key="b.sleutel" class="dr-cel" :class="[`dr-cel--${b.toon}`, { 'dr-cel--leeg': !b.aantal }]" :data-test="`dekking-${b.sleutel}`">
        <span class="dr-num tnum">{{ b.aantal }}</span>
        <span class="dr-label">{{ b.label }}</span>
      </li>
    </ul>
    <div class="dr-stats">
      <div class="dr-stat"><span class="dr-stat-num tnum">{{ procent }}%</span><span class="dr-stat-label">contact &lt; 30 dagen</span></div>
      <div class="dr-stat"><span class="dr-stat-num tnum">{{ zonderContact }}</span><span class="dr-stat-label">zonder contactmoment</span></div>
      <div class="dr-stat"><span class="dr-stat-num tnum">{{ actief - recent }}</span><span class="dr-stat-label">&gt; 30 dagen koud</span></div>
    </div>
  </div>
</template>

<style scoped>
.dr { display: grid; grid-template-columns: 1fr; gap: 18px; }
@media (min-width: 800px) { .dr { grid-template-columns: 1.4fr 1fr; gap: 24px; align-items: stretch; } }
.dr-raster { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px; }
.dr-cel { padding: 22px 6px; display: flex; flex-direction: column; align-items: center; gap: 4px; color: var(--wit); text-align: center; }
.dr-cel--leeg { opacity: 0.55; }
.dr-cel--vers { background: var(--green); }
.dr-cel--recent { background: color-mix(in srgb, var(--green) 45%, var(--bg)); color: var(--ink); }
.dr-cel--aandacht { background: var(--yellow); color: var(--ink); }
.dr-cel--oplopend { background: var(--orange); color: var(--ink); }
.dr-cel--koud { background: var(--red); }
.dr-cel--ijskoud { background: var(--red-dark); }
.dr-num { font-family: var(--font-serif); font-size: 24px; font-weight: 700; line-height: 1; }
.dr-label { font-size: 11px; font-weight: 700; letter-spacing: 0.04em; white-space: nowrap; }
.dr-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
@media (min-width: 800px) { .dr-stats { grid-template-columns: 1fr; } }
.dr-stat { display: flex; flex-direction: column; gap: 2px; padding: 14px 16px; background: var(--surface); border: 1px solid var(--border); }
.dr-stat-num { font-family: var(--font-serif); font-size: 28px; font-weight: 700; line-height: 1.05; color: var(--ink); }
.dr-stat-label { font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
@media (max-width: 720px) {
  .dr-raster { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .dr-cel { padding: 14px 4px; }
  .dr-stat { padding: 10px; }
  .dr-stat-num { font-size: 22px; }
  .dr-stat-label { font-size: 10px; letter-spacing: 0; }
}
</style>
