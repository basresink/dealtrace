<script setup lang="ts">
// Aankomstkaart (P30, Gevorderd): open je de app binnen 300 m van een afspraak, van 15 minuten voor
// de start tot het einde, dan staat bovenaan Vandaag "Je bent bij ..." met Pitstop en Bezoek afronden.
// Eén locatiemeting bij openen; een PWA volgt geen locatie op de achtergrond (8.6).
import { isAanwezig } from '~~/shared/route'
const props = defineProps<{ deel: 'kaart' | 'inloop' }>()
const { functie, me } = useMe()
const { pakket, laad } = useDagpakket()
const { plek } = useLocatie()
const buiten = computed(() => ['buitendienst', 'hybride'].includes(me.value?.gebruiker.werkplek ?? ''))
const hier = ref<any>(null)
const afronden = ref<any>(null)
const inloopOpen = ref(false)
const { voegToe } = useSyncQueue()
onMounted(async () => {
  if (props.deel !== 'kaart' || !buiten.value || !functie('onderweg.aankomst')?.beschikbaar) return
  await laad()
  const stops = (pakket.value?.dagen?.[0]?.stops ?? []).filter((s: any) => s.soort === 'afspraak' && s.status === 'gepland' && s.punt)
  const nu = new Date()
  if (!stops.some((s: any) => nu.getTime() >= Date.parse(s.start) - 15 * 60_000 && nu.getTime() <= Date.parse(s.eind))) return
  const p = await plek()
  if (p) hier.value = stops.find((s: any) => isAanwezig(p, s, nu)) ?? null
})
function rondAf(s: any) {
  const ms = (pakket.value?.meetingsoorten ?? []).find((m: any) => m.slug === s.soortSlug)
  afronden.value = { id: s.id, accountId: s.accountId, accountNaam: s.accountNaam, start: s.start, eind: s.eind, eerste: !!ms?.data?.eersteAfspraak && s.faseId === 'afspraak-gepland', uitkomsten: ms?.data?.uitkomsten ?? [] }
}
async function inloop(a: { id: string; naam: string }) {
  inloopOpen.value = false
  const id = crypto.randomUUID(); const start = new Date()
  await voegToe({ tabel: 'appointments', op: 'patch', recordId: id, patch: { soort: 'inloop.vastleggen', accountId: a.id, tijd: start.toISOString() } })
  const ms = (pakket.value?.meetingsoorten ?? []).find((m: any) => m.slug === 'ongepland-bezoek')
  afronden.value = { id, accountId: a.id, accountNaam: a.naam, start: start.toISOString(), eind: new Date(start.getTime() + 30 * 60_000).toISOString(), eerste: false, uitkomsten: ms?.data?.uitkomsten ?? [] }
}
</script>

<template>
  <div v-if="buiten">
    <section v-if="hier" class="aankomst-kaart" data-test="aankomst-kaart">
      <p class="ow-status">Aangekomen</p>
      <h2 class="kop-blok">Je bent bij {{ hier.accountNaam }}</h2>
      <p class="dd-acties"><NuxtLink class="dd-act" :to="`/agenda?afspraak=${hier.id}`">Pitstop</NuxtLink><button type="button" class="dd-act dd-act--primair" @click="rondAf(hier)">Bezoek afronden</button></p>
    </section>
    <button v-if="deel === 'inloop' && functie('onderweg.inloop')?.beschikbaar" type="button" class="dd-act dd-act--geel ow-knop-groot mt-8" data-test="vandaag-inloop" @click="inloopOpen = true"><Icoon naam="Plus" />Inloop</button>
    <BezoekAfrondenVenster :open="!!afronden" :afspraak="afronden" @sluit="afronden = null" />
    <InloopKiezer :open="inloopOpen" @sluit="inloopOpen = false" @gekozen="inloop" />
  </div>
</template>
