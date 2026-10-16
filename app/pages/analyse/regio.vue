<script setup lang="ts">
// /analyse/regio is de bezoekanalyse geworden (opzet DealDrive /bezoek-analyse). Oude links en
// bladwijzers sturen door, met hun query (scope=team wordt het teambeeld).
definePageMeta({ redirect: (to) => ({ path: '/bezoek-analyse', query: to.query }) })
</script>

<template>
  <div />
</template>
