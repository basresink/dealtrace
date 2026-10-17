<script setup lang="ts">
// Filterpaneel van de managerpagina's (/team, /coaching, /analyse, /audit) in de UI-standaard: per groep een
// label en filterpillen, eventueel met teller. Op de telefoon hetzelfde als blad van onderen met "Toon".
// De pagina zet de filters in de link; dit paneel toont alleen en meldt de keuze.
export interface MfOptie { k: string; l: string; n?: number | null }
export interface MfGroep { id: string; label: string; opties: MfOptie[] }
const props = defineProps<{ groepen: MfGroep[]; aan: (groep: string, k: string) => boolean; blad?: boolean; toon?: string; wisbaar: boolean; test: string }>()
const emit = defineEmits<{ zet: [groep: string, k: string]; wis: []; sluit: [] }>()
function opEscape(e: KeyboardEvent) { if (e.key === 'Escape' && props.blad) emit('sluit') }
onMounted(() => window.addEventListener('keydown', opEscape))
onBeforeUnmount(() => window.removeEventListener('keydown', opEscape))
</script>

<template>
  <component :is="blad ? 'div' : 'section'" :class="blad ? 'fo-overlay mf-overlay' : 'mf-sectie'" @click.self="blad && emit('sluit')">
    <component :is="blad ? 'section' : 'div'" :class="blad ? 'mf-blad' : 'container'" :role="blad ? 'dialog' : undefined" :aria-modal="blad ? 'true' : undefined" :aria-labelledby="blad ? `${test}-titel` : undefined">
      <header v-if="blad" class="mf-blad-kop"><h2 :id="`${test}-titel`" class="mf-titel">Filters</h2><button type="button" class="fo-sluit" aria-label="Sluiten" @click="emit('sluit')"><Icoon naam="X" /></button></header>
      <div class="mf-paneel" :class="{ 'mf-paneel--blad': blad }" :data-test="`${test}-paneel`" aria-label="Filters">
        <div v-for="g in groepen" :key="g.id" class="mf-groep" role="group" :aria-label="g.label" :data-test="`${test}-groep-${g.id}`">
          <span class="filter-label mf-label">{{ g.label }}</span>
          <div class="mf-pillen">
            <button
              v-for="o in g.opties" :key="o.k" type="button" class="filter-pil" :class="{ 'filter-pil--aan': aan(g.id, o.k), 'mf-pil--leeg': o.n === 0 && !aan(g.id, o.k) }"
              :aria-pressed="aan(g.id, o.k)" :data-test="`${test}-${g.id}-${o.k}`" @click="emit('zet', g.id, o.k)"
            >{{ o.l }}<span v-if="o.n != null" class="pil-teller tnum">{{ o.n }}</span></button>
          </div>
        </div>
        <slot />
        <footer v-if="!blad" class="mf-voet">
          <span class="meta">Filters werken direct en staan in de link.</span>
          <button v-if="wisbaar" type="button" class="dd-act" :data-test="`${test}-wis-alles`" @click="emit('wis')">Wis alles</button>
          <button type="button" class="dd-act" :data-test="`${test}-sluit`" @click="emit('sluit')">Sluiten</button>
        </footer>
      </div>
      <footer v-if="blad" class="mf-blad-voet">
        <button type="button" class="dd-actie dd-actie--secundair" :disabled="!wisbaar" @click="emit('wis')">Wis alles</button>
        <button type="button" class="dd-actie dd-actie--primair" :data-test="`${test}-toon`" @click="emit('sluit')">{{ toon ?? 'Toon' }}</button>
      </footer>
    </component>
  </component>
</template>

<style scoped>
.mf-sectie { padding: 0 0 8px; }
.mf-paneel { display: flex; flex-direction: column; gap: 12px; padding: 16px 18px; background: var(--wit); border: 1px solid var(--border); border-radius: var(--radius); }
.mf-groep { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; }
.mf-label { min-width: 84px; }
.mf-pillen { display: flex; flex-wrap: wrap; gap: 6px; min-width: 0; }
.mf-pil--leeg { opacity: .55; }
.mf-voet { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; }
.mf-voet .meta { margin-right: auto; }
.mf-overlay { display: flex; align-items: flex-end; }
.mf-blad { display: flex; flex-direction: column; width: 100%; max-height: 88vh; background: var(--wit); border-top: 1px solid var(--border); box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.18); }
.mf-blad-kop { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border); }
.mf-titel { margin: 0; font-family: var(--font-serif); font-size: 20px; }
.mf-paneel--blad { flex: 1; overflow-y: auto; border: 0; padding: 16px; }
.mf-blad-voet { display: flex; gap: 8px; padding: 12px 16px calc(12px + var(--safe-area-bottom)); border-top: 1px solid var(--border); }
.mf-blad-voet .dd-actie { flex: 1; }
@media (max-width: 719px) {
  .mf-label { width: 100%; }
  .mf-groep .filter-pil { min-height: var(--touch-target-min); }
}
</style>
