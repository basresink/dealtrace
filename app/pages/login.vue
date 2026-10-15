<script setup lang="ts">
// Inloggen in de ontwikkelmodus: kies een testgebruiker (tot P27 inloggen met een
// eenmalige code per mail bouwt). Alle gebruikers zijn fictief.
import { NIVEAU_LABEL, ROL_LABEL, WERKPLEK_LABEL, type Niveau, type Rol, type Werkplek } from '~~/shared/types'
definePageMeta({ layout: 'leeg' })
const { data: gebruikers } = await useFetch<any[]>('/api/sessie/ontwikkel-gebruikers')

async function kies(id: string) {
  await $fetch('/api/sessie/ontwikkel', { method: 'POST', body: { gebruikerId: id } })
  await navigateTo('/', { external: true })
}
</script>

<template>
  <div class="login-pagina">
    <span class="kicker kicker--streep">Dealtrace · ontwikkelmodus</span>
    <h1 class="title title--groot">Kies een testgebruiker.</h1>
    <p class="subtitle subtitle--groot">Inloggen met een code per mail komt in P27. Lokaal kies je hier wie je bent; alle gebruikers zijn fictief.</p>
    <div class="login-lijst">
      <button v-for="g in gebruikers" :key="g.id" type="button" class="login-rij" :data-test="`login-${g.id}`" @click="kies(g.id)">
        <span><strong>{{ g.name }}</strong><br><span class="meta">{{ g.organisatie }}</span></span>
        <span class="meta">{{ ROL_LABEL[g.role as Rol] }}<template v-if="g.role !== 'founder'"> · {{ NIVEAU_LABEL[g.niveau as Niveau] }} · {{ WERKPLEK_LABEL[g.werkplek as Werkplek] }}</template></span>
      </button>
    </div>
  </div>
</template>
