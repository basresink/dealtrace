<script setup lang="ts">
// Rijmodus (P26, 8.6): alleen grote knoppen van 54 px (handschoenmaat) voor "Lees voor", "Inspreken" en
// "Bel volgende". Meldingen wachten tot je stopt.
import { spreekBriefing } from '~~/shared/spreek'
const { aan, zet } = useRijmodus()
const { lees, spreekt, stop } = useVoorlezen()
const spraakOpen = useState('spraak-open', () => false)
const { pakket } = useDagpakket()
// De volgende afspraak uit het dagpakket (werkt ook offline), als briefing van hooguit een minuut.
function leesVoor() {
  if (spreekt.value) { stop(); return }
  const v = (pakket.value?.dagen?.[0]?.stops ?? []).find((s: any) => ['gepland', 'onderweg', 'bezig'].includes(s.status)) as any
  const tijd = v?.start ? new Date(v.start).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : null
  lees(v ? spreekBriefing({ accountNaam: v.accountNaam ?? 'je volgende afspraak', tijd, doel: v.doel ?? null, punten: v.briefing ?? [] }) : 'Er staat vandaag geen afspraak meer.')
}
</script>

<template>
  <div v-if="aan" class="rijmodus" role="dialog" aria-label="Rijmodus" data-test="rijmodus">
    <p class="kicker kicker--streep">Rijmodus</p>
    <p class="kaart-meta">Meldingen wachten tot je stopt.</p>
    <button type="button" class="dd-act dd-act--primair rijmodus-knop" data-test="rm-lees" @click="leesVoor"><Icoon naam="Volume2" />{{ spreekt ? 'Stop met voorlezen' : 'Lees voor' }}</button>
    <button type="button" class="dd-act rijmodus-knop" data-test="rm-inspreken" @click="spraakOpen = true"><Icoon naam="Mic" />Inspreken</button>
    <NuxtLink to="/bellen" class="dd-act rijmodus-knop" data-test="rm-bel" @click="zet(false)"><Icoon naam="Phone" />Bel volgende</NuxtLink>
    <button type="button" class="dd-act rijmodus-knop mt-auto" data-test="rm-stop" @click="zet(false)">Stop rijmodus</button>
  </div>
</template>
