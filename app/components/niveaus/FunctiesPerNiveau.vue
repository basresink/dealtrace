<script setup lang="ts">
// Functies per niveau (Instellingen, Niveaus): per onderdeel een schakelaar per functie en niveau. De beheerder
// zet aan of uit voor de hele organisatie; de standaard is de indeling van Dealtrace (startNiveau). Grenzen:
// buiten het pakket kan niet aan, een rolfunctie hangt niet af van het niveau en wat Dealtrace uitzette, blijft
// uit. Elke schakelaar slaat meteen op (PUT /api/instellingen/niveaus/functie) met de opslagstatus in de kop.
import { NIVEAU_LABEL, NIVEAUS, ROL_LABEL, type Niveau, type Rol } from '~~/shared/types'
import { PAKKET_LABEL } from '~~/shared/pakket'
import type { NiveauFunctie, NiveauOverzicht } from '~~/shared/niveauOverzicht'

const props = defineProps<{ overzicht: NiveauOverzicht; groep?: string; niveau?: Niveau | ''; afwijkend?: boolean }>()
const emit = defineEmits<{ bijgewerkt: [o: NiveauOverzicht]; wisFilters: [] }>()

const { laad } = useMe()
const toast = useToast()
const opslag = useFlyoutOpslag()
const zoek = ref('')
const bevestig = ref(false)
const bezig = ref(false)

const kolommen = computed<Niveau[]>(() => (props.niveau ? [props.niveau] : [...NIVEAUS]))
const rollen = (r: Rol[]) => r.map((x) => ROL_LABEL[x]?.toLowerCase() ?? x).join(' en ')
const aangepastOp = (f: NiveauFunctie) => kolommen.value.some((n) => f.cellen[n].keuze !== null && !f.cellen[n].founderUit)
const groepen = computed(() => {
  const z = zoek.value.trim().toLowerCase()
  return props.overzicht.groepen
    .filter((g) => !props.groep || g.groep === props.groep)
    .map((g) => ({
      ...g,
      functies: g.functies.filter((f) => (!z || f.naam.toLowerCase().includes(z) || g.groep.toLowerCase().includes(z))
        && (!props.afwijkend || aangepastOp(f))),
    })).filter((g) => g.functies.length)
})
const allesOpen = computed(() => !!zoek.value.trim() || !!props.groep || !!props.afwijkend)
const metFilter = computed(() => !!zoek.value.trim() || !!props.groep || !!props.niveau || !!props.afwijkend)

async function wissel(f: NiveauFunctie, n: Niveau, aan: boolean) {
  const cel = f.cellen[n]
  const was = cel.aan
  cel.aan = aan
  try {
    const nieuw = await opslag.bewaar(() => $fetch<NiveauOverzicht>('/api/instellingen/niveaus/functie', { method: 'PUT', body: { functie: f.sleutel, niveau: n, aan } }))
    emit('bijgewerkt', nieuw)
    await laad()
  } catch (e: any) {
    cel.aan = was
    toast.toon(e?.data?.statusMessage ?? e?.statusMessage ?? 'Kon niet opslaan', 'fout')
  }
}

async function naarStandaard() {
  bezig.value = true
  try {
    const r = await opslag.bewaar(() => $fetch<{ aantal: number; overzicht: NiveauOverzicht }>('/api/instellingen/niveaus/standaard', { method: 'POST' }))
    emit('bijgewerkt', r.overzicht)
    await laad()
    bevestig.value = false
    toast.toon(r.aantal === 1 ? '1 keuze teruggezet naar de standaard.' : `${r.aantal} keuzes teruggezet naar de standaard.`)
  } catch (e: any) {
    toast.toon(e?.data?.statusMessage ?? e?.statusMessage ?? 'Kon niet terugzetten', 'fout')
  } finally { bezig.value = false }
}
</script>

