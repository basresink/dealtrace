<script setup lang="ts">
// De uitklapbare filterstrook van DealDrive /rapportage: periodepillen, een eigen van-tot via de datumkiezer
// van de browser, extra filtergroepen in de slot en rechts Reset filters.
const props = defineProps<{ opties: { id: string; label: string }[]; waarde: string; van?: string | null; tot?: string | null; eigenLabel?: string; reset?: boolean; vandaag?: string }>()
const emit = defineEmits<{ kies: [id: string]; datum: [van: string, tot: string]; reset: [] }>()
function zetDatum(soort: 'van' | 'tot', v: string) {
  let van = soort === 'van' ? v : (props.van ?? '')
  let tot = soort === 'tot' ? v : (props.tot ?? '')
  // Van na tot draait om, zoals in DealDrive: geen leeg venster.
  if (van && tot && van > tot) [van, tot] = [tot, van]
  emit('datum', van, tot)
}
</script>

<template>
  <section id="rapport-filters" class="section section--filter rp" data-test="rapport-filters">
    <div class="container">
      <div class="filters rp-balk">
        <div class="filter-groep" role="group" aria-label="Periode">
          <span class="filter-label">Periode</span>
          <button v-for="p in opties" :key="p.id" type="button" class="filter-pil" :class="{ 'filter-pil--aan': waarde === p.id }" :aria-pressed="waarde === p.id" :data-test="`periode-${p.id}`" @click="emit('kies', p.id)">{{ p.label }}</button>
          <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': waarde === 'eigen' }" :aria-pressed="waarde === 'eigen'" data-test="periode-eigen" @click="emit('kies', 'eigen')">{{ eigenLabel ?? 'Eigen periode' }}</button>
        </div>
        <div v-if="waarde === 'eigen'" class="filter-groep rp-datums">
          <label class="rp-datum"><span class="filter-label">Van</span><input type="date" class="invoer rp-invoer" :value="van ?? ''" :max="vandaag" data-test="periode-van" @change="zetDatum('van', ($event.target as HTMLInputElement).value)"></label>
          <label class="rp-datum"><span class="filter-label">Tot</span><input type="date" class="invoer rp-invoer" :value="tot ?? ''" :max="vandaag" data-test="periode-tot" @change="zetDatum('tot', ($event.target as HTMLInputElement).value)"></label>
        </div>
        <slot />
        <div v-if="reset" class="filter-groep filter-groep--eind">
          <button type="button" class="dd-tekstknop rp-reset" data-test="rapport-reset" @click="emit('reset')">Reset filters</button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.rp { padding: 16px 0; }
.rp-balk { gap: 16px 24px; }
.rp-datum { display: inline-flex; align-items: center; gap: 8px; }
.rp-invoer { min-height: var(--touch-target-min); width: auto; }
.rp-reset { min-height: var(--touch-target-min); }
@media (max-width: 720px) {
  .rp-datums { width: 100%; }
  .rp-datum { flex: 1 1 140px; }
  .rp-invoer { flex: 1; min-width: 0; }
}
</style>
