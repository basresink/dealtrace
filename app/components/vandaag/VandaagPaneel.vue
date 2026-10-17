<script setup lang="ts">
// Vandaag in drie kolommen (opzet uit DealDrive, VandaagPanel): Taken, Afspraken en Prio in één kaart,
// met de datum en een knop naar de agenda. Een taak of afspraak opent zijn venster; een prio-regel
// gaat naar het inzicht, de taak of de accountkaart.
import { isDringend } from '~~/shared/taken'
const props = defineProps<{ taken: { lijst: any[]; meer: number; totaal: number }; afspraken: any[]; prio: any[]; dag?: string }>()
const emit = defineEmits<{ open: [id: string] }>()
const datum = computed(() => new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' }).format(props.dag ? new Date(`${props.dag}T12:00:00Z`) : new Date()))
const tijd = (iso: string | null) => (iso ? new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(new Date(iso)) : '')
const dagKort = (iso: string | null) => (iso ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' }).format(new Date(iso)).replace('.', '') : '')
/** Label in de kolom Prio: heet met vlam, risico gevuld, terug een rand. */
const prioLabel = (p: any) => (p.labelSoort === 'hot' ? { soort: 'status', waarde: 'heet', tekst: p.label } : p.labelSoort === 'risico' ? { soort: 'urgentie', waarde: 'risico', tekst: p.label } : { soort: 'status', waarde: 'nieuw', tekst: p.label })
/** Eén label per taak: hoog of urgent eerst, anders de actiesoort (rand) of het AI-concept (paars). */
function label(t: any) {
  if (isDringend(t.priority)) return { soort: 'prioriteit', waarde: t.priority }
  if (t.concept) return { soort: 'ai', waarde: 'concept' }
  return { soort: 'actie', waarde: t.actionType ?? 'taak' }
}
</script>

<template>
  <section class="vp" data-test="vandaag-paneel">
    <header class="vp-kop">
      <h2 class="vp-titel">Vandaag</h2>
      <span class="vp-datum tnum">{{ datum }}</span>
      <NuxtLink to="/agenda" class="vp-agenda"><Icoon naam="Calendar" :grootte="16" />Agenda</NuxtLink>
    </header>
    <div class="vp-raster">
      <div class="vp-kolom" data-test="kolom-taken">
        <div class="vp-kolomkop"><span>Taken</span><span class="vp-num tnum">{{ taken.totaal }}</span></div>
        <p v-if="!taken.lijst.length" class="vp-leeg">Niets te doen. De motor zet nieuwe pogingen klaar zodra ze aan de beurt zijn.</p>
        <button v-for="t in taken.lijst" :key="t.id" type="button" class="vp-item taak-kaart" :class="{ 'taak-kaart--achter': t.achterstallig }" :data-test="`vandaag-taak-${t.id}`" @click="emit('open', t.id)">
          <span class="vp-tijd">{{ t.achterstallig ? dagKort(t.dueDate) : tijd(t.dueDate) || 'vandaag' }}<span class="vp-lbl">{{ t.achterstallig ? 'over tijd' : 'vandaag' }}</span></span>
          <span class="vp-body">
            <span class="vp-naam">{{ t.account?.naam ?? t.title }}</span>
            <span class="vp-meta">{{ t.account ? t.title : t.waarom }}<template v-if="t.poging"> · poging {{ t.poging.n }} van {{ t.poging.van }}</template></span>
            <Label class="vp-tag" v-bind="label(t)" />
          </span>
        </button>
        <NuxtLink v-if="taken.meer" to="/taken" class="vp-meer" data-test="nog-meer">nog {{ taken.meer }} meer →</NuxtLink>
      </div>
      <div class="vp-kolom" data-test="kolom-afspraken">
        <div class="vp-kolomkop"><span>Afspraken</span><span class="vp-num tnum">{{ afspraken.length }}</span></div>
        <p v-if="!afspraken.length" class="vp-leeg">Geen afspraken vandaag.</p>
        <button v-for="a in afspraken" :key="a.id" type="button" class="vp-item" @click="emit('open', a.taakId)">
          <span class="vp-tijd">{{ a.tijd }}<span class="vp-lbl">vandaag</span></span>
          <span class="vp-body">
            <span class="vp-naam">{{ a.accountNaam ?? a.titel }}</span>
            <span v-if="a.accountNaam && a.titel" class="vp-meta">{{ a.titel }}</span>
            <Label v-if="a.zonderVerslag" class="vp-tag" soort="urgentie" waarde="risico" tekst="Verslag" />
          </span>
        </button>
      </div>
      <div class="vp-kolom vp-kolom--prio" data-test="kolom-prio">
        <div class="vp-kolomkop"><span>Prio</span><span class="vp-num tnum">{{ prio.length }}</span></div>
        <p v-if="!prio.length" class="vp-leeg">Niets dringends.</p>
        <NuxtLink v-for="(p, i) in prio" :key="i" :to="p.link" class="vp-item">
          <span class="vp-tijd"><Icoon naam="TriangleAlert" :grootte="16" class="vp-let-op" /></span>
          <span class="vp-body">
            <span class="vp-naam">{{ p.naam ?? p.tekst }}</span>
            <span v-if="p.reden && p.reden !== p.naam" class="vp-meta">{{ p.reden }}</span>
            <Label v-if="p.label" class="vp-tag" v-bind="prioLabel(p)" />
          </span>
        </NuxtLink>
      </div>
    </div>
  </section>
</template>

<style scoped>
.vp { background: #fff; border: 1px solid var(--border); }
.vp-kop { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; padding: 22px 28px; border-bottom: 1px solid var(--border); }
.vp-titel { flex: 1; min-width: 0; margin: 0; font-family: var(--font-serif); font-size: clamp(20px, 2.4vw, 26px); font-weight: 700; letter-spacing: -0.01em; color: var(--ink); }
.vp-datum { font-size: 13px; color: var(--muted); }
.vp-agenda { display: inline-flex; align-items: center; gap: 6px; min-height: var(--touch-target-min); padding: 6px 12px; border: 1px solid var(--border-strong); border-radius: 2px; background: #fff; color: var(--ink); font-size: 12px; font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase; text-decoration: none; transition: border-color var(--transition-fast), background var(--transition-fast); }
.vp-agenda:hover { border-color: var(--ink); background: var(--surface); }
.vp-raster { display: grid; grid-template-columns: 1fr; }
@media (min-width: 800px) { .vp-raster { grid-template-columns: 1fr 1fr 1fr; } }
.vp-kolom { padding: 22px 28px; border-right: 1px solid var(--border); }
.vp-kolom:last-child { border-right: none; }
@media (max-width: 799px) { .vp-kolom { border-right: none; border-bottom: 1px solid var(--border); } .vp-kolom:last-child { border-bottom: none; } }
.vp-kolomkop { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; font-size: 11px; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; color: var(--muted); }
.vp-num { background: var(--ink); color: #fff; padding: 2px 9px; font-size: 12px; font-weight: 800; letter-spacing: 0; }
.vp-kolom--prio .vp-num { background: var(--yellow); color: var(--ink); }
.vp-leeg { padding: 12px 0; font-size: 13px; font-style: italic; color: var(--muted); }
.vp-item { display: flex; gap: 12px; width: 100%; padding: 12px 0; border: none; border-bottom: 1px solid var(--border); background: none; color: inherit; font: inherit; text-align: left; text-decoration: none; cursor: pointer; }
.vp-item:last-of-type { border-bottom: none; }
.vp-item:hover .vp-naam { color: var(--yellow-dark); }
.vp-tijd { flex-shrink: 0; width: 56px; padding-top: 2px; font-size: 12px; font-weight: 700; color: var(--ink); font-feature-settings: "tnum"; }
.vp-lbl { display: block; font-size: 10px; font-weight: 500; color: var(--muted); }
.taak-kaart--achter .vp-lbl { color: var(--red); }
.vp-let-op { color: var(--red); }
.vp-body { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; }
.vp-naam { font-size: 14px; font-weight: 600; line-height: 1.3; color: var(--ink); transition: color var(--transition-fast); }
.vp-meta { margin-top: 3px; font-size: 12px; line-height: 1.4; color: var(--muted); }
.vp-tag { margin-top: 5px; }
.vp-meer { display: inline-block; margin-top: 10px; font-size: 13px; font-weight: 700; color: var(--ink); border-bottom: 2px solid var(--yellow); text-decoration: none; }
</style>
