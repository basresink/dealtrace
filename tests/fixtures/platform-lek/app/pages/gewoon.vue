<script setup lang="ts">
// Opzettelijk fout: een gewoon scherm dat een platformroute aanroept.
const { data } = await useFetch('/api/platform/klanten')
</script>
<template><div>{{ data }}</div></template>
