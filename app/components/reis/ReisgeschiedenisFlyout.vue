<script setup lang="ts">
// Reisgeschiedenis (F05): per regel datum, van fase, naar fase, gebeurtenis, door en reden.
// Op de telefoon een schuifvenster.
const props = defineProps<{ open: boolean; accountId: string; naam: string }>()
const emit = defineEmits<{ sluit: [] }>()
const regels = ref<any[]>([])
const laden = ref(false)
watch(() => props.open, async (o) => {
  if (!o) return
  laden.value = true
  try { regels.value = (await $fetch<any>(`/api/accounts/${props.accountId}/reisgeschiedenis`)).regels } finally { laden.value = false }
}, { immediate: true })
const datum = (t: string) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(t))
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fo-overlay" @click.self="emit('sluit')">
      <aside class="fo-panel fo-panel--smal fo-panel--schuif" role="dialog" aria-modal="true" aria-labelledby="rg-titel" data-test="reisgeschiedenis">
        <header class="fo-head">
          <div class="fo-head-tekst"><span class="fo-kicker">Reisgeschiedenis</span><h2 id="rg-titel" class="fo-titel">{{ naam }}</h2></div>
          <button type="button" class="fo-sluit" aria-label="Sluiten" @click="emit('sluit')"><Icoon naam="X" /></button>
        </header>
        <div class="fo-body">
          <p v-if="laden" class="meta">Laden…</p>
          <LegeStaat v-else-if="!regels.length" titel="Nog geen geschiedenis." tekst="Elke fasewissel komt hier, met wie of wat hem meldde." />
          <ol v-else class="reis-historie">
            <li v-for="r in regels" :key="r.id" class="reis-historie-rij">
              <span class="meta tnum">{{ datum(r.op) }}</span>
              <span><strong>{{ r.van ? `${r.van} → ` : '' }}{{ r.naar }}</strong><template v-if="r.vanStatus !== r.naarStatus && r.naarStatus"> · status {{ r.naarStatus }}</template></span>
              <span class="meta">{{ r.gebeurtenis }} · {{ r.door === 'motor' ? 'motor' : r.door?.replace(/^Testgebruiker /, '') }}</span>
              <span v-if="r.reden" class="reis-historie-reden">{{ r.reden }}</span>
            </li>
          </ol>
        </div>
      </aside>
    </div>
  </Teleport>
</template>
