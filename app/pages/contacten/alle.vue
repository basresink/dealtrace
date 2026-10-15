<script setup lang="ts">
const { functie } = useMe()
if (!functie('contacten.basis')?.beschikbaar) throw createError({ statusCode: 403, statusMessage: 'Geen toegang' })
useHead({ title: 'Alle contacten · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Contacten" titel="Alle contacten" helpartikel="buying-committee" />
    <section class="section section--laatste"><div class="container"><ContactLijst /></div></section>
  </div>
</template>
