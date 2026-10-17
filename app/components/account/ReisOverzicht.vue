<script setup lang="ts">
// Prospectreis van een account (venster Reis onder Meer, op de accountkaart en de contactkaart): de reis,
// de fase met het accent, de status, een nee met afkoeling, de terugkomdatum en daaronder de
// reisgeschiedenis (alleen voor wie die mag zien).
import { STATUS_LABEL } from '~/utils/accountWeergave'
const props = defineProps<{ account: any }>()
const a = computed(() => props.account)
const regels = ref<any[]>([])
const laden = ref(false)
onMounted(async () => {
  if (!a.value.kan?.geschiedenis || !a.value.reis) return
  laden.value = true
  try { regels.value = (await $fetch<any>(`/api/accounts/${a.value.id}/reisgeschiedenis`)).regels } catch { regels.value = [] } finally { laden.value = false }
})
const datum = (t: string) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Amsterdam' }).format(new Date(t))
</script>

<template>
  <article class="kaart" data-test="reis-blok">
    <header class="kaart-kop"><h2 class="kaart-titel">Reis</h2><NuxtLink v-if="a.reis && a.kan?.reisBekijken" :to="`/reizen/${a.reis.id}`" class="tekst-link" data-test="reis-overzicht-link">Bekijk de reis</NuxtLink></header>
    <template v-if="a.reis">
      <p class="kaart-meta"><strong>{{ a.reis.naam }}</strong> · {{ a.reis.fase?.label }} · {{ STATUS_LABEL[a.status] ?? a.status }}<template v-if="a.dagenInFase !== null && a.dagenInFase !== undefined"> · {{ a.dagenInFase }} dagen in fase</template></p>
      <p v-if="a.reis.fase?.accent" class="fasekaart-accent">{{ a.reis.fase.accent }}</p>
      <p v-if="a.nee" class="kaart-meta mt-8">Nee: {{ a.nee.reden }}<template v-if="a.nee.toelichting"> ({{ a.nee.toelichting }})</template>; afkoeling bellen tot {{ a.nee.tot.bellen }}, mail tot {{ a.nee.tot.mail }}.</p>
      <p v-if="a.terugkom" class="kaart-meta mt-8">{{ a.terugkom.tekst }}</p>
    </template>
    <p v-else class="kaart-meta">{{ a.soort === 'klant' ? 'Klanten lopen geen prospectreis; het vervolg loopt in DealDrive of je CRM.' : 'Nog geen reis.' }}</p>
  </article>
  <section v-if="a.reis && a.kan?.geschiedenis" class="kaart" data-test="reis-geschiedenis">
    <header class="kaart-kop"><h2 class="kaart-titel">Geschiedenis</h2></header>
    <p v-if="laden" class="meta">Laden…</p>
    <LegeStaat v-else-if="!regels.length" titel="Nog geen geschiedenis." tekst="Elke fasewissel komt hier, met wie of wat hem meldde." />
    <ol v-else class="reis-historie">
      <li v-for="r in regels" :key="r.id" class="reis-historie-rij">
        <span class="meta tnum">{{ datum(r.op) }}</span>
        <span><strong>{{ r.van ? `${r.van} → ` : '' }}{{ r.naar }}</strong><template v-if="r.vanStatus !== r.naarStatus && r.naarStatus"> · status {{ r.naarStatus }}</template></span>
        <span class="meta">{{ r.gebeurtenis }} · {{ r.door === 'motor' ? 'motor' : r.door?.replace(/^Testgebruiker /, '') }}</span>
        <span v-if="r.reden" class="reis-historie-reden">{{ r.reden }}</span>
      </li>
    </ol>
  </section>
</template>
