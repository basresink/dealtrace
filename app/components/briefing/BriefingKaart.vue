<script setup lang="ts">
// Eén briefing op /briefings (opzet van DealDrive: kaarten per dag), als kaart of als rij (weergave Lijst).
// Op de kaart: tijd (over tijd in rood), de soort in zijn eigen kleur, bedrijf, contactpersoon, het gesprek,
// hoe compleet de briefing is in woorden met het eerste gat, en of Pitstop al een concept klaar heeft.
// De linkerrand is paars voor een prospect en zwart voor een klant. Een belblok is één kaart met het aantal
// gesprekken; de briefing per gesprek staat in de belmodus.
import { compleetTekst, SOORT_KORT } from '~~/shared/briefingOverzicht'
import type { BriefingSoort } from '~~/shared/briefing'
const props = defineProps<{ item: any; vandaag: string; weergave?: 'kaarten' | 'lijst' }>()
const emit = defineEmits<{ open: [item: any] }>()
const TZ = 'Europe/Amsterdam'
const dag = computed(() => (props.item.wanneer ? new Date(props.item.wanneer).toLocaleDateString('sv-SE', { timeZone: TZ }) : null))
const laat = computed(() => !!dag.value && dag.value < props.vandaag)
const uur = (iso: string) => new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
const tijd = computed(() => {
  const w = props.item.wanneer
  if (!w) return 'Geen datum'
  if (!laat.value) return props.item.onderwerp === 'belblok' && props.item.eind ? `${uur(w)} tot ${uur(props.item.eind)}` : uur(w)
  const gisteren = new Date(`${props.vandaag}T12:00:00Z`); gisteren.setUTCDate(gisteren.getUTCDate() - 1)
  if (dag.value === gisteren.toISOString().slice(0, 10)) return `Gisteren ${uur(w)}`
  return `${new Date(w).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ }).replace(/\./g, '')} ${uur(w)}`
})
const icoon = computed(() => ({ bellen: 'Phone', telefoon: 'Phone', bezoek: 'MapPin', online: 'MessagesSquare' } as Record<string, string>)[props.item.actie] ?? 'Calendar')
const soort = computed(() => props.item.soort as BriefingSoort)
const pitstop = computed(() => (props.item.pitstop === 'klaar' ? 'Concept klaar' : props.item.pitstop === 'goedgekeurd' ? 'Concept goedgekeurd' : props.item.pitstop === 'verstuurd' ? 'Concept verstuurd' : null))
const contactRegel = computed(() => (props.item.contact ? [props.item.contact.naam, props.item.contact.functie].filter(Boolean).join(', ') : 'Nog geen contactpersoon'))
</script>

