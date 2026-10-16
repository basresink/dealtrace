<script setup lang="ts">
const { functie } = useMe()
if (!functie('contacten.basis')?.beschikbaar) throw createError({ statusCode: 403, statusMessage: 'Geen toegang' })
useHead({ title: 'Alle contacten · Dealtrace' })
</script>

<template><ContactLijst /></template>
