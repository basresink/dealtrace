<script setup lang="ts">
// Schakelaar uit het designsysteem (8). Tikvlak 44 px.
const props = defineProps<{ aan: boolean; label: string; uit?: boolean }>()
const emit = defineEmits<{ wissel: [aan: boolean] }>()
</script>

<template>
  <button
    type="button" class="schakelaar" :class="{ 'schakelaar--aan': props.aan, 'schakelaar--uit': props.uit }" role="switch"
    :aria-checked="props.aan" :aria-label="props.label" :disabled="props.uit" @click="emit('wissel', !props.aan)"
  >
    <span class="schakelaar-spoor" /><span class="schakelaar-duim" />
  </button>
</template>
