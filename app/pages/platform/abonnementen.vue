<script setup lang="ts">
// Platformbeheer · Abonnementen (F23): per pakket de functies, bronnen, AI-credits per gebruiker, de AI-soorten
// en de prijs met geldig-vanaf. De matrix "Welke inhoud?" vergelijkt pakketten, of een pakket met een klant.
import { PAKKET_LABEL, type Pakket } from '~~/shared/types'
const { me } = useMe()
if (me.value?.echteRol !== 'founder') throw createError({ statusCode: 404, statusMessage: 'Deze pagina bestaat niet' })
const toast = useToast()
const { data, refresh } = await useFetch<any>('/api/platform/abonnementen', { default: () => ({ pakketten: [], matrix: [], klanten: [], historie: [] }) })
const euro = (c: number | null | undefined) => (c == null ? '-' : new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(c / 100))
const vandaag = new Date().toISOString().slice(0, 10)
const nieuw = reactive<{ pakket: Pakket; prijs: string; seat: string; vanaf: string }>({ pakket: 'starter', prijs: '', seat: '', vanaf: vandaag })
async function bewaarPrijs() {
  try { const r: any = await $fetch('/api/platform/abonnementen/prijs', { method: 'PUT', body: { pakket: nieuw.pakket, prijsCent: Math.round(Number(nieuw.prijs) * 100), seatCent: Math.round(Number(nieuw.seat) * 100), geldigVanaf: nieuw.vanaf } }); toast.toon(r.tekst); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function zetCredits(p: string, w: string) {
  try { await $fetch(`/api/platform/pakketten/${p}/credits`, { method: 'PUT', body: { perGebruiker: Number(w) } }); toast.toon(`${PAKKET_LABEL[p as Pakket]}: ${w} credits per gebruiker per maand.`); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const vergelijk = ref<string>('')
const klantPakket = computed(() => data.value.klanten.find((k: any) => k.id === vergelijk.value)?.pakket ?? null)
const RANG: Record<string, number> = { starter: 0, plus: 1, compleet: 2 }
const inPakket = (f: any, p: string) => RANG[p]! >= RANG[f.pakket]!
useHead({ title: 'Abonnementen · Platformbeheer · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Platformbeheer" titel="Abonnementen" uitleg="Pakketten met functies, bronnen en AI-credits; prijzen als gegeven met geldig-vanaf." />
    <section class="section section--laatste">
      <div class="container stapel">
        <p class="alleen-groot-melding kaart kaart--geel">Beter op een groot scherm.</p>
        <div class="raster raster--3">
          <article v-for="p in data.pakketten" :key="p.pakket" class="kaart" :data-test="`pakket-${p.pakket}`">
            <header class="kaart-kop"><h2 class="kaart-titel">{{ p.label }}</h2><span class="pil pil--leeg">{{ p.functies }} functies</span></header>
            <p class="kaart-meta">Prijs {{ euro(p.prijs?.prijsCent) }} per maand plus {{ euro(p.prijs?.seatCent) }} per seat<template v-if="p.prijs"> · sinds {{ p.prijs.geldigVanaf }}</template></p>
            <p v-for="k in p.komend" :key="k.op" class="kaart-meta">Vanaf {{ k.geldigVanaf }}: {{ euro(k.prijsCent) }} plus {{ euro(k.seatCent) }} per seat</p>
            <p class="kaart-meta">Bronnen: {{ p.bronnen.join(', ') }}</p>
            <label class="veld mt-8"><span class="veld-label">AI-credits per gebruiker per maand (standaard {{ p.standaardCredits }})</span><input class="invoer" type="number" min="0" :value="p.creditsPerGebruiker" @change="zetCredits(p.pakket, ($event.target as HTMLInputElement).value)"></label>
            <p class="kaart-meta mt-8">AI aan in dit pakket: {{ p.aiSoorten.join(', ') }}</p>
          </article>
        </div>
        <article class="kaart" data-test="prijs-nieuw">
          <h2 class="kaart-titel">Nieuwe prijs</h2>
          <p class="kaart-meta">Een prijs geldt vanaf de gekozen datum, vandaag of later. Bestaande facturen veranderen niet.</p>
          <div class="formulier-raster mt-8">
            <label class="veld"><span class="veld-label">Pakket</span><select v-model="nieuw.pakket" class="invoer"><option v-for="p in data.pakketten" :key="p.pakket" :value="p.pakket">{{ p.label }}</option></select></label>
            <label class="veld"><span class="veld-label">Per maand (€)</span><input v-model="nieuw.prijs" class="invoer" type="number" min="0" step="0.01"></label>
            <label class="veld"><span class="veld-label">Per seat (€)</span><input v-model="nieuw.seat" class="invoer" type="number" min="0" step="0.01"></label>
            <label class="veld"><span class="veld-label">Geldig vanaf</span><input v-model="nieuw.vanaf" class="invoer" type="date" :min="vandaag"></label>
          </div>
          <button type="button" class="dd-act mt-8" @click="bewaarPrijs">Prijs vastleggen</button>
        </article>
        <article class="kaart" data-test="matrix">
          <header class="kaart-kop"><h2 class="kaart-titel">Welke inhoud?</h2>
            <select v-model="vergelijk" class="invoer invoer--klein" aria-label="Vergelijk met klant"><option value="">Vergelijk met klant</option><option v-for="k in data.klanten" :key="k.id" :value="k.id">{{ k.naam }} ({{ PAKKET_LABEL[k.pakket as Pakket] }})</option></select></header>
          <table class="tabel tabel--kaarten mt-8"><thead><tr><th>Functie</th><th>Groep</th><th>Starter</th><th>Plus</th><th>Compleet</th><th v-if="klantPakket">Klant</th></tr></thead>
            <tbody><tr v-for="f in data.matrix" :key="f.sleutel"><td data-label="Functie">{{ f.naam }}</td><td data-label="Groep" class="meta">{{ f.groep }}</td>
              <td v-for="p in ['starter', 'plus', 'compleet']" :key="p" :data-label="PAKKET_LABEL[p as Pakket]">{{ inPakket(f, p) ? 'Ja' : '-' }}</td>
              <td v-if="klantPakket" data-label="Klant">{{ inPakket(f, klantPakket) ? 'Ja' : '-' }}</td></tr></tbody></table>
        </article>
      </div>
    </section>
  </div>
</template>
