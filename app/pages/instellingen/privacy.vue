<script setup lang="ts">
// Privacy en bewaartermijnen (F22 Data en AI, bouwplan 15.2) voor de beheerder: zelf gekozen bewaartermijnen
// met uitleg in gewone taal, wat er bij de volgende opschoning zou vervallen (alleen tellen), de vaste
// termijnen van Dealtrace, de verwerkers en de export van de hele organisatie als zip.
import { BEWAAR_SOORTEN, termijnTekst, VASTE_TERMIJNEN, VERWERKERS, type BewaarSoort, type Bewaartermijnen } from '~~/shared/privacy'

interface Verval { soort: BewaarSoort; naam: string; maanden: number | null; termijn: string; grens: string | null; aantal: number; oudste: string | null; zin: string }
interface Privacy {
  termijnen: Bewaartermijnen
  ingesteld: boolean
  bijgewerktOp: string | null
  verval: Verval[]
  opschoonjob: boolean
  spraak: { opnamesBewaren: boolean; bewaartermijnDagen: number }
  export: { onderdelen: { bestand: string; naam: string; rijen: number | null }[]; laatste: { op: string; door: string | null } | null }
}

const { me } = useMe()
if (me.value?.gebruiker.rol !== 'beheerder') throw createError({ statusCode: 403, statusMessage: 'Alleen de beheerder' })
const meekijken = computed(() => !!me.value?.werkIn)
const toast = useToast()
const { data: p, refresh } = await useFetch<Privacy>('/api/instellingen/privacy')
const keuze = reactive<Bewaartermijnen>({ ...(p.value?.termijnen ?? { activiteiten: 36, verslagen: 24, gedeactiveerdeProspects: 24, gearchiveerdeGebruikers: 12 }) })

const bewaar = useAutoBewaar(async (termijnen: Bewaartermijnen) => {
  p.value = await $fetch<Privacy>('/api/instellingen/privacy', { method: 'PUT', body: { termijnen } })
}, 300)
function kies(soort: BewaarSoort, waarde: string) {
  keuze[soort] = waarde === 'null' ? null : Number(waarde)
  bewaar.wijzig({ ...keuze })
}

const datum = (t?: string | null) => (t ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(t)) : '')
const vervalTotaal = computed(() => (p.value?.verval ?? []).reduce((s, v) => s + v.aantal, 0))
const exportRijen = computed(() => (p.value?.export.onderdelen ?? []).filter((o) => o.bestand.endsWith('.csv')).reduce((s, o) => s + (o.rijen ?? 0), 0))

