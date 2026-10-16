<script setup lang="ts">
// Platformbeheer · Platformaudit (F23): alleen toevoegen; actor, organisatie, handeling, object, voor en na,
// reden, ip en tijd. Filters op founder, organisatie, handeling en periode, in de URL.
const { me } = useMe()
if (me.value?.echteRol !== 'founder') throw createError({ statusCode: 404, statusMessage: 'Deze pagina bestaat niet' })
const route = useRoute()
const router = useRouter()
const q = computed(() => ({ founder: route.query.founder || undefined, organisatie: route.query.organisatie || undefined, handeling: route.query.handeling || undefined, van: route.query.van || undefined, tot: route.query.tot || undefined }))
const { data } = await useFetch<any>('/api/platform/audit', { query: q, default: () => ({ regels: [], founders: [], organisaties: [] }) })
const zet = (k: string, v: string) => router.replace({ query: { ...route.query, [k]: v || undefined } })
const moment = (s: string) => new Date(s).toLocaleString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })
useHead({ title: 'Platformaudit · Platformbeheer · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Platformbeheer" titel="Platformaudit" uitleg="Alles wat founders deden. Niets wordt gewijzigd of verwijderd; bewaartermijn 7 jaar." />
    <section class="section section--laatste">
      <div class="container stapel">
        <div class="formulier-raster">
          <label class="veld"><span class="veld-label">Founder</span><select class="invoer" :value="route.query.founder ?? ''" @change="zet('founder', ($event.target as HTMLSelectElement).value)"><option value="">Alle</option><option v-for="f in data.founders" :key="f.id" :value="f.id">{{ f.naam }}</option></select></label>
          <label class="veld"><span class="veld-label">Organisatie</span><select class="invoer" :value="route.query.organisatie ?? ''" @change="zet('organisatie', ($event.target as HTMLSelectElement).value)"><option value="">Alle</option><option v-for="o in data.organisaties" :key="o.id" :value="o.id">{{ o.naam }}</option></select></label>
          <label class="veld"><span class="veld-label">Handeling</span><input class="invoer" :value="route.query.handeling ?? ''" placeholder="bijvoorbeeld pakket" @change="zet('handeling', ($event.target as HTMLInputElement).value)"></label>
          <label class="veld"><span class="veld-label">Van</span><input class="invoer" type="date" :value="route.query.van ?? ''" @change="zet('van', ($event.target as HTMLInputElement).value)"></label>
          <label class="veld"><span class="veld-label">Tot en met</span><input class="invoer" type="date" :value="route.query.tot ?? ''" @change="zet('tot', ($event.target as HTMLInputElement).value)"></label>
        </div>
        <table class="tabel tabel--kaarten" data-test="platformaudit"><thead><tr><th>Tijd</th><th>Founder</th><th>Organisatie</th><th>Handeling</th><th>Object</th><th>Reden</th></tr></thead>
          <tbody><tr v-for="r in data.regels" :key="r.id" :title="JSON.stringify({ voor: r.voor, na: r.na, ip: r.ip })"><td data-label="Tijd">{{ moment(r.op) }}</td><td data-label="Founder">{{ r.actor }}</td><td data-label="Organisatie">{{ r.organisatie ?? '-' }}</td><td data-label="Handeling">{{ r.handeling }}</td><td data-label="Object">{{ r.object ?? '-' }}</td><td data-label="Reden">{{ r.reden ?? '-' }}</td></tr></tbody></table>
      </div>
    </section>
  </div>
</template>