<template>
  <article class="kaart" data-test="functies-per-niveau">
    <header class="kaart-kop">
      <h2 class="kaart-titel">Functies per niveau</h2>
      <OpslagStatus :opslag="opslag" test="bewaar-functie" />
    </header>
    <p class="meta">Zet per functie aan of uit voor Beginner, Gevorderd en Expert. Wat je kiest, geldt voor iedereen in je organisatie. De standaard is de indeling van Dealtrace.</p>
    <p v-if="overzicht.iedereenAlles" class="kaart kaart--geel mt-16" data-test="iedereen-alles-melding">Iedereen ziet alles staat aan: iedereen heeft alle {{ overzicht.totaal }} functies uit jullie pakket, los van het niveau. Je keuzes hieronder gelden weer zodra je dat uitzet.</p>
    <ul class="fpn-tellingen mt-16" data-test="niveau-tellingen">
      <li v-for="n in NIVEAUS" :key="n" :data-niveau="n"><strong class="tnum">{{ overzicht.tellingen[n] }} van {{ overzicht.totaal }}</strong><span class="meta">functies aan bij {{ NIVEAU_LABEL[n] }}</span></li>
    </ul>

    <div class="fpn-standaard mt-16" data-test="niveau-standaard">
      <p class="meta" data-test="niveau-keuzes">
        <template v-if="overzicht.keuzes">{{ overzicht.keuzes === 1 ? '1 keuze wijkt' : `${overzicht.keuzes} keuzes wijken` }} af van de standaard.</template>
        <template v-else>Je volgt de standaard van Dealtrace.</template>
        <template v-if="overzicht.afwijkingen"> Dealtrace paste {{ overzicht.afwijkingen === 1 ? '1 keuze' : `${overzicht.afwijkingen} keuzes` }} voor jullie aan.</template>
      </p>
      <button v-if="overzicht.keuzes && !bevestig" type="button" class="dd-actie dd-actie--secundair" data-test="niveau-naar-standaard" @click="bevestig = true">
        <Icoon naam="Undo2" class="dd-actie-icoon" />Terug naar de standaard
      </button>
    </div>
    <div v-if="bevestig" class="fpn-bevestig mt-8" role="alertdialog" aria-labelledby="fpn-bevestig-tekst" data-test="niveau-standaard-bevestig">
      <p id="fpn-bevestig-tekst" class="tekst">{{ overzicht.keuzes === 1 ? 'Je ene keuze vervalt' : `Je ${overzicht.keuzes} keuzes vervallen` }} en elke functie staat weer zoals Dealtrace hem standaard instelt. Dit geldt meteen voor iedereen.</p>
      <div class="dd-acties mt-8">
        <button type="button" class="dd-actie dd-actie--primair" :disabled="bezig" data-test="niveau-standaard-ja" @click="naarStandaard">Ja, terug naar de standaard</button>
        <button type="button" class="dd-actie dd-actie--secundair" :disabled="bezig" @click="bevestig = false">Annuleer</button>
      </div>
    </div>

    <label class="fpn-zoek mt-16"><span class="sr-only">Zoek een functie</span><input v-model="zoek" type="search" class="invoer" placeholder="Zoek een functie of onderdeel" data-test="niveau-zoek"></label>

    <LegeStaat v-if="!groepen.length" class="mt-16" kicker="Niets gevonden" titel="Geen functie in dit filter." :tekst="afwijkend ? 'Er wijkt nog niets af van de standaard.' : 'Zoek op een ander woord of kies een ander onderdeel.'">
      <button v-if="metFilter" type="button" class="dd-act mt-16" data-test="niveau-wis" @click="zoek = ''; emit('wisFilters')">Wis filters</button>
    </LegeStaat>
    <details v-for="g in groepen" :key="g.groep" class="fpn-groep mt-8" :open="allesOpen" data-test="niveau-groep" :data-groep="g.groep">
      <summary class="fpn-kop"><span class="schakel-naam">{{ g.groep }}</span><span class="meta">{{ g.functies.length }} {{ g.functies.length === 1 ? 'functie' : 'functies' }}</span></summary>
      <div class="fpn-lijst" :style="{ '--fpn-kol': kolommen.length }">
        <div class="fpn-rij fpn-rij--kop" aria-hidden="true"><span>Functie</span><span v-for="n in kolommen" :key="n" class="fpn-cel">{{ NIVEAU_LABEL[n] }}</span></div>
        <div v-for="f in g.functies" :key="f.sleutel" class="fpn-rij" data-test="niveau-functie" :data-sleutel="f.sleutel">
          <div class="fpn-naam">
            <span>{{ f.naam }}</span>
            <span v-if="f.schakelbaar && f.altijdVoor.length" class="meta">Altijd aan voor de {{ rollen(f.altijdVoor) }}</span>
          </div>
          <p v-if="f.alleenVoor" class="fpn-vast meta" data-test="niveau-rol">Hoort bij de rol: altijd aan voor de {{ rollen(f.alleenVoor) }}, los van het niveau.<template v-if="!f.inPakket"> Niet in jullie pakket (vanaf {{ PAKKET_LABEL[f.pakket] }}).</template></p>
          <p v-else-if="!f.inPakket" class="fpn-vast meta" data-test="niveau-pakket">Niet in jullie pakket: deze functie zit in {{ PAKKET_LABEL[f.pakket] }} en hoger, dus aanzetten kan niet. Een ander pakket vraag je aan bij <FunctieLink to="/instellingen/abonnement">Abonnement</FunctieLink>.</p>
          <template v-else>
            <div v-for="n in kolommen" :key="n" class="fpn-cel" :data-niveau="n" :data-aan="f.cellen[n].aan ? 'ja' : 'nee'" :data-afwijkend="f.cellen[n].keuze !== null ? 'ja' : 'nee'">
              <span class="fpn-mobiel-label" aria-hidden="true">{{ NIVEAU_LABEL[n] }}</span>
              <Schakelaar :aan="f.cellen[n].aan" :uit="f.cellen[n].founderUit" :label="`${f.naam} voor ${NIVEAU_LABEL[n]}`" :data-test="`schakel-${n}`" @wissel="wissel(f, n, $event)" />
              <span v-if="f.cellen[n].founderUit" class="fpn-merk" data-test="niveau-founder-uit">Uit door Dealtrace</span>
              <span v-else-if="f.cellen[n].keuze !== null" class="fpn-merk fpn-merk--keuze" :title="`Standaard ${f.cellen[n].standaard ? 'aan' : 'uit'}`">Aangepast</span>
              <span v-else-if="f.cellen[n].afwijking" class="fpn-merk" title="Aangepast door Dealtrace voor jullie organisatie">Door Dealtrace</span>
            </div>
          </template>
        </div>
      </div>
    </details>
  </article>
