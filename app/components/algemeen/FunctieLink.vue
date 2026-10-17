<script setup lang="ts">
// Een link naar een scherm van een functie (wens: staat de functie uit, dan geen knop en
// geen link). Staat het scherm uit, dan toont hij niets, of met `alsTekst` alleen de
// inhoud zonder link (een naam in een rij blijft leesbaar). Zelfde regel als useFunctie().magNaar.
import type { RouteLocationRaw } from 'vue-router'
defineOptions({ inheritAttrs: false })
const props = defineProps<{ to: RouteLocationRaw; alsTekst?: boolean }>()
const { magNaar } = useFunctie()
const pad = computed(() => (typeof props.to === 'string' ? props.to : (props.to as { path?: string }).path ?? null))
const mag = computed(() => magNaar(pad.value))
</script>

<template>
  <NuxtLink v-if="mag" v-bind="$attrs" :to="props.to"><slot /></NuxtLink>
  <span v-else-if="props.alsTekst" :class="($attrs.class as string | undefined)"><slot /></span>
</template>
