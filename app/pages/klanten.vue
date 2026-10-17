<script setup lang="ts">
// Bestaande klanten uit DealDrive of het CRM, alleen lezen en niet in de zijbalk: bron voor kansen langs de route,
// warme introducties en om klanten uit prospectlijsten te houden. Dealtrace promoveert niet (B17).
const { functie } = useMe()
if (!functie('prospects.lijst')?.beschikbaar) throw createError({ statusCode: 403, statusMessage: 'Geen toegang' })
useHead({ title: 'Bestaande klanten · Dealtrace' })
</script>

<template><AccountLijst soort="klant" /></template>