<template>
  <!-- Belblok -->
  <article v-if="item.onderwerp === 'belblok'" class="bk bk--belblok" :class="{ 'bk--rij': weergave === 'lijst' }" :data-test="`briefing-belblok-${item.id}`">
    <NuxtLink :to="`/belblokken/${item.id}`" class="bk-knop">
      <span class="bk-kop"><span class="bk-tijd tnum" :class="{ 'bk-tijd--laat': laat }">{{ tijd }}</span><span class="pil pil--geel">Belblok</span></span>
      <span class="bk-naam">{{ item.aantal }} {{ item.aantal === 1 ? 'gesprek' : 'gesprekken' }} in je belblok</span>
      <span class="bk-meta">{{ item.namen.join(', ') }}<template v-if="item.aantal > item.namen.length"> en {{ item.aantal - item.namen.length }} meer</template></span>
      <span class="bk-ctx"><Icoon naam="Phone" :grootte="14" />De briefing per gesprek staat in de belmodus</span>
    </NuxtLink>
    <div class="bk-voet"><span class="bk-meta">{{ item.bezig ? 'Bezig' : 'Gepland' }}<template v-if="item.eigenaar"> · {{ item.eigenaar.naam }}</template></span><NuxtLink :to="`/belblokken/${item.id}`" class="bk-link">Open belblok <Icoon naam="ChevronRight" :grootte="14" /></NuxtLink></div>
  </article>

  <!-- Lijst -->
  <div v-else-if="weergave === 'lijst'" class="bk-rij" :class="{ 'bk-rij--prospect': item.account.soort === 'prospect' }">
    <button type="button" class="item-rij bk-rij-knop" :data-test="`briefing-kaart-${item.id}`" @click="emit('open', item)">
      <span class="item-tijd" :class="{ 'item-tijd--rood': laat }">{{ tijd }}</span>
      <span class="item-icoon" :class="{ 'item-icoon--call': icoon === 'Phone', 'item-icoon--visit': icoon === 'MapPin' }"><Icoon :naam="icoon" :grootte="16" /></span>
      <span class="item-body">
        <span class="item-naam">{{ item.account.naam }}</span>
        <span class="item-meta">{{ contactRegel }} · {{ item.titel }}</span>
        <span v-if="item.compleet.gat" class="item-meta bk-gat">{{ item.compleet.gat }}</span>
      </span>
      <span class="item-acties"><span class="pil">{{ SOORT_KORT[soort] }}</span><Label v-if="pitstop" soort="ai" waarde="concept" :tekst="pitstop" /></span>
    </button>
  </div>

  <!-- Kaart -->
  <article v-else class="bk" :class="{ 'bk--prospect': item.account.soort === 'prospect' }">
    <button type="button" class="bk-knop" :data-test="`briefing-kaart-${item.id}`" @click="emit('open', item)">
      <span class="bk-kop"><span class="bk-tijd tnum" :class="{ 'bk-tijd--laat': laat }">{{ tijd }}</span><span class="pil" data-test="briefing-kaart-soort">{{ SOORT_KORT[soort] }}</span></span>
      <span class="bk-naam">{{ item.account.naam }}</span>
      <span class="bk-meta">{{ contactRegel }}</span>
      <span class="bk-ctx"><Icoon :naam="icoon" :grootte="14" />{{ item.titel }}</span>
      <span class="bk-gereed">
        <span class="bk-balk" aria-hidden="true"><i v-for="i in item.compleet.totaal" :key="i" :class="{ vol: i <= item.compleet.bekend }" /></span>
        <span data-test="briefing-compleet">{{ compleetTekst(item.compleet) }}</span>
        <span v-if="item.compleet.gat" class="bk-gat">{{ item.compleet.gat }}</span>
      </span>
    </button>
    <div class="bk-voet">
      <span class="bk-meta">{{ item.account.soort === 'klant' ? 'Klant' : 'Prospect' }}<template v-if="item.eigenaar"> · {{ item.eigenaar.naam }}</template><template v-if="pitstop"> · <b class="bk-pit">{{ pitstop }}</b></template></span>
      <NuxtLink :to="`/accounts/${item.account.id}`" class="bk-link">Open kaart <Icoon naam="ChevronRight" :grootte="14" /></NuxtLink>
    </div>
  </article>
</template>

<style scoped>
.bk { display: flex; flex-direction: column; min-width: 0; background: var(--wit); border: 1px solid var(--border); border-left: 4px solid var(--ink); border-radius: var(--radius); }
.bk--prospect { border-left-color: var(--purple); }
.bk--belblok { border-left-color: var(--yellow); }
.bk:hover { border-color: var(--ink); }
.bk--prospect:hover { border-left-color: var(--purple); }
.bk--belblok:hover { border-left-color: var(--yellow); }
.bk-knop { display: flex; flex-direction: column; gap: 6px; flex: 1; width: 100%; padding: 16px 16px 12px; background: none; border: 0; color: var(--ink); font: inherit; text-align: left; text-decoration: none; cursor: pointer; }
.bk-kop { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.bk-tijd { font-family: var(--font-serif); font-size: 16px; font-weight: 700; }
.bk-tijd--laat { color: var(--red); }
.bk-naam { font-family: var(--font-serif); font-size: 17px; font-weight: 700; line-height: 1.3; overflow-wrap: anywhere; }
.bk-meta { font-size: 12px; color: var(--muted); overflow-wrap: anywhere; }
.bk-ctx { display: flex; gap: 6px; align-items: center; font-size: 13px; color: var(--muted); overflow-wrap: anywhere; }
.bk-gereed { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; font-size: 12.5px; }
.bk-balk { display: flex; gap: 2px; }
.bk-balk i { flex: 1; height: 4px; background: var(--border); }
.bk-balk i.vol { background: var(--green); }
.bk-gat { color: var(--orange-dark); font-weight: 600; }
.bk-voet { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 4px 8px; padding: 0 16px 8px; }
.bk-pit { color: var(--purple); }
.bk-link { display: inline-flex; align-items: center; gap: 2px; min-height: 36px; font-size: 12px; font-weight: 700; color: var(--muted); text-decoration: none; }
.bk-link:hover { color: var(--ink); }
.bk-rij { border-left: 3px solid var(--ink); padding-left: 10px; background: var(--wit); }
.bk-rij--prospect { border-left-color: var(--purple); }
.bk-rij-knop { padding-right: 12px; }
.bk--rij .bk-knop { flex-direction: row; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; }
@media (max-width: 719px) { .bk-link { min-height: var(--touch-target-min); } }
</style>
