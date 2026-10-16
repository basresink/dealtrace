<script setup lang="ts">
// De dekkingsbalk uit DealDrive: groen gezien of op schema, rood stil of achter, donkergrijs nooit.
const props = defineProps<{ gezien: number; stil: number; nooit: number; titel?: string }>()
const totaal = computed(() => props.gezien + props.stil + props.nooit)
const pct = (n: number) => `${totaal.value ? (n / totaal.value) * 100 : 0}%`
</script>

<template>
  <div v-if="totaal" class="db" role="img" :aria-label="titel ?? `${gezien} gezien, ${stil} stil, ${nooit} nooit`" :title="titel">
    <span class="db-deel db-deel--gezien" :style="{ width: pct(gezien) }" />
    <span class="db-deel db-deel--stil" :style="{ width: pct(stil) }" />
    <span class="db-deel db-deel--nooit" :style="{ width: pct(nooit) }" />
  </div>
  <span v-else class="db-leeg">geen accounts</span>
</template>

<style scoped>
.db { display: flex; width: 100%; min-width: 120px; height: 18px; background: var(--surface); border: 1px solid var(--border); overflow: hidden; }
.db-deel { display: block; height: 100%; }
.db-deel--gezien { background: var(--green); }
.db-deel--stil { background: var(--red); }
.db-deel--nooit { background: var(--ink-soft); }
.db-leeg { font-size: 12px; color: var(--muted); }
</style>
