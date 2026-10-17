<script setup lang="ts">
// Tabblad Rondes en verbruik (F02): rondes en imports met gevonden, overgenomen, afgewezen en
// conversie naar afspraak; meters per bron en de daggrens. Opgeslagen zoekopdrachten (Expert).
const { functie } = useMe()
const toast = useToast()
const { data } = await useFetch<any>('/api/leads/verbruik', { default: () => null })
const kanOpgeslagen = computed(() => !!functie('leads.opgeslagen')?.beschikbaar)
const kanAuto = computed(() => !!functie('leads.automatisch')?.beschikbaar)
const { data: opgeslagen, refresh } = kanOpgeslagen.value ? await useFetch<any[]>('/api/leads/zoekopdrachten', { default: () => [] }) : { data: ref<any[]>([]), refresh: async () => {} }
async function zet(z: any, waarden: Record<string, unknown>) {
  try { await $fetch(`/api/leads/zoekopdrachten/${z.id}`, { method: 'PUT', body: waarden }); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const datum = (t: string) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(t))
const fmt = (n: number) => new Intl.NumberFormat('nl-NL').format(n)
</script>

<template>
  <div data-test="tab-rondes">
    <div v-if="data" class="stat-grid">
      <div class="stat-card"><span class="stat-label">AI-credits deze maand</span><span class="stat-num tnum">{{ fmt(data.meters.credits.over) }} over</span><span class="stat-foot">van {{ fmt(data.meters.credits.pot) }}; een ronde kost 20, een dossier 10</span></div>
      <div class="stat-card"><span class="stat-label">KvK-bevragingen</span><span class="stat-num tnum">{{ fmt(data.meters.kvk.gebruikt) }} / {{ fmt(data.meters.kvk.plafond) }}</span><span class="stat-foot">{{ data.meters.kvk.gekoppeld ? 'deze maand' : 'KvK is niet gekoppeld' }}</span></div>
      <div class="stat-card"><span class="stat-label">Rondes vandaag</span><span class="stat-num tnum" data-test="rondes-vandaag">{{ data.meters.rondes.vandaag }} / {{ data.meters.rondes.grens }}</span><span class="stat-foot">daggrens per gebruiker</span></div>
    </div>
    <LegeStaat v-if="!data?.lijst.length" class="mt-32" titel="Nog geen rondes." tekst="Start een ronde op het tabblad Zoeken of importeer een lijst." />
    <div v-else class="tabel-wrap mt-32">
      <table class="tabel tabel--kaarten" data-test="rondes">
        <thead><tr><th>Datum</th><th>Bron</th><th>Door</th><th class="cel-r">Gevonden</th><th class="cel-r">Overgenomen</th><th class="cel-r">Afgewezen</th><th class="cel-r">Naar afspraak</th></tr></thead>
        <tbody><tr v-for="r in data.lijst" :key="r.id">
          <td class="tnum"><FunctieLink als-tekst v-if="r.soort === 'ronde'" :to="`/leadgenerator?ronde=${r.id}`">{{ datum(r.op) }}</FunctieLink><template v-else>{{ datum(r.op) }}</template></td>
          <td>{{ r.bron }}<span v-if="r.automatisch" class="meta"> · automatisch</span><span v-if="r.kosten?.credits" class="meta"> · {{ r.kosten.credits }} credits</span></td>
          <td>{{ r.door?.replace(/^Testgebruiker /, '') }}</td>
          <td class="cel-r tnum">{{ r.gevonden }}</td><td class="cel-r tnum">{{ r.overgenomen }}</td><td class="cel-r tnum">{{ r.afgewezen }}</td>
          <td class="cel-r tnum">{{ r.conversie == null ? 'nog open' : `${r.conversie}%` }}</td>
        </tr></tbody>
      </table>
    </div>
    <template v-if="kanOpgeslagen">
      <h2 class="kop-blok mt-32">Opgeslagen zoekopdrachten</h2>
      <p v-if="!opgeslagen.length" class="meta mt-8">Bewaar een zoekopdracht op het tabblad Zoeken met "Bewaar als zoekopdracht".</p>
      <div v-else class="lijst mt-12" data-test="opgeslagen">
        <div v-for="z in opgeslagen" :key="z.id" class="rij rij--compact">
          <div class="rij-info"><h3 class="rij-titel">{{ z.naam }}</h3><div class="rij-sub">{{ z.automatisch === 'wekelijks' ? 'Draait elke week' : 'Handmatig' }}{{ z.laatstOp ? ` · laatst ${datum(z.laatstOp)}` : '' }}</div></div>
          <div class="rij-rechts">
            <label v-if="kanAuto" class="vink"><input type="checkbox" :checked="z.automatisch === 'wekelijks'" @change="zet(z, { automatisch: ($event.target as HTMLInputElement).checked ? 'wekelijks' : 'uit' })"> Wekelijks</label>
            <button type="button" class="dd-act" @click="zet(z, { verwijder: true })">Verwijder</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
