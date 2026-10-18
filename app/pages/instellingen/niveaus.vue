<script setup lang="ts">
// Niveaus (6.1, B18). De beheerder kiest het standaardniveau voor nieuwe gebruikers, "Iedereen ziet alles"
// (alles uit het pakket aan, nooit boven pakket of rol) en zet per functie en niveau aan of uit voor de hele
// organisatie (FunctiesPerNiveau, standaard de indeling van Dealtrace met Terug naar de standaard). Filters
// (onderdeel, niveau, alleen afwijkend) staan in de link. Daaronder "Wie mag wat" per rol.
import { NIVEAUS, NIVEAU_LABEL, type Niveau } from '~~/shared/types'
import type { NiveauOverzicht } from '~~/shared/niveauOverzicht'
const { me, laad } = useMe()
if (me.value?.gebruiker.rol !== 'beheerder') throw createError({ statusCode: 403, statusMessage: 'Alleen de beheerder' })
const route = useRoute()
const router = useRouter()
const { data: inst } = await useFetch<Record<string, any>>('/api/settings', { default: () => ({}) })
const { data: overzicht, refresh: herlaadOverzicht } = await useFetch<NiveauOverzicht & { rechten: any }>('/api/instellingen/niveaus')
const n = reactive({ iedereenAlles: false, standaardNiveauNieuweGebruiker: 'beginner', ...(inst.value.niveaus ?? {}) })
const { status, wijzig } = useAutoBewaar(async (value) => {
  await $fetch('/api/settings/niveaus', { method: 'PUT', body: { value } })
  await laad()
  await herlaadOverzicht()
})
watch(n, (v) => wijzig({ ...v }), { deep: true })

// Filters in de link: ?groep=...&niveau=expert&afwijkend=1
const q = (k: string) => (typeof route.query[k] === 'string' ? (route.query[k] as string) : '')
const filter = reactive({ groep: q('groep'), niveau: ((NIVEAUS as readonly string[]).includes(q('niveau')) ? q('niveau') : '') as Niveau | '', afwijkend: q('afwijkend') === '1' })
watch(filter, (f) => {
  const query = { ...route.query, groep: f.groep || undefined, niveau: f.niveau || undefined, afwijkend: f.afwijkend ? '1' : undefined }
  router.replace({ query })
}, { deep: true })
const aantalFilters = computed(() => (filter.groep ? 1 : 0) + (filter.niveau ? 1 : 0) + (filter.afwijkend ? 1 : 0))
const groepNamen = computed(() => overzicht.value?.groepen.map((g) => g.groep) ?? [])
function wis() { filter.groep = ''; filter.niveau = ''; filter.afwijkend = false }
function bijgewerkt(o: NiveauOverzicht) { if (overzicht.value) overzicht.value = { ...o, rechten: overzicht.value.rechten } }

const titel = computed(() => (n.iedereenAlles ? 'Iedereen ziet alles uit het pakket' : `Nieuwe gebruikers starten als ${NIVEAU_LABEL[n.standaardNiveauNieuweGebruiker as Niveau]}`))
const uitleg = computed(() => {
  const k = overzicht.value?.keuzes ?? 0
  return `Niveaus en functies: een niveau bepaalt welke functies voor iemand aanstaan. ${k ? (k === 1 ? '1 keuze wijkt af van de standaard.' : `${k} keuzes wijken af van de standaard.`) : 'Jullie volgen de standaard van Dealtrace.'}`
})
useHead({ title: 'Niveaus · Instellingen · Dealtrace' })
</script>

<template>
  <div>
    <InstellingenKop groep="Organisatie" :titel="titel" :uitleg="uitleg" helpartikel="niveau-en-functies" :filters="overzicht ? aantalFilters : null" @reset="wis">
      <template #filters>
        <div class="ifp-groep" role="group" aria-label="Niveau"><span class="filter-label">Niveau</span>
          <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': !filter.niveau }" :aria-pressed="!filter.niveau" @click="filter.niveau = ''">Alle niveaus</button>
          <button v-for="niv in NIVEAUS" :key="niv" type="button" class="filter-pil" :class="{ 'filter-pil--aan': filter.niveau === niv }" :aria-pressed="filter.niveau === niv" :data-test="`niveau-filter-${niv}`" @click="filter.niveau = niv">{{ NIVEAU_LABEL[niv] }}</button>
        </div>
        <div class="ifp-groep" role="group" aria-label="Stand"><span class="filter-label">Stand</span>
          <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': !filter.afwijkend }" :aria-pressed="!filter.afwijkend" @click="filter.afwijkend = false">Alles</button>
          <button type="button" class="filter-pil" :class="{ 'filter-pil--aan': filter.afwijkend }" :aria-pressed="filter.afwijkend" data-test="niveau-filter-afwijkend" @click="filter.afwijkend = true">Alleen afwijkend van de standaard</button>
        </div>
        <div class="ifp-groep"><label class="filter-label" for="niveau-groep">Onderdeel</label>
          <select id="niveau-groep" v-model="filter.groep" class="invoer niv-groep" data-test="niveau-filter-groep">
            <option value="">Alle onderdelen</option>
            <option v-for="g in groepNamen" :key="g" :value="g">{{ g }}</option>
          </select>
        </div>
      </template>
    </InstellingenKop>
    <section class="section section--laatste">
      <div class="container">
        <article class="kaart">
          <header class="kaart-kop"><h2 class="kaart-titel">Voor je organisatie</h2><OpslagStatus :status="status" test="bewaar-niveaus" /></header>
          <div class="schakel-rij">
            <div><span class="schakel-naam">Iedereen ziet alles</span><span class="veld-uitleg">Zet alles uit je pakket aan voor iedereen, los van het niveau. Rollen blijven gelden.</span></div>
            <Schakelaar :aan="n.iedereenAlles" label="Iedereen ziet alles" data-test="iedereen-alles" @wissel="n.iedereenAlles = $event" />
          </div>
          <div class="veld mt-16"><span class="veld-label">Standaardniveau voor nieuwe gebruikers</span>
            <div class="keuzegroep" role="group" aria-label="Standaardniveau">
              <button v-for="niv in NIVEAUS" :key="niv" type="button" class="keuzegroep-knop" :class="{ 'keuzegroep-knop--aan': n.standaardNiveauNieuweGebruiker === niv }" :aria-pressed="n.standaardNiveauNieuweGebruiker === niv" @click="n.standaardNiveauNieuweGebruiker = niv">{{ NIVEAU_LABEL[niv] }}</button>
            </div>
          </div>
          <p class="veld-uitleg mt-16">Welke functies bij Beginner, Gevorderd en Expert aanstaan, zet je hieronder. Het niveau per persoon zet je bij <FunctieLink als-tekst to="/instellingen/gebruikers">Gebruikers</FunctieLink>.</p>
        </article>
        <FunctiesPerNiveau v-if="overzicht" class="mt-16" :overzicht="overzicht" :groep="filter.groep" :niveau="filter.niveau" :afwijkend="filter.afwijkend" @bijgewerkt="bijgewerkt" @wis-filters="wis" />
        <WieMagWat v-if="overzicht" class="mt-16" :rechten="overzicht.rechten" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.niv-groep { min-height: var(--knop-h-compact); max-width: 100%; width: auto; }
@media (max-width: 719px) { .niv-groep { width: 100%; min-height: var(--touch-target-min); } }
</style>
