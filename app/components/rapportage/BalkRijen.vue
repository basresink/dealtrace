<script setup lang="ts">
// Liggende balken zoals de conversietrechter van DealDrive: links een pil met het label, in het midden de
// balk met het aantal, rechts een waarde (conversie, norm, dagen). Met `klikbaar` is elke rij een knop die
// de lijst erachter opent; een rij zonder aantal is dan uitgeschakeld. Een rij met `markeer` (het
// stokpunt) krijgt een gele rand. Op de telefoon schuift de waarde onder de balk.
interface Rij { sleutel: string; label: string; aantal: number; waarde?: string | null; sub?: string | null; kleur?: 'geel' | 'groen' | 'blauw' | 'rood' | 'inkt' | 'oranje' | 'paars'; markeer?: boolean; test?: string; lijn?: number | null }
const props = defineProps<{ rijen: Rij[]; max?: number; klikbaar?: boolean; eenheid?: string; label?: string }>()
const emit = defineEmits<{ kies: [rij: Rij] }>()
const top = computed(() => props.max ?? Math.max(1, ...props.rijen.map((r) => r.aantal)))
const breedte = (r: Rij) => `${r.aantal > 0 ? Math.max(4, Math.round((r.aantal / top.value) * 100)) : 0}%`
const naam = (r: Rij) => `${r.label}: ${r.aantal}${props.eenheid ? ` ${props.eenheid}` : ''}${r.waarde ? `, ${r.waarde}` : ''}${r.sub ? `, ${r.sub}` : ''}`
</script>

<template>
  <ul class="br" :aria-label="label">
    <li v-for="r in rijen" :key="r.sleutel">
      <component :is="klikbaar ? 'button' : 'div'" :type="klikbaar ? 'button' : undefined" class="br-rij" :class="{ 'br-rij--knop': klikbaar, 'br-rij--markeer': r.markeer }" :disabled="klikbaar && !r.aantal ? true : undefined" :aria-label="klikbaar ? `${naam(r)}, bekijk de lijst` : undefined" :data-test="r.test" @click="klikbaar && r.aantal && emit('kies', r)">
        <span class="br-pil">{{ r.label }}</span>
        <span class="br-balkvak" :aria-hidden="klikbaar ? 'true' : undefined">
          <span class="br-balk" :class="`br-balk--${r.kleur ?? 'geel'}`" :style="{ width: breedte(r) }" />
          <span class="br-num tnum">{{ r.aantal.toLocaleString('nl-NL') }}</span>
          <span v-if="r.lijn != null" class="br-lijn" :style="{ left: `${Math.min(100, Math.max(0, r.lijn))}%` }" />
        </span>
        <span class="br-waarde tnum">{{ r.waarde ?? '' }}<span v-if="r.sub" class="br-sub">{{ r.sub }}</span></span>
      </component>
    </li>
  </ul>
</template>

<style scoped>
.br { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.br-rij { display: grid; grid-template-columns: minmax(96px, 150px) minmax(0, 1fr) minmax(90px, auto); gap: 12px; align-items: center; width: 100%; padding: 0; background: none; border: 0; font: inherit; color: inherit; text-align: left; }
.br-rij--knop { cursor: pointer; min-height: var(--touch-target-min); padding: 2px 4px; margin: -2px -4px; width: calc(100% + 8px); border-radius: var(--radius); }
.br-rij--knop:hover:not(:disabled) .br-balkvak { border-color: var(--ink); }
.br-rij--knop:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
.br-rij--knop:disabled { cursor: default; opacity: 0.6; }
.br-rij--markeer .br-balkvak { border: 2px solid var(--yellow-dark); }
.br-pil { font-size: var(--fs-label); font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; padding: 4px 9px; background: var(--surface); color: var(--ink-soft); border-radius: var(--radius); overflow-wrap: anywhere; }
.br-balkvak { position: relative; height: 30px; background: var(--bg); border: 1px solid var(--border); display: flex; align-items: center; overflow: hidden; }
.br-balk { position: absolute; inset: 0 auto 0 0; transition: width 600ms ease-out; }
.br-balk--geel { background: var(--yellow); }
.br-balk--groen { background: var(--green); }
.br-balk--blauw { background: var(--blue); }
.br-balk--rood { background: var(--red); }
.br-balk--inkt { background: var(--ink-soft); }
.br-balk--oranje { background: var(--orange); }
.br-balk--paars { background: var(--purple); }
.br-num { position: relative; margin-left: 6px; padding: 1px 6px; font-family: var(--font-serif); font-size: 15px; font-weight: 700; line-height: 1.3; color: var(--ink); background: rgba(255, 255, 255, 0.88); border-radius: var(--radius); }
.br-lijn { position: absolute; top: -2px; bottom: -2px; width: 2px; background: var(--ink); }
.br-waarde { text-align: right; font-size: 13px; font-weight: 600; color: var(--ink); display: flex; flex-direction: column; align-items: flex-end; }
.br-sub { font-size: 11px; font-weight: 500; color: var(--muted); }
@media (max-width: 720px) {
  .br-rij { grid-template-columns: minmax(0, 1fr) auto; gap: 6px 10px; }
  .br-pil { grid-column: 1; justify-self: start; }
  .br-waarde { grid-column: 2; grid-row: 1; }
  .br-balkvak { grid-column: 1 / -1; }
}
</style>
