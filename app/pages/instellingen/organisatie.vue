<script setup lang="ts">
// Organisatie en werkdagen (F22). Elk veld bewaart zichzelf na 600 ms.
const toast = useToast()
const { me } = useMe()
if (me.value?.gebruiker.rol !== 'beheerder') throw createError({ statusCode: 403, statusMessage: 'Alleen de beheerder' })
const { data: inst } = await useFetch<Record<string, any>>('/api/settings', { default: () => ({}) })
const org = reactive({ naam: '', land: 'NL', verkoopjaarStartmaand: 1, ...(inst.value.organisatie ?? {}) })
const werk = reactive({ werkdagen: [1, 2, 3, 4, 5], bevrijdingsdag: 'lustrum', ...(inst.value.werkdagen ?? {}) })

const bewaar = (key: string) => (value: unknown) => $fetch(`/api/settings/${key}`, { method: 'PUT', body: { value } })
const orgBewaar = useAutoBewaar(bewaar('organisatie'))
const werkBewaar = useAutoBewaar(bewaar('werkdagen'))
watch(org, (v) => { if (!v.naam.trim()) { toast.toon('Naam is verplicht', 'fout'); return } orgBewaar.wijzig({ ...v }) }, { deep: true })
watch(werk, (v) => werkBewaar.wijzig({ ...v, werkdagen: [...v.werkdagen] }), { deep: true })

// P31: spraak (opnames bewaren, browserherkenning) en meldingsregels (dagplafond, stilte) per organisatie.
const spraak = reactive({ opnamesBewaren: false, bewaartermijnDagen: 90, browserherkenning: false, ...(inst.value.spraak ?? {}) })
const regels = reactive({ dagplafond: 6, stilVan: 19, stilTot: 7, weekendStil: true, ...(inst.value.meldingsregels ?? {}) })
const spraakBewaar = useAutoBewaar(bewaar('spraak'))
const regelsBewaar = useAutoBewaar(bewaar('meldingsregels'))
watch(spraak, (v) => spraakBewaar.wijzig({ ...v }), { deep: true })
watch(regels, (v) => regelsBewaar.wijzig({ ...v }), { deep: true })

