<script setup lang="ts">
// Eén melding als kaart (opzet van DealDrive): kleurbalk per soort, tag, tijd, stip als hij ongelezen
// is, titel, tekst en onderaan Openen, Markeer gelezen en Verberg. Klik op de kaart opent de link.
// Op de telefoon is vegen naar links "Markeer gelezen".
import { MELDING_SOORT_LABEL, soortVan } from '~~/shared/kanalen'
const props = defineProps<{ melding: { id: string; soort: string; titel: string; tekst?: string | null; link?: string | null; gelezenOp: string | null; op: string } }>()
const emit = defineEmits<{ open: []; gelezen: []; verberg: [] }>()
const soort = computed(() => soortVan(props.melding.soort))
function tijd(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (min < 1) return 'zojuist'
  if (min < 60) return `${min} min geleden`
  const uur = Math.floor(min / 60)
  if (uur < 24) return `${uur} uur geleden`
  const dagen = Math.floor(uur / 24)
  if (dagen < 7) return dagen === 1 ? '1 dag geleden' : `${dagen} dagen geleden`
  return new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' }).format(new Date(iso))
}
let veegX: number | null = null
const veegStart = (e: TouchEvent) => { veegX = e.touches[0]!.clientX }
function veegEind(e: TouchEvent) {
  const x = veegX; veegX = null
  if (x != null && x - e.changedTouches[0]!.clientX > 60 && !props.melding.gelezenOp) emit('gelezen')
}
function klik(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('button, a')) return
  if (props.melding.link) emit('open')
}
</script>

<template>
  <li class="nkaart" :class="[`nkaart--${soort}`, { 'nkaart--ongelezen': !melding.gelezenOp, 'nkaart--link': !!melding.link }]" data-test="melding" @click="klik" @touchstart.passive="veegStart" @touchend="veegEind">
    <div class="nkaart-vlak">
      <div class="nkaart-meta">
        <span class="nkaart-tag" :class="`nkaart-tag--${soort}`">{{ MELDING_SOORT_LABEL[soort] }}</span>
        <time class="nkaart-tijd tnum" :datetime="melding.op">{{ tijd(melding.op) }}</time>
        <span v-if="!melding.gelezenOp" class="nkaart-stip" aria-label="Ongelezen" data-test="melding-ongelezen" />
      </div>
      <h3 class="nkaart-titel">{{ melding.titel }}</h3>
      <p v-if="melding.tekst" class="nkaart-tekst">{{ melding.tekst }}</p>
      <div class="nkaart-voet">
        <button v-if="melding.link" type="button" class="nkaart-knop nkaart-knop--open" data-test="melding-open" @click="emit('open')">Openen<Icoon naam="ArrowRight" :grootte="14" /></button>
        <button v-if="!melding.gelezenOp" type="button" class="nkaart-knop" aria-label="Markeer gelezen" title="Markeer gelezen" data-test="melding-gelezen" @click="emit('gelezen')"><Icoon naam="CircleCheck" :grootte="14" />Gelezen</button>
        <span v-else class="nkaart-gelezen"><Icoon naam="CircleCheck" :grootte="14" />Gelezen</span>
        <button type="button" class="nkaart-knop nkaart-knop--stil" data-test="melding-verberg" @click="emit('verberg')">Verberg</button>
      </div>
    </div>
  </li>
</template>

<style scoped>
.nkaart { display: flex; flex-direction: column; min-width: 0; list-style: none; border-top: 4px solid var(--muted); transition: transform var(--transition-fast); }
.nkaart--link { cursor: pointer; }
.nkaart--link:hover { transform: translateY(-1px); }
.nkaart--kritiek { border-top-color: var(--red); }
.nkaart--hot { border-top-color: var(--purple); }
.nkaart--dagstart { border-top-color: var(--blue); }
.nkaart--herinnering { border-top-color: var(--yellow); }
.nkaart--inzicht { border-top-color: var(--green); }
.nkaart--systeem { border-top-color: var(--ink); }
.nkaart-vlak { flex: 1; display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--border); border-top: 0; padding: 18px 20px; transition: border-color var(--transition-fast); }
.nkaart--ongelezen .nkaart-vlak { background: var(--wit); }
.nkaart:hover .nkaart-vlak { border-color: var(--ink-soft); }
.nkaart-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
.nkaart-tag { display: inline-block; padding: 2px 8px; font-size: var(--fs-label); font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; background: var(--ink); color: var(--yellow); border-radius: 2px; }
.nkaart-tag--kritiek { background: var(--red); color: var(--wit); }
.nkaart-tag--hot { background: var(--purple); color: var(--wit); }
.nkaart-tag--dagstart { background: var(--blue); color: var(--wit); }
.nkaart-tag--herinnering { background: var(--yellow); color: var(--ink); }
.nkaart-tag--inzicht { background: var(--green); color: var(--wit); }
.nkaart-tijd { font-size: 12px; color: var(--muted); }
.nkaart-stip { margin-left: auto; width: 10px; height: 10px; background: var(--yellow); border: 1px solid var(--ink); flex-shrink: 0; }
.nkaart-titel { font-family: var(--font-serif); font-size: 18px; font-weight: 700; line-height: 1.25; margin: 0 0 8px; color: var(--ink); overflow-wrap: anywhere; }
.nkaart:not(.nkaart--ongelezen) .nkaart-titel { color: var(--ink-soft); }
.nkaart-tekst { margin: 0 0 14px; font-size: 14px; line-height: 1.5; color: var(--ink-soft); overflow-wrap: anywhere; }
.nkaart-voet { margin-top: auto; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding-top: 14px; border-top: 1px solid var(--border); }
.nkaart-knop { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 12px; background: var(--wit); color: var(--ink); border: 1px solid var(--border-strong); border-radius: 2px; font-size: 12px; font-weight: 700; cursor: pointer; }
.nkaart-knop:hover { border-color: var(--ink); }
.nkaart-knop--open { background: var(--ink); color: var(--yellow); border-color: var(--ink); }
.nkaart-knop--open:hover { background: var(--ink-soft); }
.nkaart-knop--stil { margin-left: auto; padding: 0 8px; background: transparent; border-color: transparent; color: var(--muted); font-weight: 600; }
.nkaart-knop--stil:hover { color: var(--ink); border-color: var(--border); }
.nkaart-gelezen { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--green); }
@media (max-width: 719px) {
  .nkaart-vlak { padding: 16px; }
  .nkaart-knop { min-height: var(--touch-target-min); }
}
</style>
