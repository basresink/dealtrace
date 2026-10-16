<script setup lang="ts">
// "Wie ga je erbij zetten?" (F03): bedrijfsnaam met directe dubbelcheck. Een
// Beginner ziet alleen naam, plaats, telefoon en website. "Zoek in KvK" (P11) vult officiële
// naam, KvK, SBI, adres en medewerkers; de prospect komt dan uit het basisprofiel.
// Blok "Plek in de matrix": de velden die klasse, potentie, doelgroep, reis en ritme bepalen (branche
// uit het verkoopverhaal, aantal medewerkers, postcode voor de regio, klasse en huidige leverancier).
// Daaronder staat live waar de prospect valt. Het oude omvangveld (Aantal monteurs) staat er niet meer
// in: de matrix rekent met het aantal medewerkers.
import { kiesDoelgroep, type DoelgroepAccount } from '~~/shared/reis'
import { regioVan } from '~~/shared/gebieden'
import { POTENTIE_LABEL, potentieVan } from '~~/shared/planning'
import { klasseVoorOmvang, OMVANG_EIGEN_VELDEN } from '~~/shared/ritmematrix'
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ sluit: []; aangemaakt: [id: string]; bestaand: [id: string] }>()
const { me } = useMe()
const toast = useToast()
const leeg = () => ({ naam: '', plaats: '', postcode: '', adres: '', telefoon: '', website: '', linkedin: '', klasse: '', medewerkers: '' as string | number, vvBrancheId: '', huidigeLeverancierId: '', customFields: {} as Record<string, unknown> })
const f = reactive(leeg())
const dubbel = ref<any>(null)
const bezig = ref(false)
const uitgebreid = computed(() => me.value?.gebruiker.niveau !== 'beginner' || me.value?.organisatie?.iedereenAlles)
const { data: velden } = await useFetch<any>('/api/eigen-velden', { query: { object: 'account' }, default: () => ({ velden: [] }), immediate: true })
const eigenVelden = computed(() => ((velden.value?.velden ?? []) as any[]).filter((v) => !OMVANG_EIGEN_VELDEN.includes(v.sleutel)))
const { data: context } = await useFetch<any>('/api/accounts/nieuw-context', { default: () => ({ branches: [], concurrenten: [], klassen: [], regios: [], synoniemen: {}, doelgroepen: [], planning: null, kan: {} }) })
const klassen = computed(() => (context.value?.klassen ?? []) as any[])
const kanKlasse = computed(() => !!context.value?.kan?.klasse)
const kanLeverancier = computed(() => !!context.value?.kan?.leverancier && context.value.concurrenten.length > 0)
const { data: kvkStand } = await useFetch<any>('/api/kvk/status', { default: () => ({ gekoppeld: false }) })
const kvk = reactive({ open: false, bezig: false, resultaten: [] as any[], fout: '', gekozen: null as any })
watch(() => props.open, (o) => { if (o) { Object.assign(f, leeg()); dubbel.value = null; Object.assign(kvk, { open: false, resultaten: [], fout: '', gekozen: null }) } })
async function zoekKvk() {
  if (!navigator.onLine) { kvk.fout = 'KvK zoeken kan alleen met verbinding'; return }
  kvk.open = true; kvk.bezig = true; kvk.fout = ''
  try { kvk.resultaten = (await $fetch<any>('/api/kvk/zoek', { method: 'POST', body: { naam: f.naam, plaats: f.plaats || undefined } })).resultaten; if (!kvk.resultaten.length) kvk.fout = 'Niets gevonden in KvK. Controleer de naam of laat de plaats weg.' } catch (e) { kvk.fout = foutTekst(e) } finally { kvk.bezig = false }
}
async function kiesKvk(r: any) {
  if (r.alBekend) { emit('bestaand', r.alBekend.accountId); return }
  try {
    const p = await $fetch<any>(`/api/kvk/${r.kvk}`)
    kvk.gekozen = p
    Object.assign(f, { naam: p.naam, plaats: p.plaats ?? '', postcode: p.postcode ?? '', adres: p.adres ?? '', website: f.website || p.website || '', medewerkers: f.medewerkers === '' && p.medewerkers != null ? p.medewerkers : f.medewerkers })
    kvk.open = false
  } catch (e) { kvk.fout = foutTekst(e) }
}
let t: any
watch(() => [f.naam, f.website], () => {
  clearTimeout(t)
  t = setTimeout(async () => {
    if (f.naam.trim().length < 3) { dubbel.value = null; return }
    const d = await $fetch<any>('/api/accounts/dubbelcheck', { query: { naam: f.naam, domein: f.website } })
    dubbel.value = d.soort === 'geen' ? null : d
  }, 300)
})

