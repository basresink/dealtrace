<script setup lang="ts">
// Koppeling agenda (P13): de beheerder zet de koppeling met Microsoft 365 en Google aan voor de
// organisatie. De persoonlijke koppeling staat bij Account (/mij#agenda).
const { me } = useMe()
if (me.value?.gebruiker.rol !== 'beheerder') throw createError({ statusCode: 403, statusMessage: 'Alleen de beheerder' })
useHead({ title: 'Agenda · Koppelingen · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Instellingen · Koppelingen" titel="Agenda" uitleg="Microsoft 365 en Google: aanzetten voor de organisatie." helpartikel="agenda" />
    <section class="section section--laatste">
      <div class="container container--smal">
        <AgendaOrganisatie />
      </div>
    </section>
  </div>
</template>
