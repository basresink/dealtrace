<script setup lang="ts">
// Inzichten: vanaf Gevorderd een eigen ingang naar het tabblad Inzichten van Acties.
// Een Beginner ziet de uitleg "Nog niet aangezet" (6.1); zijn inzichten staan bij Acties.
const { functie } = useMe()
const aan = !!functie('nav.inzichten')?.beschikbaar
if (aan) await navigateTo('/acties?tab=inzichten', { replace: true })
useHead({ title: 'Inzichten · Dealtrace' })
</script>

<template><div><NietAangezetKop v-if="!aan" sleutel="nav.inzichten" /></div></template>
