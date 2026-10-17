<script setup lang="ts">
// Redenen voor nee, afkoeling en terugkomregels staan nu op Instellingen, Terugkomen. Deze oude route
// verwijst door naar het tabblad Verliesredenen.
await navigateTo('/instellingen/terugkomen?tab=redenen', { replace: true })
</script>

<template>
  <div />
</template>