// Waar valt hij? Dezelfde regels als de server: klasse uit medewerkers, regio uit postcode of plaats,
// potentie uit de planning en de doelgroep met de hoogste prioriteit.
const medewerkers = computed(() => (f.medewerkers === '' || f.medewerkers === null ? null : Number(f.medewerkers)))
const klasseVoorstel = computed(() => (medewerkers.value !== null && Number.isFinite(medewerkers.value) ? klasseVoorOmvang(medewerkers.value, klassen.value.length ? klassen.value : undefined) : null))
const klasseId = computed(() => (kanKlasse.value && f.klasse) || klasseVoorstel.value)
const klasseNaam = (id: string | null) => (id ? klassen.value.find((k) => k.id === id)?.naam ?? id : null)
const regio = computed(() => {
  const id = regioVan({ postcode: f.postcode, plaats: f.plaats }, context.value?.regios ?? [], context.value?.synoniemen ?? {})
  return id ? (context.value.regios as any[]).find((r) => r.id === id) ?? null : null
})
const potentie = computed(() => (context.value?.planning ? potentieVan({ klasse: klasseId.value, cf: f.customFields }, context.value.planning, klassen.value) : null))
const doelgroep = computed(() => {
  const a: DoelgroepAccount = {
    sbi: (kvk.gekozen?.sbi ?? []).map((s: any) => s.code), vvBrancheId: f.vvBrancheId || null, klasse: klasseId.value, medewerkers: medewerkers.value,
    postcode: f.postcode || null, gebiedId: regio.value?.id ?? null, bron: 'handmatig', segment: (f.customFields.segment as string) ?? null, tags: [], cf: f.customFields,
  }
  const id = kiesDoelgroep(a, context.value?.doelgroepen ?? [])
  return id ? (context.value.doelgroepen as any[]).find((d) => d.id === id) ?? null : null
})