const exporteren = ref(false)
async function exporteer() {
  if (exporteren.value) return
  exporteren.value = true
  try {
    const r = await fetch('/api/instellingen/export', { credentials: 'same-origin' })
    if (!r.ok) {
      const fout = await r.json().catch(() => null)
      throw new Error(fout?.statusMessage ?? fout?.message ?? 'De export is niet gelukt. Probeer het opnieuw.')
    }
    const naam = /filename="([^"]+)"/.exec(r.headers.get('content-disposition') ?? '')?.[1] ?? 'dealtrace-export.zip'
    const url = URL.createObjectURL(await r.blob())
    const a = document.createElement('a')
    a.href = url
    a.download = naam
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    toast.toon(`Export gedownload: ${naam}`)
    await refresh()
  } catch (e: any) {
    toast.toon(e?.message ?? foutTekst(e), 'fout')
  } finally {
    exporteren.value = false
  }
}
useHead({ title: 'Privacy · Instellingen · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Instellingen · Privacy" titel="Privacy en bewaartermijnen" uitleg="Hoe lang Dealtrace gegevens van je organisatie bewaart, en alles in één keer downloaden." helpartikel="privacy-bewaartermijnen-en-export" />
    <section v-if="p" class="section">
      <div class="container">
        <article class="kaart" data-test="privacy-termijnen">
          <header class="kaart-kop">
            <h2 class="kaart-titel">Bewaartermijnen die je zelf kiest</h2>
            <span class="bewaar-status" :class="{ 'bewaar-status--fout': bewaar.status.value === 'Opslaan mislukt' }" data-test="privacy-status" aria-live="polite">{{ bewaar.status.value }}</span>
          </header>
          <p class="kaart-meta">Kies per soort hoe lang je gegevens bewaart. Wat ouder is, vervalt bij de opschoning. Kies je "niet opschonen", dan blijft het staan zolang jullie Dealtrace gebruiken.</p>
          <div v-for="d in BEWAAR_SOORTEN" :key="d.soort" class="privacy-rij" :data-test="`termijn-${d.soort}`">
            <div class="privacy-rij-tekst">
              <h3 class="privacy-rij-titel">{{ d.naam }}</h3>
              <p class="veld-uitleg">{{ d.uitleg }}</p>
              <p class="veld-uitleg">Daarna: {{ d.gevolg }} De termijn telt vanaf {{ d.vanaf }}.</p>
            </div>
            <label class="veld privacy-rij-keuze">
              <span class="veld-label">Bewaren</span>
              <select class="invoer" :value="String(keuze[d.soort])" :disabled="meekijken" :data-test="`kies-${d.soort}`" @change="kies(d.soort, ($event.target as HTMLSelectElement).value)">
                <option v-for="k in d.keuzes" :key="String(k)" :value="String(k)">{{ termijnTekst(k) }}{{ k === d.standaard ? ' (standaard)' : '' }}</option>
              </select>
            </label>
          </div>
          <p v-if="p.bijgewerktOp" class="veld-uitleg mt-16">Laatst gewijzigd op {{ datum(p.bijgewerktOp) }}.</p>
        </article>

        <article class="kaart mt-16" data-test="privacy-verval">
          <header class="kaart-kop"><h2 class="kaart-titel">Wat vervalt bij de volgende opschoning</h2></header>
          <p class="kaart-meta" data-test="privacy-geen-job">
            <template v-if="!p.opschoonjob">Dealtrace schoont nog niet vanzelf op. Dit overzicht laat zien wat er met deze termijnen zou vervallen; er wordt nu niets verwijderd.</template>
            <template v-else>De opschoning draait elke nacht. Dit vervalt de eerstvolgende keer.</template>
          </p>
          <LegeStaat v-if="!vervalTotaal" titel="Er vervalt niets" tekst="Met deze termijnen is er niets oud genoeg om te vervallen." />
          <ul class="schakel-lijst">
            <li v-for="v in p.verval" :key="v.soort" class="schakel-rij" :data-test="`verval-${v.soort}`">
              <span>{{ v.zin }}<span v-if="v.grens" class="veld-uitleg">Alles van vóór {{ datum(v.grens) }}{{ v.oudste && v.aantal ? `; het oudste is van ${datum(v.oudste)}` : '' }}.</span></span>
              <span class="pil tnum" :class="v.aantal ? 'pil--geel' : 'pil--leeg'">{{ v.maanden === null ? 'blijft' : v.aantal }}</span>
            </li>
          </ul>
        </article>

        <article class="kaart mt-16" data-test="privacy-export">
          <header class="kaart-kop"><h2 class="kaart-titel">Exporteer de organisatie</h2></header>
          <p class="kaart-meta">Een zip met per onderdeel een CSV-bestand (puntkomma, opent in Excel) en een JSON-bestand met de instellingen. Alleen gegevens van jullie eigen organisatie, zonder inloggegevens, sleutels van koppelingen en bijlagen. Elke export staat in de audit.</p>
          <LegeStaat v-if="!exportRijen" titel="Nog bijna niets te exporteren" tekst="Er staan nog geen accounts, taken of activiteiten in Dealtrace. De export bevat dan vooral de instellingen." />
          <ul v-else class="schakel-lijst">
            <li v-for="o in p.export.onderdelen" :key="o.bestand" class="schakel-rij"><span>{{ o.naam }} <span class="veld-uitleg">{{ o.bestand }}</span></span><span class="tnum">{{ o.rijen === null ? '' : o.rijen }}</span></li>
          </ul>
          <p v-if="p.export.laatste" class="veld-uitleg" data-test="export-laatste">Laatste export op {{ datum(p.export.laatste.op) }}{{ p.export.laatste.door ? ` door ${p.export.laatste.door}` : '' }}.</p>
          <p v-if="meekijken" class="veld-uitleg">Je kijkt mee als Dealtrace. Een export van de organisatie maakt de beheerder van de klant zelf.</p>
          <div class="dd-acties mt-16">
            <button type="button" class="dd-actie dd-actie--primair" :disabled="exporteren || meekijken" data-test="exporteer-organisatie" @click="exporteer">
              <Icoon naam="Download" /> {{ exporteren ? 'Export maken…' : 'Exporteer organisatie' }}
            </button>
          </div>
        </article>
      </div>
    </section>

    <section v-if="p" class="section section--laatste">
      <div class="container">
        <article class="kaart" data-test="privacy-vast">
          <header class="kaart-kop"><h2 class="kaart-titel">Vaste termijnen van Dealtrace</h2></header>
          <p class="kaart-meta">Deze termijnen gelden voor iedere organisatie en wijzig je niet.</p>
          <div class="tabel-schuif">
            <table class="tabel mt-8">
              <thead><tr><th scope="col">Wat</th><th scope="col">Hoe lang</th><th scope="col">Daarna</th></tr></thead>
              <tbody><tr v-for="v in VASTE_TERMIJNEN" :key="v.onderwerp"><td>{{ v.onderwerp }}</td><td>{{ v.termijn }}</td><td>{{ v.gevolg }}</td></tr></tbody>
            </table>
          </div>
        </article>
        <div class="privacy-raster mt-16">
          <article class="kaart" data-test="privacy-spraak">
            <header class="kaart-kop"><h2 class="kaart-titel">Spraakopnames</h2></header>
            <p class="kaart-meta">{{ p.spraak.opnamesBewaren ? `Opnames blijven ${p.spraak.bewaartermijnDagen} dagen bewaard na de transcriptie.` : 'Opnames verdwijnen direct na de transcriptie.' }}</p>
            <NuxtLink to="/instellingen/organisatie#spraak" class="dd-act">Wijzig bij Organisatie</NuxtLink>
          </article>
          <article class="kaart">
            <header class="kaart-kop"><h2 class="kaart-titel">Verwerkers</h2></header>
            <dl class="gegevens">
              <template v-for="v in VERWERKERS" :key="v.wat"><dt>{{ v.wat }}</dt><dd>{{ v.waar }}</dd></template>
            </dl>
          </article>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.privacy-rij { display: grid; grid-template-columns: 1fr 200px; gap: 16px; align-items: start; padding: 14px 0; border-bottom: 1px solid var(--border); }
.privacy-rij:last-of-type { border-bottom: 0; }
.privacy-rij-titel { margin: 0 0 4px; font-size: var(--fs-body); font-weight: 600; }
.privacy-rij-tekst .veld-uitleg { display: block; margin: 0 0 2px; }
.privacy-rij-keuze .invoer { min-height: 44px; }
.privacy-raster { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--kaart-gap); }
.schakel-rij > span:first-child { min-width: 0; }
.schakel-rij .veld-uitleg { display: block; }
@media (max-width: 767px) {
  .privacy-rij { grid-template-columns: 1fr; gap: 8px; }
}
</style>
