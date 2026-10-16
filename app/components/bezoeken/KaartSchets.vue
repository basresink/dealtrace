<script setup lang="ts">
// Kaart van de dag (F10): genummerde stops op hun punt, de route als lijn, start- en eindpunt, de
// volgende stop rood pulserend en kansen als gele punten. Een eenvoudige projectie zonder tegels,
// zodat de kaart ook offline en zonder kaartdienst werkt.
const props = defineProps<{ punten: { lat: number; lng: number }[]; stops: { id: string; punt: { lat: number; lng: number } | null; volgende?: boolean; label?: string }[]; kansen?: { id: string; punt: { lat: number; lng: number }; naam: string; rang: number }[]; extra?: { punt: { lat: number; lng: number }; kleur: string; titel: string }[] }>()
const emit = defineEmits<{ kans: [id: string] }>()
const B = 600; const H = 380; const M = 28
const alle = computed(() => [...props.punten, ...props.stops.filter((s) => s.punt).map((s) => s.punt!), ...(props.kansen ?? []).map((k) => k.punt), ...(props.extra ?? []).map((e) => e.punt)])
const vak = computed(() => {
  const lats = alle.value.map((p) => p.lat); const lngs = alle.value.map((p) => p.lng)
  if (!lats.length) return null
  let [la0, la1, lo0, lo1] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)]
  if (la1 - la0 < 0.05) { la0 -= 0.05; la1 += 0.05 }
  if (lo1 - lo0 < 0.08) { lo0 -= 0.08; lo1 += 0.08 }
  return { la0, la1, lo0, lo1 }
})
// Lengtegraden zijn op deze breedte ongeveer 0,6 keer zo kort; houd de verhouding.
function xy(p: { lat: number; lng: number }) {
  const v = vak.value!
  const sx = (B - 2 * M) / ((v.lo1 - v.lo0) * 0.6); const sy = (H - 2 * M) / (v.la1 - v.la0); const s = Math.min(sx, sy)
  const bx = (B - (v.lo1 - v.lo0) * 0.6 * s) / 2; const by = (H - (v.la1 - v.la0) * s) / 2
  return { x: bx + (p.lng - v.lo0) * 0.6 * s, y: H - by - (p.lat - v.la0) * s }
}
const lijn = computed(() => props.punten.map((p) => { const q = xy(p); return `${q.x.toFixed(1)},${q.y.toFixed(1)}` }).join(' '))
</script>

<template>
  <div class="kaart-schets" data-test="kaart">
    <svg v-if="vak" :viewBox="`0 0 ${B} ${H}`" role="img" aria-label="Kaart met je route en kansen">
      <polyline v-if="punten.length > 1" :points="lijn" class="ks-lijn" />
      <g v-if="punten.length"><circle :cx="xy(punten[0]!).x" :cy="xy(punten[0]!).y" r="7" class="ks-start" /><title>Start</title></g>
      <g v-for="(e, i) in extra ?? []" :key="`e${i}`"><circle :cx="xy(e.punt).x" :cy="xy(e.punt).y" r="4" :class="`ks-extra ks-extra--${e.kleur}`" /><title>{{ e.titel }}</title></g>
      <g v-for="k in kansen ?? []" :key="k.id" class="ks-kans" @click="emit('kans', k.id)"><circle :cx="xy(k.punt).x" :cy="xy(k.punt).y" r="8" /><text :x="xy(k.punt).x" :y="xy(k.punt).y + 4" text-anchor="middle">{{ k.rang }}</text><title>{{ k.naam }}</title></g>
      <g v-for="(s, i) in stops.filter((x) => x.punt)" :key="s.id" :class="['ks-stop', { 'ks-stop--volgende': s.volgende }]"><circle :cx="xy(s.punt!).x" :cy="xy(s.punt!).y" r="11" /><text :x="xy(s.punt!).x" :y="xy(s.punt!).y + 4" text-anchor="middle">{{ i + 1 }}</text><title>{{ s.label }}</title></g>
    </svg>
    <p v-else class="meta">Nog geen punten om te tonen.</p>
  </div>
</template>

<style scoped>
/* Stops zoals in DealDrive: zwart met gele rand, de volgende rood met witte rand. */
.ks-stop circle { stroke: var(--yellow); stroke-width: 2.5; }
.ks-stop--volgende circle { stroke: var(--wit); }
</style>
