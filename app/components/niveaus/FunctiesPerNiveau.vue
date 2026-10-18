<script setup lang="ts">
// Functies per niveau (leesoverzicht voor de beheerder): per groep welke functie voor Beginner, Gevorderd
// en Expert aanstaat in deze organisatie. Een afwijking die de founder voor jullie zette, is gemarkeerd.
// Aanzetten kan hier niet: dat doet Dealtrace (B18).
import { NIVEAU_LABEL, NIVEAUS } from '~~/shared/types'
import { PAKKET_LABEL } from '~~/shared/pakket'
import type { NiveauFunctie } from '~~/shared/niveauOverzicht'

const props = defineProps<{
  overzicht: { iedereenAlles: boolean; totaal: number; tellingen: Record<string, number>; afwijkingen: number; groepen: { groep: string; functies: NiveauFunctie[] }[] }
}>()
const zoek = ref('')
const filter = ref<'alles' | 'verschil' | 'afwijking'>('alles')
const ROL: Record<string, string> = { accountmanager: 'accountmanager', salesmanager: 'salesmanager', beheerder: 'beheerder' }
const verschilt = (f: NiveauFunctie) => !f.alleenVoor && f.inPakket && new Set(NIVEAUS.map((n) => f.cellen[n].aan)).size > 1
const afwijkend = (f: NiveauFunctie) => NIVEAUS.some((n) => f.cellen[n].afwijking)
const groepen = computed(() => {
  const z = zoek.value.trim().toLowerCase()
  return props.overzicht.groepen.map((g) => ({
    ...g,
    functies: g.functies.filter((f) => (!z || f.naam.toLowerCase().includes(z) || g.groep.toLowerCase().includes(z))
      && (filter.value === 'alles' || (filter.value === 'verschil' ? verschilt(f) : afwijkend(f)))),
  })).filter((g) => g.functies.length)
})
const allesOpen = computed(() => !!zoek.value.trim() || filter.value !== 'alles')
const rollen = (r: string[]) => r.map((x) => ROL[x] ?? x).join(' en ')
</script>

<template>
  <article class="kaart" data-test="functies-per-niveau">
    <header class="kaart-kop"><h2 class="kaart-titel">Functies per niveau</h2></header>
    <p class="kaart-meta">Wat een accountmanager op elk niveau ziet in jullie organisatie. Welke functie bij welk niveau hoort, stelt Dealtrace in; wil je iets anders, vraag het aan Dealtrace.</p>
    <p v-if="overzicht.iedereenAlles" class="kaart kaart--geel mt-16" data-test="iedereen-alles-melding">Iedereen ziet alles staat aan: iedereen heeft alle {{ overzicht.totaal }} functies uit jullie pakket, los van het niveau.</p>
    <ul class="fpn-tellingen mt-16" data-test="niveau-tellingen">
      <li v-for="n in NIVEAUS" :key="n" :data-niveau="n"><strong class="tnum">{{ overzicht.tellingen[n] }} van {{ overzicht.totaal }}</strong><span class="meta">functies aan bij {{ NIVEAU_LABEL[n] }}</span></li>
    </ul>
    <p v-if="overzicht.afwijkingen" class="meta mt-8" data-test="niveau-afwijkingen">{{ overzicht.afwijkingen === 1 ? '1 keuze wijkt' : `${overzicht.afwijkingen} keuzes wijken` }} voor jullie af van de standaard van Dealtrace.</p>

    <div class="filters mt-16">
      <label class="fpn-zoek"><span class="sr-only">Zoek een functie</span><input v-model="zoek" type="search" class="invoer invoer--klein" placeholder="Zoek een functie" data-test="niveau-zoek"></label>
      <div class="filter-groep">
        <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': filter === 'alles' }" :aria-pressed="filter === 'alles'" @click="filter = 'alles'">Alles</button>
        <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': filter === 'verschil' }" :aria-pressed="filter === 'verschil'" data-test="niveau-filter-verschil" @click="filter = 'verschil'">Verschilt per niveau</button>
        <button v-if="overzicht.afwijkingen" type="button" class="filter-pil" :class="{ 'filter-pil--aan': filter === 'afwijking' }" :aria-pressed="filter === 'afwijking'" data-test="niveau-filter-afwijking" @click="filter = 'afwijking'">Aangepast voor jullie</button>
      </div>
    </div>

    <LegeStaat v-if="!groepen.length" class="mt-16" titel="Geen functie gevonden." tekst="Zoek op een ander woord of kies Alles." />
    <details v-for="g in groepen" :key="g.groep" class="fpn-groep mt-8" :open="allesOpen" data-test="niveau-groep" :data-groep="g.groep">
      <summary class="fpn-kop"><span class="schakel-naam">{{ g.groep }}</span><span class="meta">{{ g.functies.length }} {{ g.functies.length === 1 ? 'functie' : 'functies' }}</span></summary>
      <table class="tabel fpn-tabel">
        <thead><tr><th>Functie</th><th v-for="n in NIVEAUS" :key="n" class="fpn-cel">{{ NIVEAU_LABEL[n] }}</th></tr></thead>
        <tbody>
          <tr v-for="f in g.functies" :key="f.sleutel" data-test="niveau-functie" :data-sleutel="f.sleutel">
            <td>{{ f.naam }}</td>
            <td v-if="f.alleenVoor" :colspan="NIVEAUS.length" class="meta">Altijd aan voor {{ rollen(f.alleenVoor) }}<template v-if="!f.inPakket">, niet in jullie pakket (vanaf {{ PAKKET_LABEL[f.pakket] }})</template></td>
            <td v-else-if="!f.inPakket" :colspan="NIVEAUS.length" class="meta">Niet in jullie pakket (vanaf {{ PAKKET_LABEL[f.pakket] }})</td>
            <template v-else>
              <td v-for="n in NIVEAUS" :key="n" class="fpn-cel" :data-niveau="n" :data-aan="f.cellen[n].aan ? 'ja' : 'nee'">
                <span class="pil" :class="f.cellen[n].aan ? 'pil--groen' : 'pil--leeg'">{{ f.cellen[n].aan ? 'Aan' : 'Uit' }}</span>
                <span v-if="f.cellen[n].afwijking" class="fpn-afwijking" title="Aangepast voor jullie organisatie">Aangepast</span>
              </td>
            </template>
          </tr>
        </tbody>
      </table>
    </details>
  </article>
</template>

<style scoped>
.fpn-tellingen { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.fpn-tellingen li { display: flex; flex-direction: column; gap: 2px; padding: 12px; border: 1px solid var(--border); border-radius: 2px; }
.fpn-zoek { flex: 1 1 220px; }
.fpn-zoek .invoer { width: 100%; }
.fpn-groep { border: 1px solid var(--border); border-radius: 2px; }
.fpn-kop { display: flex; justify-content: space-between; align-items: center; gap: 8px; min-height: 44px; padding: 0 12px; cursor: pointer; }
.fpn-tabel { width: 100%; table-layout: fixed; }
.fpn-tabel th:first-child { width: 40%; }
.fpn-cel { text-align: left; }
.fpn-afwijking { display: block; font-size: 11px; font-weight: 700; color: var(--lbl-oranje-tekst); margin-top: 2px; }
@media (max-width: 719px) {
  .fpn-tellingen { grid-template-columns: 1fr; }
  .fpn-tabel { font-size: 12px; }
  .fpn-tabel th, .fpn-tabel td { padding: 8px 4px; overflow-wrap: anywhere; }
  .fpn-tabel th:first-child { width: 34%; }
  .fpn-tabel .pil { padding: 0 4px; }
}
</style>
