<script setup lang="ts">
// Offline-indicator uit 8.3: geel "Offline · 3 wijzigingen wachten"; bij een
// vastgelopen wachtrij rood met "Opnieuw proberen".
const { online, wachtend, vastgelopen, verstuur } = useSyncQueue()
const tekst = computed(() => {
  const n = wachtend.value
  const wacht = n === 1 ? '1 wijziging wacht' : `${n} wijzigingen wachten`
  if (vastgelopen.value) return `Versturen lukt niet · ${wacht}`
  return n ? `Offline · ${wacht}` : 'Offline'
})
</script>

<template>
  <div v-if="!online || vastgelopen" class="offline-strook" :class="{ 'offline-strook--vast': vastgelopen }" role="status" data-test="offline-strook">
    <Icoon naam="WifiOff" :grootte="14" />
    <span>{{ tekst }}</span>
    <button v-if="vastgelopen" type="button" @click="verstuur">Opnieuw proberen</button>
  </div>
</template>
