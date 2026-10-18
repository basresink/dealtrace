<script setup lang="ts">
// Hoe werkt Dealtrace: alle productartikelen per categorie, met zoeken binnen de selectie (opzet van
// /helpcenter/instructies in DealDrive). Inrichten en Voor de salesmanager laat de server alleen zien
// aan wie ze mag lezen.
useHead({ title: 'Hoe werkt Dealtrace · Helpcenter · Dealtrace' })
// Terug naar de start gaat via het kruimelpad; onder de kop de categorieën als filter-pillen.
</script>

<template>
  <div>
    <PaginaKop titel="Zo werkt Dealtrace voor jou" uitleg="Uitleg per scherm, per onderwerp. Je ziet alleen wat op jouw werk van toepassing is." helpartikel="helpcenter">
      <template #kicker><HelpKruimelpad :pad="[{ label: 'Helpcenter', to: '/helpcenter' }, { label: 'Hoe werkt Dealtrace' }]" /></template>
      <template #na><HelpCategorieen collectie="product" /></template>
    </PaginaKop>
    <HelpOverzicht collectie="product" />
    <HelpSteun zonder="instructies" />
  </div>
</template>
