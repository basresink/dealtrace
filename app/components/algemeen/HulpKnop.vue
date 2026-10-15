<script setup lang="ts">
// De knop "Hulp" in de paginakop: opent het artikel van dit scherm in een flyout.
defineProps<{ artikel?: string | null }>()
const { toon } = useHulp()
</script>

<template>
  <button type="button" class="dd-actie dd-actie--secundair" data-test="hulp-knop" @click="toon(artikel)"><Icoon naam="CircleHelp" class="dd-actie-icoon" />Hulp</button>
</template>
