<script setup lang="ts">
// Een venster van de accountkaart of de contactkaart dat onder Meer hangt (Dossier, Kwalificatie, Ritme,
// Reis): dezelfde opzet als de andere flyouts (kicker, titel, uitleg, sluiten) met de inhoud als slot.
// Sluit met Escape, de sluitknop en een klik naast het venster.
const props = withDefaults(defineProps<{ open: boolean; kicker: string; titel: string; meta?: string | null; test: string; maat?: 'smal' | 'normaal' | 'breed' }>(), { meta: null, maat: 'normaal' })
const emit = defineEmits<{ sluit: [] }>()
const titelId = computed(() => `${props.test}-titel`)
function toets(e: KeyboardEvent) { if (e.key === 'Escape' && props.open) emit('sluit') }
onMounted(() => document.addEventListener('keydown', toets))
onBeforeUnmount(() => document.removeEventListener('keydown', toets))
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fo-overlay" @click.self="emit('sluit')">
      <aside class="fo-panel fo-panel--schuif" :class="{ 'fo-panel--smal': maat === 'smal', 'fo-panel--breed': maat === 'breed' }" role="dialog" aria-modal="true" :aria-labelledby="titelId" :data-test="test">
        <header class="fo-head">
          <div class="fo-head-tekst">
            <span class="fo-kicker">{{ kicker }}</span>
            <h2 :id="titelId" class="fo-titel">{{ titel }}</h2>
            <p v-if="meta" class="fo-meta">{{ meta }}</p>
          </div>
          <button type="button" class="fo-sluit" aria-label="Sluiten" :data-test="`${test}-sluit`" @click="emit('sluit')"><Icoon naam="X" /></button>
        </header>
        <div class="fo-body kf-body">
          <slot />
        </div>
      </aside>
    </div>
  </Teleport>
</template>

<style scoped>
.kf-body { display: flex; flex-direction: column; gap: var(--kaart-gap, 16px); }
.kf-body :deep(.kaart) { margin: 0; }
</style>
