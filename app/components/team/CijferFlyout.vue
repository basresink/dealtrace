<script setup lang="ts">
// Wat er achter een getal zit (/team, /coaching, /analyse): een flyout met de regels die samen het getal
// maken, elk met een waarde en een metaregel, en waar mogelijk een link of een klik naar verder.
export interface CijferRegel { id?: string; label: string; waarde?: string; meta?: string; link?: string | null; klik?: () => void; rood?: boolean }
defineProps<{ open: boolean; kicker: string; titel: string; meta?: string | null; regels: CijferRegel[]; leeg?: string }>()
const emit = defineEmits<{ sluit: [] }>()
</script>

<template>
  <FlyoutShell v-if="open" open :kicker="kicker" :titel="titel" :meta="meta" breedte="smal" data-test="cijfer-flyout" sluit-test="cijfer-flyout-sluit" @sluit="emit('sluit')">
    <div class="fo-body">
      <LegeStaat v-if="!regels.length" :titel="leeg ?? 'Hier zit nog niets achter.'" />
      <ul v-else class="cf-lijst" data-test="cijfer-regels">
        <li v-for="(r, i) in regels" :key="r.id ?? i">
          <component :is="r.klik ? 'button' : 'div'" :type="r.klik ? 'button' : undefined" class="cf-rij" :class="{ 'cf-rij--knop': r.klik }" @click="r.klik?.()">
            <span class="cf-tekst">
              <FunctieLink v-if="r.link" :to="r.link" als-tekst class="cf-naam">{{ r.label }}</FunctieLink>
              <span v-else class="cf-naam">{{ r.label }}</span>
              <span v-if="r.meta" class="item-meta">{{ r.meta }}</span>
            </span>
            <strong v-if="r.waarde" class="cf-waarde tnum" :class="{ 'tekst-rood': r.rood }">{{ r.waarde }}</strong>
          </component>
        </li>
      </ul>
    </div>
  </FlyoutShell>
</template>

<style scoped>
.cf-lijst { list-style: none; margin: 0; padding: 0; }
.cf-rij { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; min-height: 48px; padding: 10px 0; background: none; border: 0; border-bottom: 1px solid var(--border); color: inherit; font: inherit; text-align: left; }
li:last-child > .cf-rij { border-bottom: 0; }
.cf-rij--knop { cursor: pointer; }
.cf-rij--knop:hover .cf-naam { color: var(--yellow-dark); }
.cf-tekst { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.cf-naam { font-size: 14px; font-weight: 600; color: var(--ink); overflow-wrap: anywhere; }
.cf-waarde { font-family: var(--font-serif); font-size: 18px; flex: 0 0 auto; }
</style>
