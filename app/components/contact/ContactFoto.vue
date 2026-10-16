<script setup lang="ts">
// Avatar van een contact: de foto als die er is, anders de initialen in een vaste kleur per naam.
// Laadt de foto niet, dan blijven de initialen staan.
import { initialen, kleurUitNaam } from '~/utils/accountWeergave'
const props = withDefaults(defineProps<{ naam: string; fotoUrl?: string | null; grootte?: number; kleur?: string | null }>(), { fotoUrl: null, grootte: 44, kleur: null })
const mislukt = ref(false)
watch(() => props.fotoUrl, () => { mislukt.value = false })
</script>

<template>
  <span class="cfoto" :style="{ width: `${grootte}px`, height: `${grootte}px`, background: kleur ?? kleurUitNaam(naam), fontSize: `${Math.round(grootte / 3)}px` }" aria-hidden="true">
    <img v-if="fotoUrl && !mislukt" :src="fotoUrl" alt="" class="cfoto-img" loading="lazy" data-test="contact-foto" @error="mislukt = true">
    <template v-else>{{ initialen(naam) }}</template>
  </span>
</template>

<style scoped>
.cfoto { display: inline-flex; flex-shrink: 0; align-items: center; justify-content: center; overflow: hidden; color: var(--wit); font-family: var(--font-serif); font-weight: 700; letter-spacing: -0.01em; }
.cfoto-img { width: 100%; height: 100%; object-fit: cover; }
</style>
