<script setup lang="ts">
// Verbruik en AI-credits (F22, F23, 11.4): de pot met markeringen bij 80 en 90 procent, verbruik
// per soort en per gebruiker (credits, geen euro's), plafond per gebruiker, dagplafond per AI-soort
// voor de agents en extra credits aanvragen. Beheerder; de salesmanager leest.
const { functie } = useMe()
if (!functie('credits.verbruikLezen')?.beschikbaar) throw createError({ statusCode: 403, statusMessage: 'Alleen beheerder en salesmanager zien het verbruik' })
const toast = useToast()
const route = useRoute()
const { data, refresh } = await useFetch<any>('/api/instellingen/verbruik', { query: computed(() => ({ maand: route.query.maand })), default: () => null })
const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']
const maandTekst = computed(() => data.value ? `${MAANDEN[Number(data.value.maand.slice(5)) - 1]} ${data.value.maand.slice(0, 4)}` : '')
const getal = (n: number) => new Intl.NumberFormat('nl-NL').format(n)
const post = (url: string, body: unknown, method = 'POST'): Promise<any> => ($fetch as any)(url, { method, body })
async function zetPlafond(u: any, w: string) {
  try { const r = await post('/api/instellingen/credits/plafond', { gebruikerId: u.id, plafond: w === '' ? null : Number(w) }, 'PUT'); toast.toon(r.tekst); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const dag = ref<Record<string, string>>({})
watch(() => data.value?.dagplafonds, (d) => { dag.value = Object.fromEntries(Object.entries(d ?? {}).map(([k, v]) => [k, String(v)])) }, { immediate: true })
async function bewaarDag() {
  try { await post('/api/instellingen/credits/dagplafonds', Object.fromEntries(Object.entries(dag.value).filter(([, v]) => v !== ''))  , 'PUT'); toast.toon('Dagplafonds bewaard.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const extra = reactive({ open: false, aantal: 1000, toelichting: '' })
async function vraagExtra() {
  try { const r = await post('/api/abonnement/extra-credits', { aantal: extra.aantal, toelichting: extra.toelichting }); toast.toon(r.tekst); extra.open = false; await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
useHead({ title: 'Verbruik · Instellingen · Dealtrace' })
</script>

<template>
  <div v-if="data">
    <PaginaKop :kicker="`Verbruik · ${maandTekst}`" :titel="`${getal(data.stand.verbruikt)} van ${getal(data.stand.pot)} credits gebruikt, ${Math.round(data.stand.procent)} procent.`" uitleg="Alle AI in Dealtrace rekent in credits uit één pot per maand." helpartikel="abonnement-verbruik-ai-credits" />
    <section class="section section--laatste">
      <div class="container stapel">
        <p class="alleen-groot-melding kaart kaart--geel">Beter op een groot scherm.</p>
        <article class="kaart" data-test="pot">
          <div class="pot-meter" role="meter" :aria-valuenow="data.stand.procent" aria-valuemin="0" aria-valuemax="100" aria-label="Verbruikt deel van de pot">
            <div class="pot-vulling" :class="{ 'pot-vulling--rood': data.stand.procent >= 90, 'pot-vulling--geel': data.stand.procent >= 80 && data.stand.procent < 90 }" :style="{ width: `${Math.min(100, data.stand.procent)}%` }" />
            <span class="pot-streep" style="left: 80%" title="Melding bij 80 procent" /><span class="pot-streep" style="left: 90%" title="Agents stoppen bij 10 procent over" />
          </div>
          <p class="meta mt-8">Bij 80 procent krijgt iedereen een melding. Bij 10 procent over stoppen agents en automatische voorbereiding; wat jullie zelf vragen gaat door. <NuxtLink to="/helpcenter/abonnement-verbruik-ai-credits">Lees hoe het werkt</NuxtLink></p>
          <p v-if="data.stand.extra" class="meta">Inclusief {{ getal(data.stand.extra) }} extra credits deze maand.</p>
          <button v-if="data.kan.beheer" type="button" class="dd-act mt-8" data-test="extra-aanvragen" @click="extra.open = !extra.open">Extra credits aanvragen</button>
          <form v-if="extra.open" class="vv-velden mt-8" data-test="extra-form" @submit.prevent="vraagExtra">
            <label class="veld"><span class="veld-label">Aantal</span><input v-model.number="extra.aantal" type="number" min="1" class="invoer"></label>
            <label class="veld"><span class="veld-label">Toelichting</span><input v-model="extra.toelichting" class="invoer"></label>
            <div><button type="submit" class="dd-act dd-act--primair">Aanvragen</button></div>
          </form>
          <ul v-if="data.aanvragen.length" class="schakel-lijst mt-8"><li v-for="a in data.aanvragen" :key="a.id" class="schakel-rij"><span>{{ getal(a.aantal) }} credits</span><span class="meta">{{ a.status }}</span></li></ul>
        </article>

        <article class="kaart" data-test="per-soort">
          <h2 class="kaart-titel">Per soort</h2>
          <p v-if="!data.perSoort.length" class="meta">Deze maand nog geen AI gebruikt.</p>
          <table v-else class="tabel tabel--kaarten mt-8"><thead><tr><th>Soort</th><th>Handelingen</th><th>Credits</th></tr></thead>
            <tbody><tr v-for="s in data.perSoort" :key="s.soort"><td data-label="Soort">{{ s.naam }}</td><td data-label="Handelingen" class="tnum">{{ s.handelingen }}</td><td data-label="Credits" class="tnum">{{ s.credits }}</td></tr></tbody></table>
        </article>

        <article class="kaart" data-test="per-gebruiker">
          <h2 class="kaart-titel">Per gebruiker</h2>
          <p class="meta">Wat iemand zelf vraagt, telt op zijn plafond. Leeg is geen plafond.</p>
          <table class="tabel tabel--kaarten mt-8"><thead><tr><th>Gebruiker</th><th>Credits</th><th>Plafond</th></tr></thead>
            <tbody><tr v-for="u in data.perGebruiker" :key="u.id" :data-test="`gebruiker-${u.id}`"><td data-label="Gebruiker">{{ u.naam.replace(/^Testgebruiker /, '') }}</td><td data-label="Credits" class="tnum">{{ u.credits }}</td>
              <td data-label="Plafond"><input v-if="data.kan.beheer" class="invoer invoer--klein" type="number" min="0" :value="u.plafond ?? ''" placeholder="geen" :aria-label="`Plafond voor ${u.naam}`" data-test="plafond" @change="zetPlafond(u, ($event.target as HTMLInputElement).value)"><span v-else>{{ u.plafond ?? 'geen' }}</span></td></tr></tbody></table>
        </article>

        <article v-if="data.kan.beheer" class="kaart" data-test="dagplafonds">
          <h2 class="kaart-titel">Dagplafond per AI-soort voor de agents</h2>
          <p class="meta">De Bewaker toetst dit samen met het dagplafond per agent (Agents en mandaten).</p>
          <div class="vv-velden mt-8"><label v-for="s in data.soorten" :key="s.sleutel" class="veld"><span class="veld-label">{{ s.naam }}</span><input v-model="dag[s.sleutel]" type="number" min="0" class="invoer" placeholder="geen"></label></div>
          <button type="button" class="dd-act dd-act--primair mt-8" @click="bewaarDag">Bewaar dagplafonds</button>
        </article>
      </div>
    </section>
  </div>
</template>
