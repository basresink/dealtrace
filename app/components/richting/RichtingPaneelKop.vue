<script setup lang="ts">
// Kop van een tabblad op Richting: kicker, titel, de status van het onderdeel (versie, datum,
// Controleren, verouderd) en het gele blok "Waarom dit ertoe doet".
import { RICHTING_TEKST } from '~~/shared/richting'

defineProps<{
  kicker: string
  titel: string
  waarom: string
  st?: { status: string; versie: number; bevestigdOp: string | null; controleren?: boolean; verouderd?: boolean } | null
}>()
const datum = (d: string | null) => (d ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' }).format(new Date(d)) : '')
</script>

<template>
  <div class="ri-kop">
    <div class="ri-kop-tekst">
      <span class="kicker kicker--streep">{{ kicker }}</span>
      <h2 class="ri-kop-titel">{{ titel }}</h2>
    </div>
    <p class="ri-status" data-test="vv-status">
      <Label soort="richting" :waarde="st?.status === 'bevestigd' ? 'bevestigd' : 'concept'" :tekst="st?.status === 'bevestigd' ? `Bevestigd · versie ${st.versie}` : null" />
      <span v-if="st?.bevestigdOp" class="meta">{{ datum(st.bevestigdOp) }}</span>
      <Label v-if="st?.controleren" soort="richting" waarde="controleren" data-test="controleren" />
      <Label v-if="st?.verouderd" soort="richting" waarde="verouderd" data-test="verouderd" />
      <slot name="status" />
    </p>
  </div>
  <div class="ri-waarom" data-test="ri-waarom">
    <Icoon naam="Lightbulb" :grootte="16" class="ri-waarom-ico" />
    <strong class="ri-waarom-kop">{{ RICHTING_TEKST.waaromKop }}</strong>
    <p class="ri-waarom-tekst">{{ waarom }}</p>
  </div>
</template>

<style scoped>
.ri-kop { display: flex; flex-wrap: wrap; gap: 12px 24px; justify-content: space-between; align-items: flex-end; }
.ri-kop-tekst { min-width: 0; flex: 1 1 320px; }
.ri-kop-titel { margin: 6px 0 0; font-family: var(--font-serif); font-size: 26px; font-weight: 700; line-height: 1.2; color: var(--ink); }
.ri-status { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; margin: 0; }
.ri-waarom { margin-top: 14px; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 12px; align-items: start; max-width: 860px; padding: 12px 14px; background: var(--yellow-licht); border: 1px solid var(--yellow-dark); border-radius: 2px; }
.ri-waarom-ico { margin-top: 1px; color: var(--ink); }
.ri-waarom-kop { font-size: var(--fs-label); font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink); }
.ri-waarom-tekst { grid-column: 2; margin: 0; font-size: var(--fs-body); line-height: 1.55; color: var(--ink); }
</style>
