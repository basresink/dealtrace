<script setup lang="ts">
// De drie vaste icoonknoppen vooraan in de knoppenrij van elke paginakop: zoeken (het zoekvenster,
// net als de zoekknop in de zijbalk), de AI-chat (alleen als assistent.chat aan staat) en hulp
// (het artikel van dit scherm in de hulpflyout). Daarna volgen de knoppen van de pagina. Op de
// telefoon staan zoeken en AI in de mobiele kop, dus toont de paginakop daar alleen hulp.
const props = defineProps<{
  /** Slug van het helpartikel; zonder slug zoekt de flyout het artikel bij de route. */
  artikel?: string | null
  /** Context voor de AI-chat, zoals het account van een accountkaart. */
  ai?: { accountId?: string | null; label?: string; route?: string }
  /** Eigen zoekactie van de pagina (zoals het helpcenter) in plaats van het zoekvenster van de app. */
  zoeken?: { actie: () => void; aan?: boolean; label?: string; test?: string; controls?: string }
}>()
const { functie } = useMe()
const aiAan = computed(() => !!functie('assistent.chat')?.beschikbaar)
const { openen: openAi } = useAssistent()
const { open: zoekenOpen } = useZoeken()
const { toon: toonHulp } = useHulp()
</script>

<template>
  <span class="kop-iconen" data-test="kop-iconen">
    <button v-if="props.zoeken" type="button" class="dd-actie dd-actie--icoon kop-icoon" :class="{ 'kop-icoon--aan': props.zoeken.aan }" :aria-label="props.zoeken.label ?? 'Zoeken'" :title="props.zoeken.label ?? 'Zoeken'" :aria-expanded="!!props.zoeken.aan" :aria-controls="props.zoeken.controls" :data-test="props.zoeken.test ?? 'kop-zoeken'" @click="props.zoeken.actie()"><Icoon naam="Search" /></button>
    <button v-else type="button" class="dd-actie dd-actie--icoon kop-icoon kop-icoon--groot" aria-label="Zoeken" title="Zoeken" data-test="kop-zoeken" @click="zoekenOpen = true"><Icoon naam="Search" /></button>
    <button v-if="aiAan" type="button" class="dd-actie dd-actie--icoon kop-icoon kop-icoon--groot" aria-label="Vraag AI" title="Vraag AI" data-test="vraag-ai" @click="openAi(props.ai)"><Icoon naam="Sparkles" /></button>
    <button type="button" class="dd-actie dd-actie--icoon kop-icoon" aria-label="Hulp bij dit scherm" title="Hulp" data-test="hulp-knop" @click="toonHulp(props.artikel)"><Icoon naam="CircleHelp" /></button>
  </span>
</template>

<style scoped>
.kop-iconen { display: contents; }
/* Vierkant van 44 bij 44 px met rand, ook in een rij waar knoppen 36 px hoog zijn. */
.kop-icoon { width: 44px; min-width: 44px; height: 44px; min-height: 44px; padding: 0; flex: 0 0 44px; justify-content: center; }
/* Op de telefoon staan zoeken en AI al in de mobiele kop; daar blijft alleen hulp over. */
.kop-icoon--aan { background: var(--ink); border-color: var(--ink); color: var(--yellow); }
@media (max-width: 767px) { .kop-icoon--groot { display: none; } }
</style>
