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
  <FlyoutShell v-if="open" open titel-id="rg-titel" breedte="smal" data-test="reisgeschiedenis" @sluit="emit('sluit')">
      <template #kop><span class="fo-kicker">Reisgeschiedenis</span><h2 id="rg-titel" class="fo-titel">{{ naam }}</h2></template>
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
    </FlyoutShell>
</template>
