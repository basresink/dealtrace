<script setup lang="ts">
const { toasts, sluit } = useToast()
</script>

<template>
  <div class="toast-stack" role="status" aria-live="polite">
    <div v-for="t in toasts" :key="t.id" class="toast" :class="`toast--${t.soort}`">
      <Icoon :naam="t.soort === 'fout' ? 'CircleAlert' : 'CircleCheck'" class="toast-icoon" />
      <span class="toast-tekst">{{ t.tekst }} <NuxtLink v-if="t.link" :to="t.link.naar" class="tekst-link">{{ t.link.tekst }}</NuxtLink><button v-if="t.actie" type="button" class="tekst-link" data-test="toast-actie" @click="t.actie.doe(); sluit(t.id)">{{ t.actie.tekst }}</button></span>
      <button type="button" class="toast-sluit" aria-label="Sluiten" @click="sluit(t.id)"><Icoon naam="X" :grootte="14" /></button>
    </div>
  </div>
</template>
