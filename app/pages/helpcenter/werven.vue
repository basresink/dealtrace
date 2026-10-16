<script setup lang="ts">
// Nieuwe klanten werven: alle artikelen van de collectie werven per categorie, met zoeken binnen deze
// artikelen. De inhoud komt uit eigen vakliteratuur (eerst de whitepaper The Perfect Pitch); elk artikel
// noemt zijn bron. Voor iedereen, net als de academie.
useHead({ title: 'Nieuwe klanten werven · Helpcenter · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Helpcenter · Nieuwe klanten werven" titel="Nieuwe klanten werven" uitleg="Je pitch van onderzoek tot presentatie: waarom klanten kopen, welke waarde je brengt, je verhaal en hoe je een gesprek opent." helpartikel="helpcenter">
      <template #acties><NuxtLink to="/helpcenter" class="dd-actie dd-actie--secundair" data-test="terug-helpcenter"><Icoon naam="ArrowLeft" class="dd-actie-icoon" />Helpcenter</NuxtLink></template>
    </PaginaKop>
    <HelpOverzicht collectie="werven" />
    <HelpSteun zonder="werven" />
  </div>
</template>
