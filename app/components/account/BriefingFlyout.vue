<script setup lang="ts">
// Briefing van het account (knop "Briefing" op de accountkaart, opzet uit DealDrive): de Pitstop in een venster.
defineProps<{ open: boolean; account: { id: string; naam: string } }>()
const emit = defineEmits<{ sluit: [] }>()
const { functie } = useMe()
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fo-overlay" @click.self="emit('sluit')">
      <aside class="fo-panel" role="dialog" aria-modal="true" aria-labelledby="bf-titel" data-test="briefing-flyout">
        <header class="fo-head">
          <div class="fo-head-tekst"><span class="fo-kicker">Briefing</span><h2 id="bf-titel" class="fo-titel">{{ account.naam }}</h2><p class="fo-meta">Wat je moet weten voor je volgende contact.</p></div>
          <button type="button" class="fo-sluit" aria-label="Sluiten" @click="emit('sluit')"><Icoon naam="X" /></button>
        </header>
        <div class="fo-body">
          <article class="fo-blok"><BriefingPaneel v-if="functie('briefing.lezen')?.beschikbaar" onderwerp="account" :id="account.id" /><p v-else class="meta">De briefing staat nog niet aan op jouw niveau.</p></article>
        </div>
      </aside>
    </div>
  </Teleport>
</template>
