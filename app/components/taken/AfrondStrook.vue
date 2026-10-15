<script setup lang="ts">
// Meldingsstrook boven de onderbalk op de telefoon: "Afgerond." met "Ongedaan maken" (5 seconden).
const { strook } = useAfronden()
</script>

<template>
  <div v-if="strook" class="afrond-strook" role="status" data-test="afrond-strook">
    <span>{{ strook.tekst }}</span>
    <button type="button" class="dd-act" data-test="ongedaan" @click="strook.ongedaan?.()">Ongedaan maken</button>
  </div>
</template>
