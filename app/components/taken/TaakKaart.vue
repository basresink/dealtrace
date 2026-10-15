<script setup lang="ts">
// Taakkaart (F06): afvinkknop, actiesoort, prioriteit, herkomst, "poging 3 van 5",
// vervaldatum als tekst, titel, account met fasepil, aanleiding. Rechtsklik opent het
// contextmenu; op de telefoon veeg links rondt af, veeg rechts stelt uit.
import { ACTIE_LABEL, HERKOMST_LABEL, vervalLabel } from '~~/shared/taken'
import { fasePil } from '~/utils/accountWeergave'
const props = defineProps<{ taak: any; bulk?: boolean; gekozen?: boolean }>()
const emit = defineEmits<{ open: []; vink: []; uitstel: []; menu: [e: MouseEvent]; kies: [] }>()
const PRIO: Record<string, string> = { hoog: 'prio-stip--high', middel: 'prio-stip--medium', laag: 'prio-stip--low' }
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
  <div class="taak-kaart" :class="{ 'taak-kaart--achter': taak.achterstallig }" :style="dx ? { transform: `translateX(${dx}px)` } : undefined" :data-test="`taak-${taak.id}`" @contextmenu="emit('menu', $event)" @touchstart.passive="begin" @touchmove.passive="beweeg" @touchend="eind">
    <input v-if="bulk" type="checkbox" :checked="gekozen" class="mt-8" :aria-label="`Kies ${taak.title}`" @change="emit('kies')">
    <button type="button" class="taak-vink" :aria-label="`Rond ${taak.title} af`" data-test="vink" @click="emit('vink')"><Icoon naam="CircleCheck" /></button>
    <div>
      <div class="taak-labels"><span class="pil pil--leeg">{{ ACTIE_LABEL[taak.actionType] ?? 'TAAK' }}</span><span class="prio-stip" :class="PRIO[taak.priority]" :title="`Prioriteit ${taak.priority}`" /><span class="pil" :class="taak.herkomst === 'inzicht' ? 'pil--paars' : taak.herkomst === 'ritme' ? 'pil--blauw' : taak.herkomst === 'regel' ? 'pil--geel' : 'pil--grijs'">{{ HERKOMST_LABEL[taak.herkomst] ?? 'Handmatig' }}</span><span v-if="taak.poging" class="taak-meta" data-test="poging">poging {{ taak.poging.n }} van {{ taak.poging.van }}</span></div>
      <button type="button" class="taak-titel mt-8" data-test="taak-titel" @click="emit('open')">{{ taak.title }}</button>
      <div v-if="taak.account" class="taak-meta"><NuxtLink :to="`/accounts/${taak.account.id}`">{{ taak.account.naam }}</NuxtLink> <span v-if="taak.account.fase" class="pil" :class="fasePil(taak.account.fase.kleur)">{{ taak.account.fase.label }}</span></div>
      <div v-if="taak.aanleiding" class="taak-meta">{{ taak.aanleiding }}</div>
    </div>
    <span class="taak-meta taak-rechts" :class="{ 'taak-verval--over': taak.achterstallig }">{{ vervalLabel(taak.dueDate, new Date()) }}</span>
  </div>
</template>
