<script setup lang="ts">
// Top deze week (F03): de zes belangrijkste eigen prospects op score.
import { STATUS_LABEL, STATUS_PIL } from '~/utils/accountWeergave'
const { functie } = useMe()
if (!functie('prospects.lijst')?.beschikbaar) throw createError({ statusCode: 403, statusMessage: 'Geen toegang' })
const { data: top } = await useFetch<any[]>('/api/accounts/top', { default: () => [] })
const nu = new Date()
const maandag = new Date(nu); maandag.setDate(nu.getDate() - ((nu.getDay() + 6) % 7))
const zondag = new Date(maandag); zondag.setDate(maandag.getDate() + 6)
const d = (x: Date) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' }).format(x).replace('.', '').toUpperCase()
const planning = computed(() => functie('nav.planning')?.beschikbaar)
useHead({ title: 'Prospects · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop :kicker="`Top deze week · ${d(maandag)} tot ${d(zondag)}`" titel="Belangrijkste prospects van deze week" uitleg="Rangschikking op score: aanleiding, bereikbaarheid, fit, momentum en recentheid." helpartikel="de-accountkaart-lezen">
      <template #acties>
        <NuxtLink v-if="planning" class="dd-actie dd-actie--secundair" to="/planning">Prospectplanning →</NuxtLink>
        <NuxtLink class="dd-actie dd-actie--primair" to="/prospects/alle" data-test="alle-prospects">Alle prospects →</NuxtLink>
      </template>
    </PaginaKop>
    <section class="section section--laatste">
      <div class="container">
        <LegeStaat v-if="!top.length" titel="Nog geen prospects deze week." tekst="Voeg een prospect toe of importeer een lijst." />
        <div v-else class="instellingen-raster" data-test="top-week">
          <NuxtLink v-for="p in top" :key="p.id" :to="`/accounts/${p.id}`" class="kaart kaart--klik top-kaart">
            <span class="top-rang tnum">{{ p.rang }}</span>
            <header class="kaart-kop"><h2 class="kaart-titel">{{ p.naam }}</h2></header>
            <p class="kaart-meta">{{ [p.branche, p.plaats].filter(Boolean).join(' · ') }}</p>
            <p v-if="p.aanleiding" class="account-aanleiding" :class="{ 'account-aanleiding--heet': p.aanleiding.heet }">{{ p.aanleiding.tekst }}</p>
            <p class="mt-16"><span class="pil" :class="STATUS_PIL[p.status]">{{ STATUS_LABEL[p.status] }}</span> <span class="meta">Score {{ p.score }}</span></p>
            <span class="tabel-link">Open →</span>
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>
