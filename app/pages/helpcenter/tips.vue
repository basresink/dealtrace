<script setup lang="ts">
// Tips & Tricks: korte artikelen van het DealDrive-team over slim werken in Dealtrace, per categorie, met
// zoeken binnen de tips. Elke tip noemt een concreet voordeel en linkt naar het artikel van de functie.
useHead({ title: 'Tips & Tricks · Helpcenter · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Helpcenter · Tips & Tricks" titel="Tips & Tricks" uitleg="Van het DealDrive-team: zo haal je meer uit Dealtrace. Elke tip noemt wat hij je oplevert, hoe je het doet en waar je op let." helpartikel="helpcenter">
      <template #acties><NuxtLink to="/helpcenter" class="dd-actie dd-actie--secundair" data-test="terug-helpcenter"><Icoon naam="ArrowLeft" class="dd-actie-icoon" />Helpcenter</NuxtLink></template>
    </PaginaKop>
    <HelpOverzicht collectie="tips" />
    <HelpSteun zonder="tips" />
  </div>
</template>
