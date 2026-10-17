<script setup lang="ts">
// Kop van elk scherm onder Instellingen: één opzet voor alle beheerpagina's. Bovenaan de kruimel
// "Instellingen · <groep>" waarvan Instellingen de link terug naar de hub is (ook op de telefoon, 44 px),
// daaronder de titel (bij voorkeur de stand in woorden, "8 van 8 campagnesoorten aan") en de uitleg.
// Rechts de icoonknoppen van PaginaKop, de knoppen van de pagina (slot `acties`, de ene grote primaire
// actie in geel) en, als de pagina een lijst heeft, de knop Filters met teller. Het filterpaneel (slot
// `filters`) staat direct onder de kop, in dezelfde marges; met filters aan opent het vanzelf.
const props = withDefaults(defineProps<{
  /** Groep op de hub: Organisatie, Verkoop, Ritme en regels, Data en AI, Koppelingen of Helpcenter. */
  groep: string
  titel: string
  uitleg?: string
  stand?: string
  helpartikel?: string | null
  /** Aantal actieve filters; laat weg voor een pagina zonder lijst om te filteren. */
  filters?: number | null
  /** Waar de terug-link naartoe gaat (standaard de hub). */
  terug?: { to: string; label: string }
  /** De hub zelf: de kicker is "Instellingen · <groep>" zonder terug-link. */
  hub?: boolean
}>(), { uitleg: undefined, stand: undefined, helpartikel: null, filters: null, terug: () => ({ to: '/instellingen', label: 'Instellingen' }), hub: false })
const emit = defineEmits<{ reset: [] }>()
const slots = useSlots()
const metFilters = computed(() => props.filters !== null && !!slots.filters)
const open = ref(!!props.filters)
watch(() => props.filters, (n, oud) => { if (n && !oud) open.value = true })
</script>

<template>
  <PaginaKop :titel="titel" :uitleg="uitleg" :stand="stand" :helpartikel="helpartikel">
    <template #kicker>
      <span v-if="hub" class="kicker kicker--streep" data-test="inst-kicker">Instellingen · {{ groep }}</span>
      <span v-else class="kicker kicker--streep lijst-kruimel inst-kruimel" data-test="inst-kicker">
        <NuxtLink :to="terug.to" class="inst-terug" data-test="terug-instellingen" :title="`Terug naar ${terug.label}`"><Icoon naam="ArrowLeft" :grootte="14" />{{ terug.label }}</NuxtLink>
        <span aria-hidden="true">·</span>
        <span>{{ groep }}</span>
      </span>
    </template>
    <template v-if="$slots.titel" #titel><slot name="titel" /></template>
    <template v-if="$slots.onder" #onder><slot name="onder" /></template>
    <template #acties>
      <slot name="acties" />
      <button
        v-if="metFilters" type="button" class="dd-actie dd-actie--secundair" :class="{ 'inst-filters--aan': open || filters }"
        :aria-expanded="open" aria-controls="inst-filterpaneel" data-test="inst-filters" @click="open = !open"
      >
        <Icoon naam="SlidersHorizontal" class="dd-actie-icoon" />Filters<span v-if="filters" class="inst-teller tnum">{{ filters }}</span><Icoon naam="ChevronDown" :grootte="14" class="inst-pijl" :class="{ 'inst-pijl--open': open }" />
      </button>
    </template>
    <template #na>
      <div v-if="metFilters && open" id="inst-filterpaneel" class="ifp-paneel" data-test="inst-filterpaneel">
        <slot name="filters" />
        <div v-if="filters" class="ifp-groep ifp-groep--eind"><button type="button" class="dd-act" data-test="inst-filters-reset" @click="emit('reset')">Wis filters</button></div>
      </div>
      <slot name="na" />
    </template>
  </PaginaKop>
</template>

<style>
/* Niet scoped: de groepen staan in het slot van de pagina. Zelfde opzet als het filterpaneel van Concepten. */
.inst-kruimel { flex-wrap: wrap; gap: 4px 8px; }
.inst-terug { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; color: var(--ink); text-decoration: none; border-bottom: 1px solid transparent; }
.inst-terug:hover { border-bottom-color: var(--ink); }
.inst-terug:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
.inst-filters--aan { background: var(--ink); color: var(--yellow); border-color: var(--ink); }
.inst-teller { display: inline-flex; align-items: center; height: 18px; padding: 0 7px; margin-left: 2px; background: var(--yellow); color: var(--ink); font-size: 11px; font-weight: 800; border-radius: 2px; }
.inst-pijl { transition: transform var(--transition-fast); }
.inst-pijl--open { transform: rotate(180deg); }
.ifp-paneel { display: flex; flex-direction: column; gap: 12px; margin-top: 16px; background: var(--wit); border: 1px solid var(--border); padding: 16px 18px; }
.ifp-groep { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.ifp-groep .filter-label { min-width: 72px; }
.ifp-groep--eind { justify-content: flex-end; }
.ifp-zoek { flex: 1 1 220px; max-width: 360px; }
/* Rij in een lijst onder Instellingen: tekst links, schakelaar en knoppen rechts (de gewone .rij heeft drie kolommen). */
.inst-rij { grid-template-columns: minmax(0, 1fr) auto; cursor: default; }
.inst-rij .rij-sub { margin-bottom: 0; }
.inst-rij--uit .rij-titel, .inst-rij--uit .rij-sub { color: var(--muted); }
.inst-rij-acties { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.inst-lijstkop { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 16px; margin: 0 0 12px; }
@media (max-width: 719px) {
  .inst-rij--stapel { grid-template-columns: minmax(0, 1fr); }
  .inst-rij-acties { flex-wrap: wrap; }
}
@media (max-width: 719px) {
  .inst-terug { min-height: var(--touch-target-min); }
  .ifp-groep .filter-label { width: 100%; }
  .ifp-groep .filter-pil, .ifp-groep .dd-act { min-height: var(--touch-target-min); }
  .ifp-zoek { max-width: none; }
}
</style>
