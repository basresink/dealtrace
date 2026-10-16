<script setup lang="ts">
// Eén tegel in het zwarte cijferblok: label, groot getal, hint en eventueel het verschil met de vorige
// periode (groen omhoog, rood omlaag; bij `omgekeerd` is minder beter). Breed is twee kolommen.
const props = defineProps<{ label: string; waarde: string | number; hint?: string | null; delta?: { richting: 'op' | 'neer' | 'gelijk'; tekst: string } | null; breed?: boolean; omgekeerd?: boolean; link?: string | null }>()
const Link = resolveComponent('NuxtLink')
const toon = computed(() => {
  if (!props.delta || props.delta.richting === 'gelijk') return 'gelijk'
  const goed = props.delta.richting === 'op' ? !props.omgekeerd : !!props.omgekeerd
  return goed ? 'goed' : 'slecht'
})
</script>

<template>
  <component :is="link ? Link : 'article'" :to="link ?? undefined" class="rt" :class="{ 'rt--breed': breed, 'rt--link': link }">
    <span class="rt-label">{{ label }}</span>
    <span class="rt-num tnum">{{ waarde }}</span>
    <slot />
    <span v-if="hint" class="rt-hint">{{ hint }}</span>
    <span v-if="delta" class="rt-delta tnum" :class="`rt-delta--${toon}`"><span aria-hidden="true">{{ delta.richting === 'op' ? '▲' : delta.richting === 'neer' ? '▼' : '=' }}</span> {{ delta.tekst }}</span>
  </component>
</template>

<style scoped>
.rt { display: flex; flex-direction: column; gap: 4px; min-width: 0; padding: var(--kaart-padding); background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: var(--radius); color: inherit; text-decoration: none; }
.rt--breed { grid-column: span 2; background: rgba(254, 216, 0, 0.10); border-color: rgba(254, 216, 0, 0.32); }
.rt--link:hover { background: rgba(255, 255, 255, 0.12); border-color: var(--yellow); }
.rt--link:focus-visible { outline: 2px solid var(--yellow); outline-offset: 2px; }
.rt-label { font-size: var(--fs-label); font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255, 255, 255, 0.66); }
.rt-num { font-family: var(--font-serif); font-size: 32px; font-weight: 700; line-height: 1.05; color: var(--wit); overflow-wrap: anywhere; }
.rt-hint { font-size: 12px; font-weight: 500; line-height: 1.4; color: rgba(255, 255, 255, 0.72); }
.rt-delta { font-size: 11px; font-weight: 700; line-height: 1.4; }
.rt-delta--goed { color: color-mix(in srgb, var(--green) 55%, var(--wit)); }
.rt-delta--slecht { color: color-mix(in srgb, var(--red) 55%, var(--wit)); }
.rt-delta--gelijk { color: rgba(255, 255, 255, 0.6); }
@media (max-width: 720px) { .rt { padding: 14px 12px; } .rt-num { font-size: 26px; } }
</style>
