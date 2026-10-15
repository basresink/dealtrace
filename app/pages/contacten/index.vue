<script setup lang="ts">
const { functie } = useMe()
if (!functie('contacten.basis')?.beschikbaar) throw createError({ statusCode: 403, statusMessage: 'Geen toegang' })
useHead({ title: 'Contacten · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Contacten · top deze week" titel="Beslissers en beïnvloeders" uitleg="De belangrijkste mensen bij je eigen accounts." helpartikel="buying-committee">
      <template #acties><NuxtLink class="dd-actie dd-actie--primair" to="/contacten/alle">Alle contacten →</NuxtLink></template>
    </PaginaKop>
    <section class="section section--laatste"><div class="container"><ContactLijst top /></div></section>
  </div>
</template>
