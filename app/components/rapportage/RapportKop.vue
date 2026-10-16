<script setup lang="ts">
// Paginakop van Mijn dashboard en de funnel, zoals DealDrive /rapportage: kicker met streep, kop als zin,
// subtitel, en rechts de knoppen met Filters (teller en pijl) die de periodestrook opent.
defineProps<{ kicker: string; titel: string; subtitel?: string | null; filterAantal?: number; helpartikel?: string }>()
const open = defineModel<boolean>('open', { default: false })
const { functie } = useMe()
const aiAan = computed(() => !!functie('assistent.chat')?.beschikbaar)
const { openen: openAi } = useAssistent()
</script>

<template>
  <section class="section" data-test="rapport-kop">
    <div class="container">
      <div class="sec-head rk-head">
        <div class="rk-tekst">
          <span class="kicker kicker--streep" data-test="rapport-kicker">{{ kicker }}</span>
          <h1 class="title title--groot" data-test="rapport-titel">{{ titel }}</h1>
          <p v-if="subtitel" class="subtitle subtitle--groot">{{ subtitel }}</p>
        </div>
        <div class="toolbar-buttons rk-knoppen">
          <slot name="acties" />
          <button type="button" class="dd-actie dd-actie--secundair" :class="{ 'rk-filter--aan': open || filterAantal }" :aria-expanded="open" aria-controls="rapport-filters" data-test="rapport-filters-knop" @click="open = !open">
            <Icoon naam="SlidersHorizontal" class="dd-actie-icoon" />Filters<span v-if="filterAantal" class="rk-teller">{{ filterAantal }}</span><Icoon naam="ChevronDown" class="rk-pijl" :class="{ 'rk-pijl--open': open }" />
          </button>
          <button v-if="aiAan" type="button" class="dd-actie dd-actie--secundair" data-test="vraag-ai" @click="openAi()"><Icoon naam="Sparkles" class="dd-actie-icoon" />Vraag AI</button>
          <HulpKnop v-if="helpartikel" :artikel="helpartikel" />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.rk-head { align-items: flex-end; }
.rk-tekst { flex: 1 1 420px; min-width: 0; max-width: 760px; }
.rk-knoppen { flex-wrap: wrap; }
.rk-filter--aan { border-color: var(--ink); }
.rk-teller { padding: 0 6px; margin-left: 2px; font-size: 11px; font-weight: 800; background: var(--yellow); color: var(--ink); border-radius: 2px; }
.rk-pijl { width: 14px; height: 14px; margin-left: 2px; transition: transform 150ms ease-out; }
.rk-pijl--open { transform: rotate(180deg); }
</style>
