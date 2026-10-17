<script setup lang="ts">
// Gebieden en regiodagen (F18, beheerder): "Je week" met vijf dagkaarten, per regio de naam,
// postcodereeksen, plaatsen als vangnet, eigenaren en regiodagen per persoon (alle, even of
// oneven weken), synoniemen voor plaatsnamen en een voorstel uit de portefeuille. Overlap wordt
// bij opslaan geblokkeerd (gat 45).
import { overlap, type Regio } from '~~/shared/gebieden'
const { functie } = useMe()
const aan = computed(() => !!functie('instellingen.gebieden')?.beschikbaar)
const toast = useToast()
const { data, refresh } = await useFetch<any>('/api/gebieden', { default: () => ({ regios: [], synoniemen: {}, tellingen: [], gebruikers: [], kan: {} }) })
const regios = ref<Regio[]>([])
const synoniemen = ref<{ van: string; naar: string }[]>([])
// Opslaan-status onder de kop: Gewijzigd tot Bewaar.
const opslag = useFlyoutOpslag()
opslag.volg(() => [regios.value, synoniemen.value])
watch(data, (d) => { regios.value = JSON.parse(JSON.stringify(d.regios ?? [])); synoniemen.value = Object.entries(d.synoniemen ?? {}).map(([van, naar]) => ({ van, naar: String(naar) })) }, { immediate: true })
watch(data, () => nextTick(() => opslag.basis()))
onMounted(() => opslag.basis())
const DAGEN = ['', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag']
const buitendienst = computed(() => data.value.gebruikers.filter((u: any) => u.werkplek === 'buitendienst'))
const binnendienst = computed(() => data.value.gebruikers.filter((u: any) => u.werkplek === 'binnendienst'))
const naam = (id: string) => data.value.gebruikers.find((u: any) => u.id === id)?.naam?.replace(/^Testgebruiker /, '') ?? id
const tel = (id: string | null) => data.value.tellingen.find((t: any) => t.gebied_id === id) ?? { klanten: 0, prospects: 0, nooit: 0, stil: 0 }
const week = computed(() => [1, 2, 3, 4, 5].map((wd) => ({ dag: DAGEN[wd], items: regios.value.flatMap((r) => r.dagen.filter((d) => d.weekdag === wd).map((d) => ({ regio: r, d }))) })))
const reeksTekst = (r: Regio) => r.reeksen.map((s) => `${s.van}-${s.tot}`).join(', ')
function zetReeksen(r: Regio, t: string) { r.reeksen = t.split(',').map((x) => x.trim()).filter(Boolean).map((x) => { const [a, b] = x.split('-').map((y) => Number(y.trim())); return { van: a!, tot: b ?? a! } }) }
const conflict = computed(() => overlap(regios.value, Object.fromEntries(synoniemen.value.map((s) => [s.van, s.naar])))[0]?.tekst ?? null)
function nieuw() { regios.value.push({ id: `regio-${Date.now()}`, naam: 'Nieuwe regio', reeksen: [], plaatsen: [], eigenaren: { buitendienst: [], binnendienst: [] }, dagen: [] }) }
async function voorstel() {
  const r: any = await $fetch('/api/gebieden/voorstel', { method: 'POST' })
  regios.value = r.regios; toast.toon(`Voorstel met ${r.regios.length} regio's. Controleer en bewaar.`)
}
const bezig = ref(false)
async function bewaar() {
  bezig.value = true
  try {
    await opslag.bewaar(async () => {
      await $fetch('/api/settings/plaatsSynoniemen', { method: 'PUT', body: { value: Object.fromEntries(synoniemen.value.filter((s) => s.van.trim() && s.naar.trim()).map((s) => [s.van.trim().toLowerCase(), s.naar.trim().toLowerCase()])) } })
      await $fetch('/api/settings/gebieden', { method: 'PUT', body: { value: regios.value } })
    })
    toast.toon('Gebieden bewaard. Accounts hebben hun regio gekregen.'); await refresh()
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
const kies = (lijst: string[], id: string, aan: boolean) => { const i = lijst.indexOf(id); if (aan && i < 0) lijst.push(id); if (!aan && i >= 0) lijst.splice(i, 1) }
const titel = computed(() => {
  const r = regios.value.length
  const d = regios.value.reduce((n, x) => n + x.dagen.length, 0)
  return r ? `${r} ${r === 1 ? 'regio' : "regio's"}, ${d} ${d === 1 ? 'regiodag' : 'regiodagen'} per week` : 'Gebieden en regiodagen'
})
useHead({ title: 'Gebieden · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="instellingen.gebieden" />
    <template v-else>
      <InstellingenKop groep="Ritme en regels" :titel="titel" uitleg="Gebieden en regiodagen: regio's op postcode, wie er eigenaar is en op welke dag de buitendienst er is." helpartikel="gebieden-en-regiodagen">
        <template #onder><p class="mt-8"><OpslagStatus :opslag="opslag" test="gb-status" /></p></template>
        <template #acties>
          <button type="button" class="dd-actie dd-actie--secundair" data-test="gb-voorstel" @click="voorstel">Voorstel uit je accounts</button>
          <button type="button" class="dd-actie dd-actie--primair" :disabled="bezig || !!conflict" data-test="gb-bewaar" @click="bewaar"><Icoon naam="Check" class="dd-actie-icoon" />Bewaar gebieden</button>
        </template>
      </InstellingenKop>
      <section class="section section--laatste">
        <div class="container" @input.capture="opslag.interactie()" @pointerdown.capture="opslag.interactie()">
          <p class="alleen-groot-melding kaart kaart--geel">Beter op een groot scherm. Gebieden werken ook hier, maar zijn ruimer op een laptop.</p>
          <h2 class="kop-blok">Je week</h2>
          <div class="bz-week" data-test="gb-week">
            <div v-for="w in week" :key="w.dag" class="kaart"><strong>{{ w.dag }}</strong>
              <p v-for="(x, i) in w.items" :key="i" class="meta">{{ naam(x.d.gebruikerId) }}: {{ x.regio.naam }}<template v-if="x.d.weken !== 'alle'"> ({{ x.d.weken }} weken)</template><br>{{ tel(x.regio.id).klanten }} klanten · {{ tel(x.regio.id).prospects }} prospects · {{ tel(x.regio.id).nooit }} nooit bezocht · {{ tel(x.regio.id).stil }} stil</p>
              <p v-if="!w.items.length" class="meta">Geen regiodag</p>
            </div>
          </div>
          <p class="taak-meta mt-16" data-test="gb-zonder">Zonder regio: {{ tel(null).klanten + tel(null).prospects }} accounts.</p>
          <p v-if="conflict" class="kaart kaart--rood mt-16" role="alert" data-test="gb-overlap">{{ conflict }}</p>
          <LegeStaat v-if="!regios.length" class="mt-16" kicker="Gebieden" titel="Nog geen regio's." tekst="Begin met Voorstel uit je accounts of voeg zelf een regio toe op postcode." />
          <div v-else class="lijst mt-16">
            <article v-for="(r, ri) in regios" :key="r.id" class="kaart" :data-test="`gb-regio-${r.id}`">
              <div class="formulier-raster">
                <label class="veld"><span class="veld-label">Naam</span><input v-model="r.naam" class="invoer"></label>
                <label class="veld"><span class="veld-label">Postcodereeksen</span><input :value="reeksTekst(r)" class="invoer" placeholder="3701-3799, 3800-3829" :data-test="`gb-reeksen-${ri}`" @change="zetReeksen(r, ($event.target as HTMLInputElement).value)"></label>
                <label class="veld"><span class="veld-label">Plaatsen (vangnet)</span><input :value="r.plaatsen.join(', ')" class="invoer" @change="r.plaatsen = ($event.target as HTMLInputElement).value.split(',').map((x) => x.trim()).filter(Boolean)"></label>
              </div>
              <div class="raster raster--2 mt-8">
                <div><span class="veld-label">Buitendienst</span>
                  <p v-for="u in buitendienst" :key="u.id" class="schakel-rij"><span>{{ u.naam.replace(/^Testgebruiker /, '') }}</span><Schakelaar :aan="r.eigenaren.buitendienst.includes(u.id)" :label="`${u.naam} eigenaar`" @wissel="kies(r.eigenaren.buitendienst, u.id, $event)" /></p>
                </div>
                <div><span class="veld-label">Binnendienstpartner</span>
                  <p v-for="u in binnendienst" :key="u.id" class="schakel-rij"><span>{{ u.naam.replace(/^Testgebruiker /, '') }}</span><Schakelaar :aan="r.eigenaren.binnendienst.includes(u.id)" :label="`${u.naam} partner`" @wissel="kies(r.eigenaren.binnendienst, u.id, $event)" /></p>
                </div>
              </div>
              <span class="veld-label mt-8">Regiodagen</span>
              <div v-for="(d, di) in r.dagen" :key="di" class="schakel-rij">
                <select v-model="d.gebruikerId" class="invoer"><option v-for="u in buitendienst" :key="u.id" :value="u.id">{{ u.naam.replace(/^Testgebruiker /, '') }}</option></select>
                <select v-model.number="d.weekdag" class="invoer"><option v-for="n in [1, 2, 3, 4, 5]" :key="n" :value="n">{{ DAGEN[n] }}</option></select>
                <select v-model="d.weken" class="invoer"><option value="alle">elke week</option><option value="even">even weken</option><option value="oneven">oneven weken</option></select>
                <button type="button" class="dd-act dd-act--icoon" aria-label="Verwijder regiodag" @click="r.dagen.splice(Number(di), 1)"><Icoon naam="Trash2" /></button>
              </div>
              <p class="dd-acties mt-8"><button type="button" class="dd-act" @click="r.dagen.push({ gebruikerId: buitendienst[0]?.id ?? '', weekdag: 2, weken: 'alle' })">Regiodag toevoegen</button><span class="dd-acties-vul" /><button type="button" class="dd-act" @click="regios.splice(Number(ri), 1)">Verwijder regio</button></p>
            </article>
          </div>
          <button type="button" class="dd-act mt-16" data-test="gb-nieuw" @click="nieuw">Regio toevoegen</button>
          <h2 class="kop-blok mt-24">Synoniemen voor plaatsnamen</h2>
          <p class="meta">"Den Bosch" is altijd "'s-Hertogenbosch". Voeg hier jullie eigen schrijfwijzen toe.</p>
          <div v-for="(s, i) in synoniemen" :key="i" class="schakel-rij"><input v-model="s.van" class="invoer" aria-label="Schrijfwijze"><span>is</span><input v-model="s.naar" class="invoer" aria-label="Plaats"><button type="button" class="dd-act dd-act--icoon" aria-label="Verwijder" @click="synoniemen.splice(Number(i), 1)"><Icoon naam="Trash2" /></button></div>
          <button type="button" class="dd-act mt-8" @click="synoniemen.push({ van: '', naar: '' })">Synoniem toevoegen</button>
        </div>
      </section>
    </template>
  </div>
</template>
