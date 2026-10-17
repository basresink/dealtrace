<script setup lang="ts">
// Opslaan-status van een formulier op een pagina onder Instellingen, in dezelfde vorm als in de flyouts
// (FlyoutShell): Gewijzigd, Opslaan…, Opgeslagen en Kon niet opslaan. Werkt met useFlyoutOpslag
// (`opslag`, met tijd en "probeer opnieuw") en met useAutoBewaar (`status`, de tekst blijft gelijk).
import type { FlyoutOpslag } from '~/composables/useFlyoutOpslag'

const props = defineProps<{ opslag?: FlyoutOpslag | null; status?: string; test?: string }>()
const AUTO: Record<string, string> = { 'Opslaan…': 'bezig', Opgeslagen: 'klaar', 'Opslaan mislukt': 'fout' }
const stand = computed(() => (props.opslag ? props.opslag.stand : AUTO[props.status ?? ''] ?? 'leeg'))
</script>

<template>
  <span class="os-status" role="status" aria-live="polite" :data-test="test" :data-stand="stand">
    <template v-if="opslag">
      <span v-if="stand === 'gewijzigd'" class="os-stand os-stand--gewijzigd">Gewijzigd</span>
      <span v-else-if="stand === 'bezig'" class="os-stand os-stand--bezig"><Icoon naam="RefreshCw" :grootte="14" />Opslaan…</span>
      <span v-else-if="stand === 'klaar'" class="os-stand os-stand--klaar"><Icoon naam="Check" :grootte="14" />Opgeslagen om {{ opslag.tijd }}</span>
      <span v-else-if="stand === 'fout'" class="os-stand os-stand--fout"><Icoon naam="CircleAlert" :grootte="14" /><span>Kon niet opslaan, <button type="button" class="os-opnieuw" @click="opslag.opnieuw()">probeer opnieuw</button></span></span>
    </template>
    <span v-else-if="status" class="os-stand" :class="`os-stand--${stand}`"><Icoon v-if="stand === 'klaar'" naam="Check" :grootte="14" /><Icoon v-else-if="stand === 'fout'" naam="CircleAlert" :grootte="14" />{{ status }}</span>
  </span>
</template>

<style scoped>
.os-status { display: inline-flex; align-items: center; min-height: 28px; font-size: 12px; font-weight: 600; color: var(--muted); white-space: nowrap; }
.os-stand { display: inline-flex; align-items: center; gap: 6px; }
.os-stand--gewijzigd { color: var(--orange-dark, var(--orange)); }
.os-stand--gewijzigd::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: var(--orange); }
.os-stand--klaar { color: var(--green); }
.os-stand--fout { color: var(--red); white-space: normal; }
.os-opnieuw { min-height: 28px; padding: 0 2px; background: none; border: 0; font: inherit; font-weight: 700; color: var(--red); text-decoration: underline; cursor: pointer; }
</style>
