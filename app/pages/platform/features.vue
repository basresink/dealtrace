<script setup lang="ts">
// Platformbeheer · Features per niveau (4.2, F23). De founder zet per functie en niveau
// aan of uit, voor alle organisaties of als afwijking voor één organisatie. Elke wijziging
// werkt direct en staat in de platformaudit, met "Draai terug".
import { NIVEAUS, NIVEAU_LABEL, PAKKET_LABEL, type Pakket } from '~~/shared/types'
const { me } = useMe()
if (me.value?.echteRol !== 'founder') throw createError({ statusCode: 404, statusMessage: 'Deze pagina bestaat niet' })
const route = useRoute()
const router = useRouter()
const toast = useToast()
const org = computed(() => (route.query.organisatie as string) || '')
const featureFilter = computed(() => (route.query.feature as string) || '')
const alleenAfwijkingen = computed(() => route.query.afwijkingen === '1')
const { data, refresh } = await useFetch<any>('/api/platform/features', { query: computed(() => ({ organisatie: org.value || undefined })), default: () => ({ functies: [], organisaties: [], wijzigingen: [] }) })
const zet = (q: Record<string, string | undefined>) => router.replace({ query: { ...route.query, ...q } })
const groepen = computed(() => {
  const uit: { naam: string; functies: any[] }[] = []
  for (const f of data.value.functies) {
    if (featureFilter.value && f.groep !== featureFilter.value) continue
    if (alleenAfwijkingen.value && !NIVEAUS.some((n) => f.cellen[n].afwijking)) continue
    let g = uit.find((x) => x.naam === f.groep)
    if (!g) uit.push(g = { naam: f.groep, functies: [] })
    g.functies.push(f)
  }
  return uit
})
const alleGroepen = computed(() => [...new Set(data.value.functies.map((f: any) => f.groep))] as string[])
const titel = computed(() => `${data.value.functies.length} functies, ${data.value.functies.filter((f: any) => f.cellen.beginner.aan).length} aan voor Beginner.`)
const naamVan = (s: string) => data.value.functies.find((f: any) => f.sleutel === s)?.naam ?? s
const orgNaam = (id: string | null) => (id ? data.value.organisaties.find((o: any) => o.id === id)?.naam ?? id : 'alle organisaties')

