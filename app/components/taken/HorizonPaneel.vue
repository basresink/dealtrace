<script setup lang="ts">
// Drie horizonnen op /taken (opzet uit DealDrive): Vandaag, Komende week en Week 2 en 3 in één kaart.
// Taken en afspraken samen, per dag gegroepeerd en op tijd gesorteerd, met een icoon per soort (bellen
// geel, bezoek groen, mail blauw, urgent rood, overig zwart). Een taak opent het taakvenster, een
// afspraak de agenda met het afspraakvenster.
import { nlMoment, plusDagen } from '~~/shared/datum'
import { isDringend } from '~~/shared/taken'
const props = defineProps<{ horizon: { vandaag: any[]; komendeWeek: any[]; week23: any[] } }>()
const emit = defineEmits<{ open: [id: string] }>()
const vandaag = nlMoment(new Date()).datum
const { data: agenda } = await useFetch<any>('/api/agenda', { query: { van: vandaag, tot: plusDagen(vandaag, 22) }, default: () => ({ afspraken: [] }), key: 'horizon-afspraken' })

type Soort = 'call' | 'visit' | 'email' | 'urgent' | 'note'
const ICOON: Record<Soort, string> = { call: 'Phone', visit: 'MapPin', email: 'Mail', urgent: 'TriangleAlert', note: 'StickyNote' }
interface Item { id: string; soort: Soort; titel: string; meta: string; tijd: string; ts: number; dag: string; afspraak: boolean; tag: string | null; taakId: string | null }
const dagVan = (iso: string) => nlMoment(new Date(iso)).datum
const tijd = (iso: string) => new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' }).format(new Date(iso))
function taakItem(t: any): Item {
  const soort: Soort = isDringend(t.priority) ? 'urgent' : t.actionType === 'bellen' ? 'call' : t.actionType === 'bezoek' ? 'visit' : t.actionType === 'mailen' ? 'email' : 'note'
  const d = t.dueDate ? dagVan(t.dueDate) : vandaag
  return { id: `taak-${t.id}`, soort, titel: t.title, meta: [t.account?.naam, t.poging ? `poging ${t.poging.n} van ${t.poging.van}` : null].filter(Boolean).join(' · '), tijd: t.dueDate ? tijd(t.dueDate) : '', ts: t.dueDate ? Date.parse(t.dueDate) : 0, dag: d < vandaag ? vandaag : d, afspraak: false, tag: d < vandaag ? 'Over tijd' : null, taakId: t.id }
}
const VORM: Record<string, string> = { bezoek: 'Bezoek', online: 'Online', telefoon: 'Telefoon' }
function afspraakItem(a: any): Item {
  return { id: `afspraak-${a.id}`, soort: a.vorm === 'bezoek' ? 'visit' : 'call', titel: a.accountNaam ?? a.soort.naam, meta: [a.soort.naam, a.locatie].filter(Boolean).join(' · '), tijd: tijd(a.start), ts: Date.parse(a.start), dag: dagVan(a.start), afspraak: true, tag: VORM[a.vorm] ?? 'Afspraak', taakId: `afspraak:${a.id}` }
}
const afspraken = computed(() => (agenda.value.afspraken ?? []).filter((a: any) => a.status === 'gepland').map(afspraakItem))
const KOLOMMEN = [
  { id: 'vandaag', kicker: 'Horizon 1', titel: 'Vandaag', van: vandaag, tot: vandaag },
  { id: 'komendeWeek', kicker: 'Horizon 2', titel: 'Komende week', van: plusDagen(vandaag, 1), tot: plusDagen(vandaag, 7) },
  { id: 'week23', kicker: 'Horizon 3', titel: 'Week 2 en 3', van: plusDagen(vandaag, 8), tot: plusDagen(vandaag, 21) },
] as const
const dagLabel = (d: string) => (d === vandaag ? 'Vandaag' : new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`)))
const kolommen = computed(() => KOLOMMEN.map((k) => {
  const items = [...props.horizon[k.id].map(taakItem), ...afspraken.value.filter((a: Item) => a.dag >= k.van && a.dag <= k.tot)].sort((a, b) => a.dag.localeCompare(b.dag) || a.ts - b.ts)
  const dagen: { dag: string; items: Item[] }[] = []
  for (const i of items) { const laatst = dagen.at(-1); if (laatst && laatst.dag === i.dag) laatst.items.push(i); else dagen.push({ dag: i.dag, items: [i] }) }
  return { ...k, aantal: items.length, dagen }
}))
const totaal = computed(() => kolommen.value.reduce((s, k) => s + k.aantal, 0))
</script>

<template>
  <section class="hz" data-test="horizon">
    <header class="hz-kop">
      <div><span class="kicker kicker--streep">Planning · drie horizonnen</span><h2 class="hz-titel">Jouw taken op één rij</h2></div>
      <span class="hz-som tnum">{{ kolommen[0]!.aantal }} vandaag · {{ kolommen[1]!.aantal }} komende week · {{ kolommen[2]!.aantal }} in week 2 en 3</span>
    </header>
    <div class="hz-raster">
      <div v-for="k in kolommen" :key="k.id" class="hz-kolom" :class="`hz-kolom--${k.id}`" :data-test="`horizon-${k.id}`">
        <header class="hz-kolomkop"><div class="hz-kolomtitel"><small>{{ k.kicker }}</small>{{ k.titel }}</div><span class="hz-teller tnum">{{ k.aantal }}</span></header>
        <p v-if="!k.dagen.length" class="hz-leeg">Niets gepland.</p>
        <template v-for="(d, i) in k.dagen" :key="d.dag">
          <div class="hz-dag" :class="{ 'hz-dag--eerste': i === 0 }">{{ dagLabel(d.dag) }}</div>
          <button v-for="it in d.items" :key="it.id" type="button" class="hz-item item-rij" :data-test="it.id" @click="it.taakId && emit('open', it.taakId)">
            <span class="item-tijd" :class="{ 'item-tijd--rood': it.tag === 'Over tijd' }">{{ it.tijd || '·' }}</span>
            <span class="item-icoon" :class="`item-icoon--${it.soort}`" aria-hidden="true"><Icoon :naam="ICOON[it.soort]" :grootte="16" /></span>
            <span class="item-body"><span class="item-naam">{{ it.titel }}</span><span v-if="it.meta" class="item-meta">{{ it.meta }}</span><span v-if="it.tag" class="pil" :class="it.tag === 'Over tijd' ? 'pil--rood' : it.afspraak ? 'pil--groen' : 'pil--grijs'">{{ it.tag }}</span></span>
          </button>
        </template>
      </div>
    </div>
    <p v-if="!totaal" class="hz-nul">Geen taken of afspraken in de komende 3 weken.</p>
  </section>
</template>

<style scoped>
.hz-kop { display: grid; gap: 12px; align-items: end; margin-bottom: 20px; }
@media (min-width: 720px) { .hz-kop { grid-template-columns: 1fr auto; } }
.hz-titel { margin: 6px 0 0; font-family: var(--font-serif); font-size: 24px; font-weight: 700; line-height: 1.2; color: var(--ink); }
.hz-som { font-size: 13px; color: var(--muted); }
.hz-raster { display: grid; grid-template-columns: 1fr; background: #fff; border: 1px solid var(--border); }
@media (min-width: 900px) { .hz-raster { grid-template-columns: 1fr 1fr 1fr; } }
.hz-kolom { padding: 22px 24px; border-right: 1px solid var(--border); }
.hz-kolom:last-child { border-right: none; }
@media (max-width: 899px) { .hz-kolom { border-right: none; border-bottom: 1px solid var(--border); } .hz-kolom:last-child { border-bottom: none; } }
.hz-kolomkop { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 16px; padding-bottom: 14px; border-bottom: 2px solid var(--ink); }
.hz-kolomtitel { font-family: var(--font-serif); font-size: 18px; font-weight: 700; color: var(--ink); }
.hz-kolomtitel small { display: block; margin-bottom: 2px; font-family: Inter, sans-serif; font-size: 11px; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.hz-teller { padding: 0 10px; font-family: var(--font-serif); font-size: 22px; font-weight: 700; line-height: 1.2; background: var(--yellow); color: var(--ink); }
.hz-kolom--komendeWeek .hz-teller { background: var(--ink); color: var(--yellow); }
.hz-kolom--week23 .hz-teller { background: var(--surface); }
.hz-leeg { padding: 40px 0; text-align: center; font-size: 13px; font-style: italic; color: var(--muted); }
.hz-dag { margin: 18px 0 6px; padding-top: 12px; border-top: 1px dashed var(--border); font-size: 10px; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; color: var(--muted); }
.hz-dag--eerste { margin-top: 0; padding-top: 0; border-top: none; }
.hz-nul { margin-top: 16px; padding: 24px; border: 1px solid var(--border); background: var(--surface); text-align: center; font-size: 14px; color: var(--muted); }
.hz-item.item-rij { grid-template-columns: 44px 36px minmax(0, 1fr); }
</style>
