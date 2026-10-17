<script setup lang="ts">
// Taakrij (F06) in de UI-standaard: tijd of vervaldatum (over tijd in rood), icoon per soort (bellen geel,
// bezoek groen, mail blauw, urgent rood, overig zwart), titel, account met fasepil, aanleiding, labels
// (actiesoort blauw, herkomst, "poging 3 van 5"). Geen vinkje en geen afrondknop: afronden doe je in het
// taakvenster (klik op de titel). Rechtsklik opent het contextmenu; op de telefoon veeg rechts stelt uit.
// Een afgeronde taak (eigen periode in het verleden) krijgt het label Afgerond en staat nooit in rood.
import { ACTIE_LABEL, HERKOMST_LABEL, PRIO_LABEL, isDringend, vervalLabel } from '~~/shared/taken'
import { fasePil } from '~/utils/accountWeergave'
const props = defineProps<{ taak: any }>()
const emit = defineEmits<{ open: []; uitstel: []; menu: [e: MouseEvent] }>()
const klaar = computed(() => props.taak.status === 'klaar')
const soort = computed(() => isDringend(props.taak.priority) ? 'urgent' : ({ bellen: 'call', bezoek: 'visit', mailen: 'email' } as Record<string, string>)[props.taak.actionType] ?? 'note')
const ICOON: Record<string, string> = { call: 'Phone', visit: 'MapPin', email: 'Mail', urgent: 'TriangleAlert', note: 'StickyNote' }
const verval = computed(() => vervalLabel(props.taak.dueDate, new Date()))
const tijd = computed(() => { const m = /^(vandaag|morgen) (\d\d:\d\d)$/.exec(verval.value); return m ? { hoofd: m[2], onder: m[1] } : { hoofd: verval.value, onder: '' } })
let startX = 0
const dx = ref(0)
function begin(e: TouchEvent) { startX = e.touches[0]!.clientX; dx.value = 0 }
function beweeg(e: TouchEvent) { if (!klaar.value) dx.value = Math.max(0, e.touches[0]!.clientX - startX) }
function eind() {
  if (dx.value > 80) emit('uitstel')
  dx.value = 0
}
</script>

<template>
  <div class="taak-kaart item-rij" :class="{ 'taak-kaart--achter': taak.achterstallig, 'taak-kaart--klaar': klaar }" :style="dx ? { transform: `translateX(${dx}px)` } : undefined" :data-test="`taak-${taak.id}`" @contextmenu="emit('menu', $event)" @touchstart.passive="begin" @touchmove.passive="beweeg" @touchend="eind">
    <span class="item-tijd taak-rechts" :class="{ 'item-tijd--rood taak-verval--over': taak.achterstallig }">{{ tijd.hoofd }}<small v-if="tijd.onder">{{ tijd.onder }}</small></span>
    <span class="item-icoon" :class="`item-icoon--${soort}`" aria-hidden="true"><Icoon :naam="ICOON[soort]!" :grootte="16" /></span>
    <div class="item-body">
      <button type="button" class="taak-titel item-naam" data-test="taak-titel" @click="emit('open')">{{ taak.title }}</button>
      <div v-if="taak.account || taak.poging || taak.reeks" class="item-meta"><NuxtLink v-if="taak.account" :to="`/accounts/${taak.account.id}`">{{ taak.account.naam }}</NuxtLink><template v-if="taak.contact"> · <NuxtLink :to="`/contacten/${taak.contact.id}`" data-test="taak-contact">{{ taak.contact.naam }}</NuxtLink></template><span v-if="taak.poging" data-test="poging"><template v-if="taak.account"> · </template>poging {{ taak.poging.n }} van {{ taak.poging.van }}</span><span v-if="taak.reeks" data-test="taak-reeks"><template v-if="taak.account || taak.poging"> · </template>stap {{ taak.reeks.n }} van {{ taak.reeks.van }}</span></div>
      <div v-if="taak.aanleiding" class="item-meta">{{ taak.aanleiding }}</div>
      <div class="taak-labels">
        <span v-if="klaar" class="pil pil--groen" data-test="taak-afgerond">Afgerond</span>
        <span class="pil pil--blauw">{{ ACTIE_LABEL[taak.actionType] ?? 'TAAK' }}</span>
        <span v-if="isDringend(taak.priority)" class="pil pil--rood" data-test="taak-prio">{{ PRIO_LABEL[taak.priority] }}</span>
        <span class="pil" :class="taak.herkomst === 'inzicht' || taak.herkomst === 'agent' ? 'pil--paars' : 'pil--grijs'">{{ HERKOMST_LABEL[taak.herkomst] ?? 'Handmatig' }}</span>
        <span v-if="taak.account?.fase" class="pil" :class="fasePil(taak.account.fase.kleur)">{{ taak.account.fase.label }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Zonder afrondknop is de rij drie kolommen: tijd, icoon en inhoud. */
.taak-kaart { grid-template-columns: 72px 36px minmax(0, 1fr); }
@media (max-width: 767px) { .taak-kaart { grid-template-columns: 36px minmax(0, 1fr); } }
.taak-kaart--klaar .item-naam { color: var(--muted); }
</style>