</template>

<style scoped>
.fpn-tellingen { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.fpn-tellingen li { display: flex; flex-direction: column; gap: 2px; padding: 12px; border: 1px solid var(--border); border-radius: 2px; }
.fpn-standaard { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; }
.fpn-bevestig { padding: 12px 16px; border: 1px solid var(--border-strong, var(--border)); background: var(--surface, var(--bg)); border-radius: 2px; }
.fpn-zoek { display: block; }
.fpn-zoek .invoer { width: 100%; }
.fpn-groep { border: 1px solid var(--border); border-radius: 2px; }
.fpn-kop { display: flex; justify-content: space-between; align-items: center; gap: 8px; min-height: 44px; padding: 0 12px; cursor: pointer; }
.fpn-lijst { border-top: 1px solid var(--border); }
.fpn-rij { display: grid; grid-template-columns: minmax(0, 1fr) repeat(var(--fpn-kol), 88px); align-items: center; gap: 8px; padding: 6px 12px; border-bottom: 1px solid var(--border); }
.fpn-rij:last-child { border-bottom: 0; }
.fpn-rij--kop { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); padding-top: 8px; padding-bottom: 8px; }
.fpn-naam { display: flex; flex-direction: column; gap: 2px; min-width: 0; overflow-wrap: anywhere; }
.fpn-vast { grid-column: 2 / -1; margin: 0; }
.fpn-cel { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
.fpn-mobiel-label { display: none; }
.fpn-merk { font-size: 11px; font-weight: 700; color: var(--muted); }
.fpn-merk--keuze { color: var(--lbl-oranje-tekst, var(--orange)); }
@media (max-width: 719px) {
  .fpn-tellingen { grid-template-columns: 1fr; }
  .fpn-rij { grid-template-columns: repeat(var(--fpn-kol), minmax(0, 1fr)); padding: 8px 12px; }
  .fpn-rij--kop { display: none; }
  .fpn-naam, .fpn-vast { grid-column: 1 / -1; }
  .fpn-mobiel-label { display: block; font-size: 11px; font-weight: 700; color: var(--muted); }
  .fpn-standaard .dd-actie, .fpn-bevestig .dd-actie { min-height: var(--touch-target-min); }
}
</style>
