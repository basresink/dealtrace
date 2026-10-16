<script setup lang="ts">
// Taakrij (F06) in de UI-standaard: tijd of vervaldatum (over tijd in rood), icoon per soort (bellen geel,
// bezoek groen, mail blauw, urgent rood, overig zwart), titel, account met fasepil, aanleiding, labels
// (actiesoort blauw, herkomst, "poging 3 van 5") en rechts "Afronden". Rechtsklik opent het contextmenu;
// op de telefoon veeg links rondt af, veeg rechts stelt uit.
import { ACTIE_LABEL, HERKOMST_LABEL, vervalLabel } from '~~/shared/taken'
import { fasePil } from '~/utils/accountWeergave'
const props = defineProps<{ taak: any; bulk?: boolean; gekozen?: boolean }>()
const emit = defineEmits<{ open: []; vink: []; uitstel: []; menu: [e: MouseEvent]; kies: [] }>()
const soort = computed(() => props.taak.priority === 'hoog' ? 'urgent' : ({ bellen: 'call', bezoek: 'visit', mailen: 'email' } as Record<string, string>)[props.taak.actionType] ?? 'note')
const ICOON: Record<string, string> = { call: 'Phone', visit: 'MapPin', email: 'Mail', urgent: 'TriangleAlert', note: 'StickyNote' }
const verval = computed(() => vervalLabel(props.taak.dueDate, new Date()))
const tijd = computed(() => { const m = /^(vandaag|morgen) (\d\d:\d\d)$/.exec(verval.value); return m ? { hoofd: m[2], onder: m[1] } : { hoofd: verval.value, onder: '' } })
let startX = 0
const dx = ref(0)
function begin(e: TouchEvent) { startX = e.touches[0]!.clientX; dx.value = 0 }
function beweeg(e: TouchEvent) { dx.value = e.touches[0]!.clientX - startX }
function eind() {
  if (dx.value < -80) emit('vink')
  else if (dx.value > 80) emit('uitstel')
  dx.value = 0
}
</script>

<template>
  <div class="taak-kaart item-rij" :class="{ 'taak-kaart--achter': taak.achterstallig, 'taak-kaart--bulk': bulk }" :style="dx ? { transform: `translateX(${dx}px)` } : undefined" :data-test="`taak-${taak.id}`" @contextmenu="emit('menu', $event)" @touchstart.passive="begin" @touchmove.passive="beweeg" @touchend="eind">
    <input v-if="bulk" type="checkbox" :checked="gekozen" class="taak-kies" :aria-label="`Kies ${taak.title}`" @change="emit('kies')">
    <span class="item-tijd taak-rechts" :class="{ 'item-tijd--rood taak-verval--over': taak.achterstallig }">{{ tijd.hoofd }}<small v-if="tijd.onder">{{ tijd.onder }}</small></span>
    <span class="item-icoon" :class="`item-icoon--${soort}`" aria-hidden="true"><Icoon :naam="ICOON[soort]!" :grootte="16" /></span>
    <div class="item-body">
      <button type="button" class="taak-titel item-naam" data-test="taak-titel" @click="emit('open')">{{ taak.title }}</button>
      <div v-if="taak.account || taak.poging" class="item-meta"><NuxtLink v-if="taak.account" :to="`/accounts/${taak.account.id}`">{{ taak.account.naam }}</NuxtLink><span v-if="taak.poging" data-test="poging"><template v-if="taak.account"> · </template>poging {{ taak.poging.n }} van {{ taak.poging.van }}</span></div>
      <div v-if="taak.aanleiding" class="item-meta">{{ taak.aanleiding }}</div>
      <div class="taak-labels">
        <span class="pil pil--blauw">{{ ACTIE_LABEL[taak.actionType] ?? 'TAAK' }}</span>
        <span v-if="taak.priority === 'hoog'" class="pil pil--rood">Urgent</span>
        <span class="pil" :class="taak.herkomst === 'inzicht' || taak.herkomst === 'agent' ? 'pil--paars' : 'pil--grijs'">{{ HERKOMST_LABEL[taak.herkomst] ?? 'Handmatig' }}</span>
        <span v-if="taak.account?.fase" class="pil" :class="fasePil(taak.account.fase.kleur)">{{ taak.account.fase.label }}</span>
      </div>
    </div>
    <div class="item-acties"><button type="button" class="dd-act" :aria-label="`Rond ${taak.title} af`" data-test="vink" @click="emit('vink')">Afronden</button></div>
  </div>
</template>