const DAGEN = [{ n: 1, l: 'Ma' }, { n: 2, l: 'Di' }, { n: 3, l: 'Wo' }, { n: 4, l: 'Do' }, { n: 5, l: 'Vr' }, { n: 6, l: 'Za' }, { n: 0, l: 'Zo' }]
const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']
function wisselDag(n: number) {
  werk.werkdagen = werk.werkdagen.includes(n) ? werk.werkdagen.filter((d: number) => d !== n) : [...werk.werkdagen, n].sort()
}
useHead({ title: 'Organisatie · Instellingen · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Instellingen · Organisatie" titel="Organisatie" uitleg="Wijzigingen bewaren zichzelf." helpartikel="instellingen-organisatie" />
    <section class="section">
      <div class="container">
        <article class="kaart">
          <header class="kaart-kop"><h2 class="kaart-titel">Gegevens</h2><span class="bewaar-status" :class="{ 'bewaar-status--fout': orgBewaar.status.value === 'Opslaan mislukt' }" data-test="bewaar-organisatie" aria-live="polite">{{ orgBewaar.status.value }}</span></header>
          <div class="formulier-raster">
            <label class="veld"><span class="veld-label">Naam <span class="veld-verplicht">*</span></span><input v-model="org.naam" class="invoer" data-test="org-naam"></label>
            <label class="veld"><span class="veld-label">Land</span>
              <select v-model="org.land" class="invoer"><option value="NL">Nederland</option><option value="BE">België</option></select>
            </label>
            <label class="veld"><span class="veld-label">Verkoopjaar begint in</span>
              <select v-model.number="org.verkoopjaarStartmaand" class="invoer"><option v-for="(m, i) in MAANDEN" :key="m" :value="i + 1">{{ m }}</option></select>
            </label>
          </div>
        </article>
      </div>
    </section>
    <section id="werkdagen" class="section">
      <div class="container">
        <article class="kaart">
          <header class="kaart-kop"><h2 class="kaart-titel">Werkdagen en feestdagen</h2><span class="bewaar-status" :class="{ 'bewaar-status--fout': werkBewaar.status.value === 'Opslaan mislukt' }" aria-live="polite">{{ werkBewaar.status.value }}</span></header>
          <div class="veld"><span class="veld-label">Werkdagen</span>
            <div class="keuzegroep" role="group" aria-label="Werkdagen">
              <button v-for="d in DAGEN" :key="d.n" type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': werk.werkdagen.includes(d.n) }" :aria-pressed="werk.werkdagen.includes(d.n)" @click="wisselDag(d.n)">{{ d.l }}</button>
            </div>
          </div>
          <label class="veld mt-16"><span class="veld-label">Bevrijdingsdag</span>
            <select v-model="werk.bevrijdingsdag" class="invoer">
              <option value="lustrum">Vrij in lustrumjaren</option><option value="altijd">Altijd vrij</option><option value="nooit">Nooit vrij</option>
            </select>
            <span class="veld-uitleg">De overige Nederlandse feestdagen telt Dealtrace altijd als vrije dag.</span>
          </label>
        </article>
      </div>
    </section>
    <section id="spraak" class="section section--laatste">
      <div class="container raster raster--2">
        <article class="kaart" data-test="org-spraak">
          <header class="kaart-kop"><h2 class="kaart-titel">Spraak</h2><span class="bewaar-status" aria-live="polite">{{ spraakBewaar.status.value }}</span></header>
          <p class="kaart-meta">Opnames gaan alleen naar een transcriptiedienst in de EU. Na de transcriptie verdwijnt de opname, tenzij je hieronder bewaren aanzet. Transcripten blijven twaalf maanden.</p>
          <p class="schakel-rij"><span>Opnames bewaren</span><Schakelaar :aan="spraak.opnamesBewaren" label="Opnames bewaren" @wissel="spraak.opnamesBewaren = $event" /></p>
          <label v-if="spraak.opnamesBewaren" class="veld"><span class="veld-label">Bewaartermijn (dagen)</span><input v-model.number="spraak.bewaartermijnDagen" type="number" min="1" max="365" class="invoer"></label>
          <p class="schakel-rij"><span>Snelle voorvertoning in de browser</span><Schakelaar :aan="spraak.browserherkenning" label="Snelle voorvertoning in de browser" @wissel="spraak.browserherkenning = $event" /></p>
          <p class="veld-uitleg">Staat standaard uit. In Chrome loopt de voorvertoning via Google, buiten de EU.</p>
        </article>
        <article class="kaart" data-test="org-meldingsregels">
          <header class="kaart-kop"><h2 class="kaart-titel">Meldingen voor onderweg</h2><span class="bewaar-status" aria-live="polite">{{ regelsBewaar.status.value }}</span></header>
          <div class="formulier-raster">
            <label class="veld"><span class="veld-label">Dagplafond</span><input v-model.number="regels.dagplafond" type="number" min="0" max="20" class="invoer"></label>
            <label class="veld"><span class="veld-label">Stil vanaf</span><select v-model.number="regels.stilVan" class="invoer"><option v-for="h in 24" :key="h" :value="h - 1">{{ String(h - 1).padStart(2, '0') }}:00</option></select></label>
            <label class="veld"><span class="veld-label">Stil tot</span><select v-model.number="regels.stilTot" class="invoer"><option v-for="h in 24" :key="h" :value="h - 1">{{ String(h - 1).padStart(2, '0') }}:00</option></select></label>
          </div>
          <p class="schakel-rij"><span>Stil in het weekend</span><Schakelaar :aan="regels.weekendStil" label="Stil in het weekend" @wissel="regels.weekendStil = $event" /></p>
        </article>
      </div>
    </section>
  </div>
</template>
