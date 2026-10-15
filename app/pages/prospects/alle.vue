<script setup lang="ts">
const { functie } = useMe()
if (!functie('prospects.lijst')?.beschikbaar) throw createError({ statusCode: 403, statusMessage: 'Geen toegang' })
useHead({ title: 'Alle prospects · Dealtrace' })
</script>

<template><AccountLijst soort="prospect" /></template>
