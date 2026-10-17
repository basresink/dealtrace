<script setup lang="ts">
// Maandweergave van de agenda: zes weken vanaf de maandag voor de eerste van de maand, per dag de
// afspraken (kleur van de meetingsoort), belblokken en het aantal taken. Hooguit drie items per dag;
// "+ meer" en het dagnummer gaan naar de week van die dag.
const props = defineProps<{ dagen: string[]; maand: string; vandaag: string; afspraken: any[]; belblokken: any[]; taken: any[]; telefoon?: boolean }>()
const emit = defineEmits<{ afspraak: [id: string]; dag: [iso: string] }>()
const TZ = 'Europe/Amsterdam'
const dagVan = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: TZ })
const tijd = (iso: string) => new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
const KLEUREN = ['geel', 'paars', 'blauw', 'groen', 'oranje', 'grijs', 'rood']
const cellen = computed(() => props.dagen.map((d) => {
  const items = [
    ...props.afspraken.filter((a) => dagVan(a.start) === d).map((a) => ({ id: a.id, soort: 'afspraak' as const, start: a.start, titel: a.accountNaam ?? a.soort.naam, kleur: KLEUREN.includes(a.soort.kleur) ? a.soort.kleur : 'grijs', klaar: a.status !== 'gepland' })),
    ...props.belblokken.filter((b) => dagVan(b.start) === d).map((b) => ({ id: b.id, soort: 'belblok' as const, start: b.start, titel: b.status === 'klaar' ? `Belblok: afgerond, ${b.gesprekken} gesprekken` : 'Belblok', kleur: 'belblok', klaar: b.status === 'klaar' })),
  ].sort((x, y) => x.start.localeCompare(y.start))
  return { iso: d, nr: Number(d.slice(8)), anders: d.slice(0, 7) !== props.maand, vandaag: d === props.vandaag, items, taken: props.taken.filter((t) => dagVan(t.due) === d).length }
}))
</script>

<template>
  <div class="am" :class="{ 'am--telefoon': telefoon }" data-test="agenda-maand">
    <span v-for="w in ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']" :key="w" class="am-kop">{{ w }}</span>
    <div v-for="c in cellen" :key="c.iso" class="am-dag" :class="{ 'am-dag--anders': c.anders, 'am-dag--vandaag': c.vandaag }" :data-test="`maand-${c.iso}`">
      <button type="button" class="am-nr tnum" :aria-label="`Naar ${c.iso}`" @click="emit('dag', c.iso)">{{ c.nr }}<span v-if="telefoon && (c.items.length || c.taken)" class="am-stip" aria-hidden="true" /></button>
      <template v-if="!telefoon">
        <template v-for="i in c.items.slice(0, 3)" :key="i.id">
          <button v-if="i.soort === 'afspraak'" type="button" class="am-item" :class="[`am-kleur--${i.kleur}`, { 'am-item--klaar': i.klaar }]" :title="`${tijd(i.start)} · ${i.titel}`" :data-test="`maand-afspraak-${i.id}`" @click="emit('afspraak', i.id)">
            <span class="am-tijd tnum">{{ tijd(i.start) }}</span><span class="am-titel">{{ i.titel }}</span>
          </button>
          <FunctieLink als-tekst v-else :to="`/belblokken/${i.id}`" class="am-item am-item--belblok" :class="{ 'am-item--afgerond': i.klaar }" :title="`${tijd(i.start)} · ${i.titel}`">
            <span class="am-tijd tnum">{{ tijd(i.start) }}</span><span class="am-titel">{{ i.titel }}</span>
          </FunctieLink>
        </template>
        <button v-if="c.items.length > 3" type="button" class="am-meer tnum" @click="emit('dag', c.iso)">+{{ c.items.length - 3 }} meer</button>
        <span v-if="c.taken" class="am-taken">{{ c.taken }} {{ c.taken === 1 ? 'taak' : 'taken' }}</span>
      </template>
    </div>
  </div>
</template>

<style scoped>
.am { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }
.am-kop { padding: 6px 0; text-align: center; font-size: var(--fs-label); font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }
.am-dag { display: flex; flex-direction: column; gap: 3px; min-width: 0; min-height: 112px; padding: 6px; background: var(--wit); border: 1px solid var(--border); overflow: hidden; }
.am-dag--anders { background: var(--surface); opacity: .6; }
.am-dag--vandaag { border-color: var(--ink); background: var(--yellow-licht); }
.am-nr { align-self: flex-start; display: inline-flex; align-items: center; gap: 4px; min-height: 26px; padding: 0 6px; border: 0; background: none; font-family: var(--font-serif); font-size: 14px; font-weight: 700; color: var(--ink); cursor: pointer; border-radius: var(--radius); }
.am-nr:hover { background: var(--surface); }
.am-dag--vandaag .am-nr { background: var(--ink); color: var(--yellow); }
.am-item { display: flex; flex-direction: column; gap: 1px; width: 100%; padding: 3px 5px; border: 0; border-left: 3px solid var(--muted); border-radius: var(--radius); background: var(--surface); color: var(--ink); font: inherit; font-size: var(--fs-label); line-height: 1.25; text-align: left; text-decoration: none; cursor: pointer; overflow: hidden; }
.am-item:hover { background: var(--border); }
.am-tijd { font-weight: 700; color: var(--muted); }
.am-titel { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.am-item--klaar .am-titel { text-decoration: line-through; color: var(--muted); }
.am-kleur--geel { border-left-color: var(--yellow-dark); }
.am-kleur--paars { border-left-color: var(--purple); }
.am-kleur--blauw { border-left-color: var(--blue); }
.am-kleur--groen { border-left-color: var(--green); }
.am-kleur--oranje { border-left-color: var(--orange); }
.am-kleur--rood { border-left-color: var(--red); }
.am-item--belblok { background: var(--yellow); border-left-color: var(--ink); }
.am-item--belblok .am-tijd { color: var(--ink); }
.am-item--afgerond .am-tijd { color: var(--muted); }
.am-item--afgerond { color: var(--muted); background: repeating-linear-gradient(-45deg, var(--surface), var(--surface) 6px, var(--border) 6px, var(--border) 7px); border-left-color: var(--border-strong); }
.am-meer { align-self: flex-start; padding: 2px 4px; border: 0; background: none; font: inherit; font-size: var(--fs-label); font-weight: 600; color: var(--muted); cursor: pointer; }
.am-meer:hover { color: var(--ink); text-decoration: underline; }
.am-taken { margin-top: auto; font-size: var(--fs-label); color: var(--muted); }
/* Telefoon: de hele cel is het tikdoel, met een blokje als er iets staat. */
.am--telefoon { gap: 2px; }
.am--telefoon .am-dag { min-height: 48px; padding: 0; }
.am--telefoon .am-nr { width: 100%; height: 100%; min-height: 48px; justify-content: center; flex-direction: column; gap: 3px; font-size: 13px; }
.am-stip { width: 6px; height: 6px; background: var(--ink); }
.am-dag--vandaag .am-stip { background: var(--yellow); }
</style>
