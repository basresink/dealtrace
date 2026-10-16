<script setup lang="ts">
// /resultaten heet nu /mijn-dashboard. Oude links (meldingen, bladwijzers) blijven werken; de query gaat mee.
definePageMeta({ redirect: (to) => ({ path: '/mijn-dashboard', query: to.query, hash: to.hash }) })
</script>

<template><div /></template>
