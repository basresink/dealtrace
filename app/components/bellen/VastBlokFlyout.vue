<script setup lang="ts">
// Schuifvenster "Vast blok plannen": dagen, starttijd, duur, soort gesprekken en plek. Ook
// voor wijzigen van een bestaand blok. De controle is dezelfde als op de server (blokFouten).
import { BLOK_SOORTEN, blokFouten, eindTijd, PLEKKEN, SOORT_LABEL, STANDAARD_VERHOUDING, type VastBlok } from '~~/shared/belblokken'

const props = defineProps<{ open: boolean; blok?: VastBlok | null; kanAutomatisch: boolean }>()
const emit = defineEmits<{ sluit: []; bewaar: [blok: VastBlok] }>()

const DAGEN = [{ nr: 1, kort: 'ma', lang: 'maandag' }, { nr: 2, kort: 'di', lang: 'dinsdag' }, { nr: 3, kort: 'wo', lang: 'woensdag' }, { nr: 4, kort: 'do', lang: 'donderdag' }, { nr: 5, kort: 'vr', lang: 'vrijdag' }]
const DUREN = [30, 45, 60, 75, 90, 120, 150, 180, 240]
const leeg = (): VastBlok => ({ id: `vb-${Date.now()}`, dagen: [], start: '09:00', minuten: 60, plek: 'Kantoor', soort: 'opvolging', automatisch: false })
const f = ref<VastBlok>(leeg())
watch(() => props.open, (o) => { if (o) f.value = props.blok ? { ...props.blok, dagen: [...props.blok.dagen] } : leeg() })

function wisselDag(nr: number) { f.value.dagen = f.value.dagen.includes(nr) ? f.value.dagen.filter((d) => d !== nr) : [...f.value.dagen, nr].sort() }
const fouten = computed(() => blokFouten(f.value))
const duren = computed(() => (DUREN.includes(f.value.minuten) ? DUREN : [...DUREN, f.value.minuten].sort((a, b) => a - b)))
watch(() => f.value.soort, (s) => { if (s === 'gemengd' && f.value.verhouding === undefined) f.value.verhouding = STANDAARD_VERHOUDING })

function bewaar() { if (!fouten.value.length) emit('bewaar', { ...f.value }) }
function toets(e: KeyboardEvent) { if (e.key === 'Escape' && props.open) emit('sluit') }
onMounted(() => window.addEventListener('keydown', toets))
onBeforeUnmount(() => window.removeEventListener('keydown', toets))
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fo-overlay" @click.self="emit('sluit')">
      <form class="fo-panel fo-panel--smal fo-panel--schuif" role="dialog" aria-modal="true" aria-labelledby="vb-titel" data-test="vast-blok-flyout" @submit.prevent="bewaar">
        <header class="fo-head">
          <div class="fo-head-tekst"><span class="fo-kicker">Vaste belblokken</span><h2 id="vb-titel" class="fo-titel">{{ blok ? 'Vast blok wijzigen' : 'Vast blok plannen' }}</h2></div>
          <button type="button" class="fo-sluit" aria-label="Sluiten" @click="emit('sluit')"><Icoon naam="X" /></button>
        </header>
        <div class="fo-body fo-body--formulier">
          <article class="fo-blok">
            <span class="veld-label">Dagen</span>
            <div class="vbf-dagen" role="group" aria-label="Dagen">
              <button v-for="d in DAGEN" :key="d.nr" type="button" class="vbf-dag" :class="{ 'vbf-dag--aan': f.dagen.includes(d.nr) }" :aria-pressed="f.dagen.includes(d.nr)" :aria-label="d.lang" :data-test="`vb-dag-${d.nr}`" @click="wisselDag(d.nr)">{{ d.kort }}</button>
            </div>
            <div class="vbf-raster mt-16">
              <label class="veld"><span class="veld-label">Starttijd</span><input v-model="f.start" type="time" class="invoer" required data-test="vb-start"></label>
              <label class="veld"><span class="veld-label">Duur</span><select v-model.number="f.minuten" class="invoer" data-test="vb-duur"><option v-for="m in duren" :key="m" :value="m">{{ m }} min</option></select></label>
            </div>
            <p class="meta mt-8">Tot {{ /^\d\d:\d\d$/.test(f.start) ? eindTijd(f) : '?' }}</p>
            <label class="veld mt-16"><span class="veld-label">Soort gesprekken</span><select v-model="f.soort" class="invoer" data-test="vb-soort"><option v-for="s in BLOK_SOORTEN" :key="s" :value="s">{{ SOORT_LABEL[s] }}</option></select></label>
            <label v-if="f.soort === 'gemengd' && kanAutomatisch" class="veld mt-16"><span class="veld-label">Aandeel koude acquisitie (procent)</span><input v-model.number="f.verhouding" type="number" min="0" max="100" step="10" class="invoer"></label>
            <label class="veld mt-16"><span class="veld-label">Plek</span><select v-model="f.plek" class="invoer" data-test="vb-plek"><option v-for="p in PLEKKEN" :key="p">{{ p }}</option></select></label>
            <p v-if="fouten.length && f.dagen.length" class="vbf-fout" role="alert">{{ fouten[0] }}</p>
          </article>
        </div>
        <footer class="fo-foot dd-acties">
          <button type="button" class="dd-act" @click="emit('sluit')">Annuleren</button>
          <span class="dd-acties-vul fo-foot-vul" />
          <button type="submit" class="dd-act dd-act--primair" :disabled="!!fouten.length" data-test="vb-bewaar">{{ blok ? 'Opslaan' : 'Vast blok toevoegen' }}</button>
        </footer>
      </form>
    </div>
  </Teleport>
</template>

<style scoped>
.vbf-dagen { display: flex; gap: 4px; flex-wrap: wrap; }
.vbf-dag {
  min-width: var(--touch-target-min); min-height: var(--touch-target-min); padding: 6px 10px; border: 1px solid var(--border-strong);
  background: var(--wit); color: var(--muted); font: inherit; font-size: 13px; font-weight: 700; cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
}
.vbf-dag:hover { border-color: var(--ink); color: var(--ink); }
.vbf-dag--aan, .vbf-dag--aan:hover { background: var(--ink); border-color: var(--ink); color: var(--yellow); }
.vbf-raster { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
.vbf-fout { margin: 12px 0 0; font-size: 13px; color: var(--red); }
</style>
