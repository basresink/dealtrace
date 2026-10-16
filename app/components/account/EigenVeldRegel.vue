<script setup lang="ts">
// Eén eigen veld in het Info-venster, met inline bewerken (BewerkVeld). Meerkeuze houdt de lijst met
// vinkjes (EigenVeldInvoer); een veld dat alleen de beheerder wijzigt, staat alleen-lezen.
const props = defineProps<{ veld: { sleutel: string; naam: string; type: string; opties?: { waarde: string; label: string }[]; hulp?: string | null; bewerkbaarDoor?: string }; waarde: unknown; uit?: boolean }>()
const emit = defineEmits<{ bewaar: [waarde: unknown] }>()
const SOORT: Record<string, 'text' | 'tel' | 'email' | 'url' | 'select' | 'number' | 'date' | 'textarea'> = {
  tekst: 'text', langeTekst: 'textarea', getal: 'number', bedrag: 'number', datum: 'date', janee: 'select', keuzelijst: 'select', telefoon: 'tel', email: 'email', link: 'url', gebruiker: 'text',
}
const opties = computed(() => props.veld.type === 'janee'
  ? [{ waarde: '', label: '–' }, { waarde: 'true', label: 'Ja' }, { waarde: 'false', label: 'Nee' }]
  : [{ waarde: '', label: '–' }, ...(props.veld.opties ?? [])])
const tekst = computed(() => (props.waarde === null || props.waarde === undefined ? '' : String(props.waarde)))
const lijst = ref<unknown>(props.waarde)
watch(() => props.waarde, (w) => { lijst.value = w })
</script>

<template>
  <div v-if="veld.type === 'meerkeuze'" class="evr-lijst" :data-veld="veld.sleutel">
    <EigenVeldInvoer v-model="lijst" :veld="veld" :uit="uit" @change="emit('bewaar', lijst)" />
  </div>
  <BewerkVeld v-else :label="veld.naam" :waarde="tekst" :type="SOORT[veld.type] ?? 'text'" :opties="opties" :uit="uit" :data-veld="veld.sleutel" @bewaar="emit('bewaar', $event === '' ? null : $event)" />
</template>

<style scoped>
.evr-lijst { padding: 6px 0; }
</style>
