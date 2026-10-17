<script setup lang="ts">
// Het filterpaneel van /briefings in de UI-standaard: per groep een label en filterpillen met een teller (wat er
// overblijft als je die pil kiest), Weergave en Sorteer na een scheiding. Op de telefoon hetzelfde als blad van
// onderen met "Toon N briefings". Bij Periode Van tot staan twee datumvelden. Alles staat in de link.
export interface FilterOptie { k: string; l: string; n?: number | null; kleur?: string }
export interface FilterGroep { id: string; label: string; meer?: boolean; keuze?: boolean; opties: FilterOptie[] }
const props = defineProps<{ groepen: FilterGroep[]; aan: (groep: string, k: string) => boolean; van?: string; tot?: string; blad?: boolean; aantal: number; wisbaar: boolean }>()
const emit = defineEmits<{ zet: [groep: string, k: string]; datum: [veld: 'van' | 'tot', waarde: string]; wis: []; sluit: [] }>()
const naam = (n: number) => `${n} ${n === 1 ? 'briefing' : 'briefings'}`
function opEscape(e: KeyboardEvent) { if (e.key === 'Escape' && props.blad) emit('sluit') }
onMounted(() => window.addEventListener('keydown', opEscape))
onBeforeUnmount(() => window.removeEventListener('keydown', opEscape))
</script>

<template>
  <component :is="blad ? 'div' : 'section'" :class="blad ? 'fo-overlay bff-overlay' : 'bff-sectie'" @click.self="blad && emit('sluit')">
    <component :is="blad ? 'section' : 'div'" :class="blad ? 'bff-blad' : 'container'" :role="blad ? 'dialog' : undefined" :aria-modal="blad ? 'true' : undefined" :aria-labelledby="blad ? 'bff-titel' : undefined">
      <header v-if="blad" class="bff-blad-kop"><h2 id="bff-titel" class="bff-titel">Filters</h2><button type="button" class="fo-sluit" aria-label="Sluiten" @click="emit('sluit')"><Icoon naam="X" /></button></header>
      <div class="bff-paneel" :class="{ 'bff-paneel--blad': blad }" data-test="briefings-filterpaneel" aria-label="Filters">
        <template v-for="g in groepen" :key="g.id">
          <hr v-if="g.id === 'weergave'" class="bff-scheiding">
          <div class="bff-groep" role="group" :aria-label="g.label" :data-test="`filter-${g.id}`">
            <span class="filter-label bff-label">{{ g.label }}</span>
            <div class="bff-pillen">
              <button
                v-for="o in g.opties" :key="o.k" type="button" class="filter-pil" :class="[{ 'filter-pil--aan': aan(g.id, o.k), 'bff-pil--leeg': o.n === 0 && !aan(g.id, o.k) }, o.kleur ? `bff-kleur bff-kleur--${o.kleur}` : '']"
                :aria-pressed="aan(g.id, o.k)" :data-test="`bf-${g.id}-${o.k}`" @click="emit('zet', g.id, o.k)"
              >{{ o.l }}<span v-if="o.n != null" class="pil-teller tnum">{{ o.n }}</span></button>
            </div>
            <div v-if="g.id === 'periode' && aan('periode', 'vantot')" class="bff-vantot">
              <label class="veld"><span class="veld-label">Van</span><input class="invoer" type="date" :value="van" data-test="bf-van" @change="emit('datum', 'van', ($event.target as HTMLInputElement).value)"></label>
              <label class="veld"><span class="veld-label">Tot</span><input class="invoer" type="date" :value="tot" data-test="bf-tot" @change="emit('datum', 'tot', ($event.target as HTMLInputElement).value)"></label>
            </div>
          </div>
        </template>
        <footer v-if="!blad" class="bff-voet">
          <span class="meta">Filters werken direct en staan in de link.</span>
          <button v-if="wisbaar" type="button" class="dd-act" data-test="briefings-wis-alles" @click="emit('wis')">Wis alles</button>
          <button type="button" class="dd-act" data-test="briefings-filters-sluit" @click="emit('sluit')">Sluiten</button>
        </footer>
      </div>
      <footer v-if="blad" class="bff-blad-voet">
        <button type="button" class="dd-actie dd-actie--secundair" :disabled="!wisbaar" @click="emit('wis')">Wis alles</button>
        <button type="button" class="dd-actie dd-actie--primair" data-test="briefings-toon" @click="emit('sluit')">Toon {{ naam(aantal) }}</button>
      </footer>
    </component>
  </component>
</template>

<style scoped>
.bff-sectie { padding: 16px 0 0; }
.bff-paneel { display: flex; flex-direction: column; gap: 12px; padding: 16px 18px; background: var(--wit); border: 1px solid var(--border); border-radius: var(--radius); }
.bff-groep { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; }
.bff-label { min-width: 84px; }
.bff-pillen { display: flex; flex-wrap: wrap; gap: 6px; min-width: 0; }
.bff-pil--leeg { opacity: .55; }
.bff-kleur { border-left-width: 4px; }
.bff-kleur--blauw { border-left-color: var(--blue); }
.bff-kleur--zwart { border-left-color: var(--ink); }
.bff-kleur--paars { border-left-color: var(--purple); }
.bff-kleur--oranje { border-left-color: var(--orange); }
.bff-kleur--groen { border-left-color: var(--green); }
.bff-vantot { display: flex; flex-wrap: wrap; gap: 8px 12px; width: 100%; padding-left: 94px; }
.bff-vantot .veld { margin: 0; }
.bff-scheiding { width: 100%; margin: 2px 0; border: 0; border-top: 1px solid var(--border); }
.bff-voet { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; }
.bff-voet .meta { margin-right: auto; }
.bff-overlay { display: flex; align-items: flex-end; }
.bff-blad { display: flex; flex-direction: column; width: 100%; max-height: 88vh; background: var(--wit); border-top: 1px solid var(--border); box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.18); }
.bff-blad-kop { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border); }
.bff-titel { margin: 0; font-family: var(--font-serif); font-size: 20px; }
.bff-paneel--blad { flex: 1; overflow-y: auto; border: 0; padding: 16px; }
.bff-blad-voet { display: flex; gap: 8px; padding: 12px 16px calc(12px + var(--safe-area-bottom)); border-top: 1px solid var(--border); }
.bff-blad-voet .dd-actie { flex: 1; }
@media (max-width: 719px) {
  .bff-label { width: 100%; }
  .bff-vantot { padding-left: 0; }
  .bff-groep .filter-pil { min-height: var(--touch-target-min); }
}
</style>
