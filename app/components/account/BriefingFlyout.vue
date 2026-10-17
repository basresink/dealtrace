<script setup lang="ts">
// Briefing van het account (knop "Briefing" op de accountkaart, opzet uit DealDrive): de Pitstop in een venster.
defineProps<{ open: boolean; account: { id: string; naam: string } }>()
const emit = defineEmits<{ sluit: [] }>()
const { functie } = useMe()
</script>

<template>
  <FlyoutShell v-if="open" open titel-id="bf-titel" data-test="briefing-flyout" :ai="{ accountId: account.id, label: account.naam, voorstellen: ['Vat de briefing samen in drie zinnen', 'Met welke vraag open ik het gesprek?', 'Welke bezwaren kan ik verwachten?'] }" @sluit="emit('sluit')">
      <template #kop><span class="fo-kicker">Briefing</span><h2 id="bf-titel" class="fo-titel">{{ account.naam }}</h2><p class="fo-meta">Wat je moet weten voor je volgende contact.</p></template>
        <div class="fo-body">
          <article class="fo-blok"><BriefingPaneel v-if="functie('briefing.lezen')?.beschikbaar" onderwerp="account" :id="account.id" /><p v-else class="meta">De briefing staat nog niet aan op jouw niveau.</p></article>
        </div>
    </FlyoutShell>
</template>
