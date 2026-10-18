<script setup lang="ts">
// Tips & Tricks: korte artikelen van het DealDrive-team over slim werken in Dealtrace, per categorie, met
// zoeken binnen de tips. Elke tip noemt een concreet voordeel en linkt naar het artikel van de functie.
useHead({ title: 'Tips & Tricks · Helpcenter · Dealtrace' })
// Terug naar de start gaat via het kruimelpad; onder de kop de categorieën als filter-pillen.
</script>

<template>
  <div>
    <PaginaKop titel="Tips & Tricks" uitleg="Van het DealDrive-team: zo haal je meer uit Dealtrace. Elke tip noemt wat hij je oplevert, hoe je het doet en waar je op let." helpartikel="helpcenter">
      <template #kicker><HelpKruimelpad :pad="[{ label: 'Helpcenter', to: '/helpcenter' }, { label: 'Tips & Tricks' }]" /></template>
      <template #na><HelpCategorieen collectie="tips" /></template>
    </PaginaKop>
    <HelpOverzicht collectie="tips" />
    <HelpSteun zonder="tips" />
  </div>
</template>
