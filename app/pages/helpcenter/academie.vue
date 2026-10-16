<script setup lang="ts">
// De new business-academie: alle artikelen van de collectie newbusiness per categorie, met zoeken
// binnen de academie. Elk artikel heeft vijf vaste onderdelen en drie controlevragen (P25).
useHead({ title: 'Academie · Helpcenter · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Helpcenter · New business" titel="New business-academie" uitleg="Het vak zelf: waarom het werkt, zo doe je het, een voorbeeld, de valkuilen en hoe je het in Dealtrace doet." helpartikel="helpcenter">
      <template #acties><NuxtLink to="/helpcenter" class="dd-actie dd-actie--secundair" data-test="terug-helpcenter"><Icoon naam="ArrowLeft" class="dd-actie-icoon" />Helpcenter</NuxtLink></template>
    </PaginaKop>
    <HelpOverzicht collectie="newbusiness" />
    <HelpSteun zonder="academie" />
  </div>
</template>
