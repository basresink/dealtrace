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
    <section id="werkdagen" class="section section--laatste">
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
  </div>
</template>
