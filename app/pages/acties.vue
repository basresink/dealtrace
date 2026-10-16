<script setup lang="ts">
// /acties heet nu /taken. Oude links (meldingen, bladwijzers) blijven werken; de query gaat mee.
// Het tabblad Inzichten is weg: ?tab=inzichten gaat naar /inzichten met de overige query.
definePageMeta({
  redirect: (to) => {
    const { tab, ...query } = to.query
    return { path: tab === 'inzichten' ? '/inzichten' : '/taken', query, hash: to.hash }
  },
})
</script>

<template><div /></template>
