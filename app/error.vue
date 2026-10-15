<script setup lang="ts">
// Foutpagina: 403 "Geen toegang", 404 "Niet gevonden", anders een algemene fout.
const props = defineProps<{ error: { statusCode?: number; statusMessage?: string } }>()
const titel = computed(() => (props.error.statusCode === 403 ? 'Geen toegang' : props.error.statusCode === 404 ? 'Niet gevonden' : 'Er ging iets mis'))
</script>

<template>
  <NuxtLayout>
    <section class="section section--laatste">
      <div class="container">
        <span class="kicker kicker--streep">{{ error.statusCode }}</span>
        <h1 class="title title--groot">{{ titel }}</h1>
        <p class="subtitle">{{ error.statusMessage }}</p>
        <button type="button" class="dd-actie dd-actie--primair mt-16" @click="clearError({ redirect: '/' })">Naar Vandaag</button>
      </div>
    </section>
  </NuxtLayout>
</template>
