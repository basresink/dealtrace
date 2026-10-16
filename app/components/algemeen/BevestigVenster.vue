<script setup lang="ts">
// Bevestigingsvenster met optioneel een verplichte reden.
const props = defineProps<{ open: boolean; titel: string; tekst: string; bevestig: string; metReden?: boolean; gevaar?: boolean }>()
const emit = defineEmits<{ bevestigd: [reden: string]; geannuleerd: [] }>()
const reden = ref('')
watch(() => props.open, (o) => { if (o) reden.value = '' })
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="cd-overlay" @click.self="emit('geannuleerd')">
      <div class="cd-dialog" role="alertdialog" aria-modal="true" aria-labelledby="bv-titel">
        <div class="cd-head"><h2 id="bv-titel" class="cd-title">{{ titel }}</h2></div>
        <p class="cd-message">{{ tekst }}</p>
        <slot />
        <label v-if="metReden" class="veld">
          <span class="veld-label">Reden <span class="veld-verplicht">verplicht</span></span>
          <textarea v-model="reden" class="invoer" rows="3" data-test="reden" />
        </label>
        <div class="cd-foot">
          <button type="button" class="cd-btn cd-btn--ghost" @click="emit('geannuleerd')">Annuleren</button>
          <button type="button" class="cd-btn" :class="gevaar ? 'cd-btn--danger' : 'cd-btn--primary'" data-test="bevestig" :disabled="metReden && !reden.trim()" @click="emit('bevestigd', reden.trim())">{{ bevestig }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
