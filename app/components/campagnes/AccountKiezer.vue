<script setup lang="ts">
// Accounts kiezen op naam (vrije keuze in de wizard, + Accounts op het bord). Tien treffers per zoekopdracht.
const gekozen = defineModel<{ id: string; naam: string }[]>({ default: () => [] })
const q = ref('')
const treffers = ref<{ id: string; naam: string; plaats?: string | null }[]>([])
let timer: any
watch(q, (v) => {
  clearTimeout(timer)
  timer = setTimeout(async () => { treffers.value = v.trim().length < 2 ? [] : await $fetch<any[]>('/api/accounts/kies', { query: { q: v } }).catch(() => []) }, 250)
})
function kies(a: { id: string; naam: string }) { if (!gekozen.value.some((x) => x.id === a.id)) gekozen.value = [...gekozen.value, { id: a.id, naam: a.naam }]; q.value = '' }
function weg(id: string) { gekozen.value = gekozen.value.filter((x) => x.id !== id) }
</script>

<template>
  <div class="cp-kiezer">
    <input v-model="q" class="invoer" placeholder="Zoek een account op naam" aria-label="Zoek een account" data-test="account-zoek">
    <ul v-if="treffers.length" class="cp-treffers">
      <li v-for="t in treffers" :key="t.id"><button type="button" class="cp-treffer" :data-test="`kies-${t.id}`" @click="kies(t)">{{ t.naam }}<span v-if="t.plaats" class="rij-sub"> · {{ t.plaats }}</span></button></li>
    </ul>
    <div v-if="gekozen.length" class="chips">
      <span v-for="g in gekozen" :key="g.id" class="chip">{{ g.naam }}<button type="button" class="chip-weg" :aria-label="`${g.naam} weghalen`" @click="weg(g.id)"><Icoon naam="X" :grootte="12" /></button></span>
    </div>
  </div>
</template>
