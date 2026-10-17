<script setup lang="ts">
// Koppeling agenda (P13): de beheerder zet de koppeling met Microsoft 365 en Google aan voor de
// organisatie. De persoonlijke koppeling staat bij Account (/mij#agenda).
const { me } = useMe()
if (me.value?.gebruiker.rol !== 'beheerder') throw createError({ statusCode: 403, statusMessage: 'Alleen de beheerder' })
useHead({ title: 'Agenda · Koppelingen · Dealtrace' })
</script>

<template>
  <div>
    <InstellingenKop groep="Koppelingen" titel="Agenda" uitleg="Microsoft 365 en Google: aanzetten voor de organisatie. Ieder koppelt daarna zijn eigen agenda bij Account." helpartikel="agenda" />
    <section class="section section--laatste">
      <div class="container container--smal">
        <AgendaOrganisatie />
      </div>
    </section>
  </div>
</template>
