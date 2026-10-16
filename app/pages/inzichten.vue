<script setup lang="ts">
// Inzichten (vanaf Gevorderd) in de opzet van DealDrive: kop met Alle en Prospects, Filters en + Inzicht,
// statkaarten en een raster van inzichtkaarten (InzichtenFeed). Het tabblad Inzichten van Acties toont
// dezelfde feed. Een Beginner ziet de uitleg "Nog niet aangezet" (6.1); zijn inzichten staan bij Acties.
const { functie } = useMe()
const aan = !!functie('nav.inzichten')?.beschikbaar
useHead({ title: 'Inzichten · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="nav.inzichten" />
    <InzichtenFeed v-else met-kop />
  </div>
</template>
