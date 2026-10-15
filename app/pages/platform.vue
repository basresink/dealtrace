<script setup lang="ts">
// Platformbeheer voor de founder. Organisaties, pakketten en features per niveau
// (/platform/features) volgen in P02 en P09.
const { me } = useMe()
if (me.value?.gebruiker.rol !== 'founder') throw createError({ statusCode: 403, statusMessage: 'Alleen voor de founder' })
useHead({ title: 'Platformbeheer · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Platformbeheer" titel="Platformbeheer" uitleg="Organisaties, pakketten en welke functies per niveau aanstaan." helpartikel="platformbeheer" />
    <section class="section section--laatste">
      <div class="container">
        <div class="instellingen-raster">
          <article class="kaart kaart--vlak"><header class="kaart-kop"><h2 class="kaart-titel">Organisaties</h2></header><p class="kaart-meta">Aanmaken, pakket en seats.</p><p class="veld-uitleg">Komt in een volgende versie (P02).</p></article>
          <article class="kaart kaart--vlak"><header class="kaart-kop"><h2 class="kaart-titel">Features per niveau</h2></header><p class="kaart-meta">Per functie aan of uit voor Beginner, Gevorderd en Expert.</p><p class="veld-uitleg">Komt in een volgende versie (P09).</p></article>
          <article class="kaart kaart--vlak"><header class="kaart-kop"><h2 class="kaart-titel">AI-credits</h2></header><p class="kaart-meta">Credits per abonnement.</p><p class="veld-uitleg">Komt in een volgende versie (P33).</p></article>
        </div>
      </div>
    </section>
  </div>
</template>
