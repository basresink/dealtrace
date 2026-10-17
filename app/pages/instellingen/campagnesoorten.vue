<script setup lang="ts">
// Campagnesoorten (F22, Verkoop, beheerder): aan of uit. De acht startsoorten staan standaard aan.
// Kop met de stand in de titel, filters op stand en groep.
const { functie } = useMe()
const aan = computed(() => !!functie('instellingen.campagnesoorten')?.beschikbaar)
const toast = useToast()
const { data, refresh } = await useFetch<any>('/api/campagnes/soorten', { immediate: aan.value, default: () => ({ soorten: [] }) })
async function zet(s: any, actief: boolean) {
  try { await $fetch('/api/campagnes/soorten', { method: 'PUT', body: { id: s.id, actief } }); toast.toon(`${s.naam} staat ${actief ? 'aan' : 'uit'}.`); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const filter = reactive({ stand: '', groep: '' })
const groepen = computed(() => [...new Set<string>(data.value.soorten.map((s: any) => s.groep))].sort())
const lijst = computed(() => data.value.soorten.filter((s: any) => (!filter.stand || (filter.stand === 'aan') === !!s.actief) && (!filter.groep || s.groep === filter.groep)))
const aantalFilters = computed(() => (filter.stand ? 1 : 0) + (filter.groep ? 1 : 0))
const aanTal = computed(() => data.value.soorten.filter((s: any) => s.actief).length)
const titel = computed(() => (data.value.soorten.length ? `${aanTal.value} van ${data.value.soorten.length} campagnesoorten aan` : 'Campagnesoorten'))
function wis() { filter.stand = ''; filter.groep = '' }
useHead({ title: 'Campagnesoorten · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="instellingen.campagnesoorten" />
    <template v-else>
      <InstellingenKop groep="Verkoop" :titel="titel" uitleg="Een soort die uit staat, kan niemand meer kiezen. Lopende campagnes van die soort lopen door." helpartikel="een-campagne-opzetten" :filters="aantalFilters" @reset="wis">
        <template #filters>
          <div class="ifp-groep" role="group" aria-label="Stand"><span class="filter-label">Stand</span>
            <button v-for="[k, l] in [['', 'Alle'], ['aan', 'Aan'], ['uit', 'Uit']]" :key="k" type="button" class="filter-pil" :class="{ 'filter-pil--aan': filter.stand === k }" :aria-pressed="filter.stand === k" @click="filter.stand = k!">{{ l }}</button>
          </div>
          <div class="ifp-groep" role="group" aria-label="Groep"><span class="filter-label">Groep</span>
            <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': !filter.groep }" :aria-pressed="!filter.groep" @click="filter.groep = ''">Alle</button>
            <button v-for="g in groepen" :key="g" type="button" class="filter-pil" :class="{ 'filter-pil--aan': filter.groep === g }" :aria-pressed="filter.groep === g" @click="filter.groep = g">{{ g }}</button>
          </div>
        </template>
      </InstellingenKop>
      <section class="section section--laatste">
        <div class="container">
          <LegeStaat v-if="!data.soorten.length" kicker="Campagnesoorten" titel="Nog geen campagnesoorten." tekst="De acht startsoorten komen vanzelf bij de eerste campagne. Daarna zet je ze hier aan of uit." />
          <LegeStaat v-else-if="!lijst.length" kicker="Niets gevonden" titel="Geen soorten in dit filter." tekst="Kies een andere stand of groep.">
            <button type="button" class="dd-act mt-16" @click="wis">Wis filters</button>
          </LegeStaat>
          <div v-else class="lijst" data-test="cs-lijst">
            <div v-for="s in lijst" :key="s.id" class="rij rij--compact inst-rij" :class="{ 'inst-rij--uit': !s.actief }">
              <div class="rij-info">
                <h3 class="rij-titel">{{ s.naam }} <InstellingLabel v-if="s.startsoort" stand="startset" /><InstellingLabel v-if="!s.actief" stand="uit" /></h3>
                <div class="rij-sub">{{ s.groep }} · {{ s.kanalen.join(', ') }} · {{ s.pogingen }} pogingen in {{ s.weken }} weken · {{ s.uitvoerder }}</div>
              </div>
              <div class="inst-rij-acties"><Schakelaar :aan="s.actief" :label="`${s.naam} aan`" :data-test="`cs-${s.sleutel}`" @wissel="(v: boolean) => zet(s, v)" /></div>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
