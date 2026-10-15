<script setup lang="ts">
// Campagnes (F12): kaarten met soort, status, eigenaar, tempopil en voortgang met de verwachte stand
// als streep. Filters (status, soort, eigenaar) staan in de URL; standaard "Van mij".
const { functie } = useMe()
const aan = !!functie('campagnes.meedoen')?.beschikbaar
const maken = !!functie('campagnes.maken')?.beschikbaar
const { toon: toonUitleg } = useNietAangezet()
const route = useRoute()
const router = useRouter()
const filter = computed(() => ({ status: (route.query.status as string) || 'alle', soort: (route.query.soort as string) || 'alle', eigenaar: (route.query.eigenaar as string) || 'mij' }))
const { data } = await useFetch<any>('/api/campagnes', { query: filter, immediate: aan, default: () => ({ actief: 0, campagnes: [] }) })
const { data: ctx } = await useFetch<any>('/api/campagnes/context', { immediate: aan, default: () => ({ soorten: [], verkopers: [] }) })
function zet(k: string, v: string) { router.replace({ query: { ...route.query, [k]: v } }) }
const filtersOpen = ref(false)
const gefilterd = computed(() => filter.value.status !== 'alle' || filter.value.soort !== 'alle' || filter.value.eigenaar !== 'mij')
const STATUS: Record<string, string> = { concept: 'Concept', wacht: 'Wacht op bevestiging', actief: 'Actief', gepauzeerd: 'Gepauzeerd', afgerond: 'Afgerond' }
const soortNaam = (s: string) => ctx.value.soorten.find((x: any) => x.sleutel === s)?.naam ?? s
const pilKlas = (p: string) => (p === 'Voor op schema' ? 'tempo--voor' : p === 'Op schema' ? 'tempo--op' : 'tempo--achter')
const doelTekst = (c: any) => (c.doel ? (c.doel.type === 'afspraken' ? `${c.doel.waarde} afspraken` : `${c.doel.waarde}% afspraken`) : 'Geen doel')
useHead({ title: 'Campagnes · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="campagnes.meedoen" />
    <template v-else>
      <PaginaKop :kicker="`Campagnes · ${data.actief} actief`" titel="Eén lijst, één doel, elke dag een stap." helpartikel="campagnes">
        <template #acties>
          <NuxtLink v-if="maken" to="/campagnes/nieuw" class="dd-actie dd-actie--primair" data-test="campagne-nieuw"><Icoon naam="Plus" class="dd-actie-icoon" />Campagne</NuxtLink>
          <button v-else type="button" class="dd-actie dd-actie--secundair knop-slot" data-test="campagne-nieuw-slot" @click="toonUitleg('campagnes.maken')"><Icoon naam="Lock" class="dd-actie-icoon" />Campagne</button>
          <button type="button" class="dd-actie dd-actie--secundair" :aria-expanded="filtersOpen" data-test="campagne-filters" @click="filtersOpen = !filtersOpen"><Icoon naam="Filter" class="dd-actie-icoon" />Filters</button>
        </template>
      </PaginaKop>
      <section class="section">
        <div class="container">
          <div v-if="filtersOpen" class="filterbalk cp-filters" data-test="campagne-filterbalk">
            <label class="veld"><span class="veld-label">Status</span>
              <select class="invoer" :value="filter.status" data-test="filter-status" @change="zet('status', ($event.target as HTMLSelectElement).value)"><option value="alle">Alle</option><option v-for="(l, k) in STATUS" :key="k" :value="k">{{ l }}</option></select></label>
            <label class="veld"><span class="veld-label">Soort</span>
              <select class="invoer" :value="filter.soort" @change="zet('soort', ($event.target as HTMLSelectElement).value)"><option value="alle">Alle</option><option v-for="s in ctx.soorten" :key="s.sleutel" :value="s.sleutel">{{ s.naam }}</option></select></label>
            <label class="veld"><span class="veld-label">Eigenaar</span>
              <select class="invoer" :value="filter.eigenaar" data-test="filter-eigenaar" @change="zet('eigenaar', ($event.target as HTMLSelectElement).value)"><option value="mij">Van mij</option><option value="alle">Iedereen</option><option v-for="v in ctx.verkopers" :key="v.id" :value="v.id">{{ v.naam }}</option></select></label>
          </div>
          <LegeStaat v-if="!data.campagnes.length" :titel="gefilterd || data.actief ? 'Geen campagnes voor dit filter.' : 'Er lopen geen campagnes.'" :tekst="gefilterd || data.actief ? (filter.eigenaar === 'mij' ? 'Je doet nog niet mee aan een campagne.' : 'Kies een ander filter.') : 'Een campagne bundelt 20 tot 80 accounts rond één doel.'">
            <button v-if="gefilterd || data.actief" type="button" class="dd-act" data-test="toon-alles" @click="router.replace({ query: { eigenaar: 'alle' } })">Toon alles</button>
          </LegeStaat>
          <div v-else class="cp-kaarten" data-test="campagne-lijst">
            <NuxtLink v-for="c in data.campagnes" :key="c.id" :to="`/campagnes/${c.id}`" class="cp-kaart" :data-test="`campagne-${c.id}`">
              <div class="cp-kaart-kop">
                <span class="cp-soort">{{ soortNaam(c.soort) }}</span>
                <span class="pil" :class="{ 'pil--leeg': c.status !== 'actief' }">{{ STATUS[c.status] }}</span>
                <span v-if="c.tempo" class="tempo" :class="pilKlas(c.tempo.pil)" data-test="tempopil">{{ c.tempo.pil }}</span>
              </div>
              <h3 class="cp-naam">{{ c.naam }}</h3>
              <div class="cp-meta">{{ c.eigenaar ?? 'Geen eigenaar' }} · Doel {{ doelTekst(c) }}<template v-if="c.winpunt"> · Winpunt: {{ c.winpunt }}</template></div>
              <div class="cp-voortgang" :aria-label="`Voortgang ${c.tempo?.voortgang ?? 0} procent`">
                <div class="cp-balk" :style="{ width: `${c.tempo?.voortgang ?? 0}%` }" />
                <div v-if="c.tempo" class="cp-verwacht" :style="{ left: `${c.tempo.verwacht}%` }" title="Verwachte stand" />
              </div>
              <div class="cp-cijfers"><span>{{ c.accounts }} accounts</span><span>{{ c.klaar }} klaar</span><span>{{ c.afspraken }} afspraken</span><span v-if="c.dagenOver !== null">{{ c.dagenOver }} dagen over</span></div>
            </NuxtLink>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