let ongedaan: (() => Promise<void>) | null = null
async function wissel(f: any, n: string, aan: boolean) {
  const vorige = f.cellen[n].aan
  f.cellen[n].aan = aan
  try {
    await $fetch('/api/platform/features', { method: 'PUT', body: { functie: f.sleutel, niveau: n, aan, organisatieId: org.value || null } })
    ongedaan = async () => { await $fetch('/api/platform/features', { method: 'PUT', body: { functie: f.sleutel, niveau: n, aan: vorige, organisatieId: org.value || null } }); await refresh() }
    toast.toon(`${f.naam} staat nu ${aan ? 'aan' : 'uit'} voor ${NIVEAU_LABEL[n as 'beginner']}.`, 'succes', undefined, { tekst: 'Ongedaan maken', doe: () => ongedaan?.() })
    await refresh()
  } catch (e) { f.cellen[n].aan = vorige; toast.toon(foutTekst(e), 'fout') }
}
async function standaard(f: any, n: string) {
  try { await $fetch('/api/platform/features', { method: 'DELETE', body: { functie: f.sleutel, niveau: n, organisatieId: org.value } }); toast.toon('Terug naar standaard.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
async function draaiTerug(w: any) {
  try { await $fetch('/api/platform/features/terugdraaien', { method: 'POST', body: { auditId: w.id } }); toast.toon('Teruggedraaid.'); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const tijd = (iso: string) => new Intl.DateTimeFormat('nl-NL', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Amsterdam' }).format(new Date(iso))
function regel(w: any) {
  const [f, n, o] = (w.object ?? '').split('|')
  const actie = w.handeling === 'feature.standaard' ? 'terug naar standaard' : w.handeling === 'feature.terugdraaien' ? `teruggedraaid naar ${w.na ? (w.na.aan ? 'aan' : 'uit') : 'geen regel'}` : w.na?.aan ? 'aan' : 'uit'
  return `${naamVan(f)} · ${NIVEAU_LABEL[n as 'beginner'] ?? n} · ${orgNaam(o === 'alle' ? null : o)}: ${actie}`
}
useHead({ title: 'Features per niveau · Platformbeheer · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Platformbeheer · Features per niveau" :titel="titel" uitleg="Per functie en niveau aan of uit. Een wijziging werkt direct, zonder release." helpartikel="platformbeheer" />
    <section class="section section--laatste">
      <div class="container">
        <nav class="tabbalk" aria-label="Platformbeheer"><NuxtLink to="/platform/klanten" class="tab">Klanten</NuxtLink><NuxtLink to="/platform/features" class="tab tab--actief">Features per niveau</NuxtLink></nav>
        <p class="alleen-groot-melding kaart kaart--geel mt-8">Beter op een groot scherm.</p>
        <div class="formulier-raster mt-16">
          <label class="veld"><span class="veld-label">Organisatie</span>
            <select class="invoer" :value="org" data-test="feature-organisatie" @change="zet({ organisatie: ($event.target as HTMLSelectElement).value || undefined, afwijkingen: undefined })">
              <option value="">Alle organisaties</option><option v-for="o in data.organisaties" :key="o.id" :value="o.id">{{ o.naam }}</option>
            </select></label>
          <label class="veld"><span class="veld-label">Feature</span>
            <select class="invoer" :value="featureFilter" @change="zet({ feature: ($event.target as HTMLSelectElement).value || undefined })">
              <option value="">Alle features</option><option v-for="g in alleGroepen" :key="g" :value="g">{{ g }}</option>
            </select></label>
          <label v-if="org" class="veld veld--rij"><input type="checkbox" :checked="alleenAfwijkingen" @change="zet({ afwijkingen: ($event.target as HTMLInputElement).checked ? '1' : undefined })"> Alleen afwijkingen</label>
        </div>
        <div class="tabel-schuif mt-16">
          <table class="tabel" data-test="feature-raster">
            <thead><tr><th>Functie</th><th v-for="n in NIVEAUS" :key="n">{{ NIVEAU_LABEL[n] }}</th></tr></thead>
            <tbody v-for="g in groepen" :key="g.naam">
              <tr><th colspan="4" class="tabel-tussenkop">{{ g.naam }}</th></tr>
              <tr v-for="f in g.functies" :key="f.sleutel" :data-test="`feature-${f.sleutel}`">
                <td><strong>{{ f.naam }}</strong><br><span class="meta">{{ PAKKET_LABEL[f.pakket as Pakket] }} · {{ f.rollen === 'iedereen' ? 'iedereen' : f.rollen.join(', ') }}</span></td>
                <td v-for="n in NIVEAUS" :key="n" :class="{ 'cel-afwijking': f.cellen[n].afwijking }" :data-test="`cel-${f.sleutel}-${n}`">
                  <Schakelaar :aan="f.cellen[n].aan" :label="`${f.naam} voor ${NIVEAU_LABEL[n]}`" @wissel="wissel(f, n, $event)" />
                  <button v-if="f.cellen[n].afwijking" type="button" class="tekst-link" :data-test="`standaard-${f.sleutel}-${n}`" @click="standaard(f, n)">Terug naar standaard</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <article class="kaart mt-24" data-test="feature-wijzigingen">
          <h2 class="kaart-titel">Laatste wijzigingen</h2>
          <p v-if="!data.wijzigingen.length" class="kaart-meta">Nog geen wijzigingen.</p>
          <ul v-else class="schakel-lijst mt-8">
            <li v-for="w in data.wijzigingen" :key="w.id" class="schakel-rij"><span>{{ regel(w) }}<br><span class="meta">{{ tijd(w.op) }}</span></span><button v-if="w.handeling !== 'feature.terugdraaien'" type="button" class="dd-act" data-test="draai-terug" @click="draaiTerug(w)">Draai terug</button></li>
          </ul>
        </article>
      </div>
    </section>
  </div>
</template>
