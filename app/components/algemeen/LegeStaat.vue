<script setup lang="ts">
defineProps<{ kicker?: string; titel: string; tekst?: string }>()
</script>

<template>
  <div class="lege-staat">
    <span v-if="kicker" class="lege-staat-kicker">{{ kicker }}</span>
    <p class="lege-staat-titel">{{ titel }}</p>
    <p v-if="tekst" class="lege-staat-tekst">{{ tekst }}</p>
  </div>
</template>
