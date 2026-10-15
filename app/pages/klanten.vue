<script setup lang="ts">
// Klanten uit DealDrive of het CRM (kansen langs de route en winback); Dealtrace promoveert niet (B17).
const { functie } = useMe()
if (!functie('prospects.lijst')?.beschikbaar) throw createError({ statusCode: 403, statusMessage: 'Geen toegang' })
useHead({ title: 'Klanten · Dealtrace' })
</script>

<template><AccountLijst soort="klant" /></template>