async function maak() {
  bezig.value = true
  const matrix = {
    medewerkers: medewerkers.value ?? undefined, vvBrancheId: f.vvBrancheId || undefined,
    huidigeLeverancierId: f.huidigeLeverancierId || undefined, klasse: f.klasse || undefined,
  }
  try {
    const res = kvk.gekozen
      ? await $fetch<any>(`/api/kvk/${kvk.gekozen.kvk}/toevoegen`, { method: 'POST', body: { naam: f.naam, website: f.website || undefined, ...matrix } })
      : await $fetch<any>('/api/accounts', { method: 'POST', body: { ...f, ...matrix } })
    toast.toon(`${res.naam} staat erbij.`)
    emit('aangemaakt', res.id)
  } catch (e: any) {
    if (e?.statusCode === 409 && e?.data?.data?.match) dubbel.value = e.data.data
    else toast.toon(foutTekst(e), 'fout')
  } finally { bezig.value = false }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fo-overlay" @click.self="emit('sluit')">
      <form class="fo-panel fo-panel--smal" role="dialog" aria-modal="true" aria-labelledby="np-titel" data-test="nieuwe-prospect-flyout" @submit.prevent="maak">
        <header class="fo-head">
          <div class="fo-head-tekst"><span class="fo-kicker">Nieuwe prospect</span><h2 id="np-titel" class="fo-titel">Wie ga je erbij zetten?</h2></div>
          <button type="button" class="fo-sluit" aria-label="Sluiten" @click="emit('sluit')"><Icoon naam="X" /></button>
        </header>
        <div class="fo-body fo-body--formulier">
          <article class="fo-blok">
            <label class="veld"><span class="veld-label">Bedrijfsnaam <span class="veld-verplicht">*</span></span><input v-model="f.naam" class="invoer" required autofocus data-test="np-naam"></label>
            <div v-if="kvkStand.gekoppeld" class="rijtje mt-8">
              <button type="button" class="dd-act" :disabled="f.naam.trim().length < 2 || kvk.bezig" data-test="np-zoek-kvk" @click="zoekKvk">Zoek in KvK</button>
              <span v-if="kvk.gekozen" class="meta" data-test="np-kvk-gekozen">KvK {{ kvk.gekozen.kvk }} · SBI {{ kvk.gekozen.sbi.map((s: any) => s.code).join(', ') }}<template v-if="kvk.gekozen.medewerkers != null"> · {{ kvk.gekozen.medewerkers }} medewerkers</template></span>
            </div>
            <p v-if="kvk.fout" class="veld-fout mt-8" role="alert">{{ kvk.fout }}</p>
            <ul v-if="kvk.open && kvk.resultaten.length" class="lijst mt-8" data-test="np-kvk-resultaten">
              <li v-for="r in kvk.resultaten" :key="r.kvk" class="rij rij--compact">
                <div class="rij-info"><span class="rij-titel">{{ r.naam }}</span><div class="rij-sub">{{ r.plaats }} · KvK {{ r.kvk }}<template v-if="r.alBekend"> · Al in je bestand</template></div></div>
                <div class="rij-rechts"><button type="button" class="dd-act" :data-kvk="r.kvk" @click="kiesKvk(r)">{{ r.alBekend ? 'Open kaart' : 'Kies' }}</button></div>
              </li>
            </ul>
            <div v-if="dubbel" class="kaart kaart--geel mt-16" role="status" data-test="dubbelcheck">
              <p>Bedoel je <strong>{{ dubbel.match.name }}</strong><template v-if="dubbel.match.city"> in {{ dubbel.match.city }}</template>? {{ dubbel.soort === 'zeker' ? 'Al in je bestand.' : 'Lijkt erop.' }}</p>
              <button type="button" class="dd-act mt-16" data-test="np-bestaand" @click="emit('bestaand', dubbel.match.id)">Open {{ dubbel.match.name }}</button>
            </div>
            <div class="formulier-raster mt-16">
              <label class="veld"><span class="veld-label">Plaats</span><input v-model="f.plaats" class="invoer" data-test="np-plaats"></label>
              <label class="veld"><span class="veld-label">Telefoon</span><input v-model="f.telefoon" class="invoer" type="tel"></label>
              <label class="veld"><span class="veld-label">Website</span><input v-model="f.website" class="invoer" placeholder="https://"></label>
            </div>
          </article>
          <article v-if="uitgebreid" class="fo-blok" data-test="np-matrix">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Plek in de matrix</h3></header>
            <p class="meta np-uitleg">Deze gegevens bepalen klasse, potentie, regio en doelgroep, en daarmee het ritme en de eerste stap van de motor.</p>
            <div class="formulier-raster">
              <label v-if="context.branches.length" class="veld"><span class="veld-label">Branche</span>
                <select v-model="f.vvBrancheId" class="invoer" data-test="np-branche"><option value="">Nog niet bekend</option><option v-for="b in context.branches" :key="b.id" :value="b.id">{{ b.naam }}{{ b.focus === 'primair' ? ' (focus)' : '' }}</option></select>
              </label>
              <label class="veld"><span class="veld-label">Aantal medewerkers</span><input v-model="f.medewerkers" class="invoer" type="number" min="0" step="1" inputmode="numeric" data-test="np-medewerkers"></label>
              <label class="veld"><span class="veld-label">Postcode</span><input v-model="f.postcode" class="invoer" placeholder="1234 AB" data-test="np-postcode"></label>
              <label v-if="kanKlasse" class="veld"><span class="veld-label">Klasse</span>
                <select v-model="f.klasse" class="invoer" data-test="np-klasse">
                  <option value="">{{ klasseVoorstel ? `Uit medewerkers: ${klasseNaam(klasseVoorstel)}` : 'Uit het aantal medewerkers' }}</option>
                  <option v-for="k in klassen" :key="k.id" :value="k.id">{{ k.naam }}</option>
                </select>
              </label>
              <label v-if="kanLeverancier" class="veld"><span class="veld-label">Huidige leverancier</span>
                <select v-model="f.huidigeLeverancierId" class="invoer" data-test="np-leverancier"><option value="">Onbekend</option><option v-for="c in context.concurrenten" :key="c.id" :value="c.id">{{ c.naam }}</option></select>
              </label>
            </div>
            <dl class="np-plek" data-test="np-plek">
              <div class="np-plek-item"><dt>Klasse</dt><dd data-test="np-plek-klasse">{{ klasseNaam(klasseId) ?? 'Nog geen' }}<span v-if="klasseId && !f.klasse" class="meta"> uit medewerkers</span></dd></div>
              <div class="np-plek-item"><dt>Potentie</dt><dd>{{ potentie ? POTENTIE_LABEL[potentie] : 'Buiten de planning' }}</dd></div>
              <div class="np-plek-item"><dt>Regio</dt><dd data-test="np-plek-regio">{{ regio?.naam ?? 'Geen regio' }}</dd></div>
              <div class="np-plek-item"><dt>Doelgroep</dt><dd>{{ doelgroep?.naam ?? 'Standaardreis' }}</dd></div>
            </dl>
          </article>
          <article v-if="uitgebreid" class="fo-blok">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Meer gegevens</h3></header>
            <div class="formulier-raster">
              <label class="veld"><span class="veld-label">Adres</span><input v-model="f.adres" class="invoer"></label>
              <label class="veld"><span class="veld-label">LinkedIn</span><input v-model="f.linkedin" class="invoer"></label>
            </div>
            <div v-if="eigenVelden.length" class="formulier-raster mt-16">
              <EigenVeldInvoer v-for="v in eigenVelden" :key="v.sleutel" v-model="f.customFields[v.sleutel]" :veld="v" />
            </div>
          </article>
        </div>
        <footer class="fo-foot dd-acties">
          <button type="submit" class="dd-act dd-act--primair" :disabled="bezig || !f.naam.trim() || dubbel?.soort === 'zeker'" data-test="np-maak">Prospect aanmaken</button>
          <span class="dd-acties-vul fo-foot-vul" />
          <button type="button" class="dd-act" @click="emit('sluit')">Annuleren</button>
        </footer>
      </form>
    </div>
  </Teleport>
</template>

<style scoped>
.np-uitleg { margin: 0 0 12px; }
.np-plek { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; margin: 16px 0 0; padding: 12px; background: var(--surface); border: 1px solid var(--border); }
.np-plek-item { min-width: 0; }
.np-plek dt { color: var(--muted); font-size: 10px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }
.np-plek dd { margin: 2px 0 0; overflow-wrap: anywhere; font-size: 13px; font-weight: 600; }
</style>
