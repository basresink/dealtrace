<script setup lang="ts">
// /meldingen is verhuisd naar /notificaties; de query (soort, alle) gaat mee.
definePageMeta({ redirect: (to) => ({ path: '/notificaties', query: to.query, hash: to.hash }) })
</script>

<template>
  <div />
</template>
