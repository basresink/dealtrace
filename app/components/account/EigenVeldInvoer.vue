<script setup lang="ts">
// Invoer voor één eigen veld, per type (F19).
const props = defineProps<{ veld: { sleutel: string; naam: string; type: string; opties?: { waarde: string; label: string }[]; data?: any; hulp?: string | null }; uit?: boolean }>()
const model = defineModel<any>()
const opties = computed(() => props.veld.opties ?? props.veld.data?.opties ?? [])
const hulp = computed(() => props.veld.hulp ?? props.veld.data?.hulp)
const invoerType = computed(() => ({ getal: 'number', bedrag: 'number', datum: 'date', telefoon: 'tel', email: 'email', link: 'url' } as Record<string, string>)[props.veld.type] ?? 'text')
</script>

<template>
  <label class="veld" :data-veld="veld.sleutel">
    <span class="veld-label">{{ veld.naam }}</span>
    <select v-if="veld.type === 'keuzelijst'" v-model="model" class="invoer" :disabled="uit"><option :value="null">–</option><option v-for="o in opties" :key="o.waarde" :value="o.waarde">{{ o.label }}</option></select>
    <select v-else-if="veld.type === 'janee'" v-model="model" class="invoer" :disabled="uit"><option :value="null">–</option><option :value="true">Ja</option><option :value="false">Nee</option></select>
    <select v-else-if="veld.type === 'meerkeuze'" v-model="model" class="invoer" multiple :disabled="uit"><option v-for="o in opties" :key="o.waarde" :value="o.waarde">{{ o.label }}</option></select>
    <textarea v-else-if="veld.type === 'langeTekst'" v-model="model" class="invoer" rows="3" :disabled="uit" />
    <input v-else v-model="model" class="invoer" :type="invoerType" :disabled="uit">
    <span v-if="hulp" class="veld-uitleg">{{ hulp }}</span>
  </label>
</template>
