<script setup lang="ts">
// Route (P27, 8.14): op de telefoon de tab Route van de buitendienst; de dagroute zelf bouwt P30.
// Op de laptop door naar Bezoeken.
const klasse = useSchermklasse()
onMounted(() => { if (klasse.value !== 'telefoon') navigateTo('/bezoeken', { replace: true }) })
useHead({ title: 'Route · Dealtrace' })
</script>

<template>
  <section class="section">
    <div class="container">
      <LegeStaat titel="Route" tekst="Deze pagina komt in een volgende versie." />
    </div>
  </section>
</template>
