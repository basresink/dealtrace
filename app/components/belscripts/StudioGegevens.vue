<script setup lang="ts">
// De gegevens die de AI voor een prospect krijgt, met waarde, bron en of ze gebruikt worden of
// ontbreken (Belscript Studio, Per prospect). "Bron" opent de herkomst van het gegeven.
import type { ProspectGegeven } from '~~/shared/belscripts'
defineProps<{ gegevens: ProspectGegeven[] }>()
const emit = defineEmits<{ bron: [sleutel: string] }>()
</script>

<template>
  <div class="tabel-schuif">
    <table class="tabel sg-tabel" data-test="sp-gegevens">
      <thead><tr><th>Gegeven</th><th>Waarde</th><th>Bron</th><th>Status</th></tr></thead>
      <tbody>
        <tr v-for="g in gegevens" :key="g.sleutel" :data-test="`sp-gegeven-${g.sleutel}`">
          <td><strong>{{ g.label }}</strong></td>
          <td>{{ g.waarde ?? 'onbekend' }}<template v-if="g.toelichting"><br><span class="meta">{{ g.toelichting }}</span></template></td>
          <td class="meta">{{ g.bron }}</td>
          <td>
            <span class="sg-status" :class="g.gebruikt ? 'sg-status--ok' : 'sg-status--mist'"><Icoon :naam="g.gebruikt ? 'Check' : 'TriangleAlert'" :grootte="14" />{{ g.gebruikt ? 'gebruikt' : 'ontbreekt' }}</span>
            <button v-if="g.gebruikt" type="button" class="dd-act sg-bron" :aria-label="`Bron van ${g.label}`" @click="emit('bron', g.sleutel)">Bron</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.sg-tabel td { vertical-align: top; }
.sg-status { display: inline-flex; align-items: center; gap: 4px; font-weight: 600; font-size: var(--fs-meta); white-space: nowrap; }
.sg-status--ok { color: var(--green); }
.sg-status--mist { color: var(--orange-dark); }
.sg-bron { margin-top: 4px; }
</style>
