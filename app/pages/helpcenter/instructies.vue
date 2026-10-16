<script setup lang="ts">
// Hoe werkt Dealtrace: alle productartikelen per categorie, met zoeken binnen de selectie (opzet van
// /helpcenter/instructies in DealDrive). Inrichten en Voor de salesmanager laat de server alleen zien
// aan wie ze mag lezen.
useHead({ title: 'Hoe werkt Dealtrace · Helpcenter · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Helpcenter · Hoe werkt Dealtrace" titel="Zo werkt Dealtrace voor jou" uitleg="Uitleg per scherm, per onderwerp. Je ziet alleen wat op jouw werk van toepassing is." helpartikel="helpcenter">
      <template #acties><NuxtLink to="/helpcenter" class="dd-actie dd-actie--secundair" data-test="terug-helpcenter"><Icoon naam="ArrowLeft" class="dd-actie-icoon" />Helpcenter</NuxtLink></template>
    </PaginaKop>
    <HelpOverzicht collectie="product" />
    <HelpSteun zonder="instructies" />
  </div>
</template>
