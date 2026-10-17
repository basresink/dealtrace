<script setup lang="ts">
// Eigen velden (F19, beheerder): per object de secties en velden, de veldflyout,
// archiveren in plaats van verwijderen, en voorstellen van Experts.
import { NIVEAU_LABEL, type Niveau } from '~~/shared/types'
import { VELDTYPEN, VELDTYPE_LABEL, VELD_OBJECTEN, cfVariabele, sleutelUitNaam } from '~~/shared/eigenVelden'
const { functie } = useMe()
if (!functie('eigenVelden.beheren')?.beschikbaar) throw createError({ statusCode: 403, statusMessage: 'Alleen de beheerder' })
const toast = useToast()
const object = ref<typeof VELD_OBJECTEN[number]>('account')
const { data, refresh } = await useFetch<any>('/api/eigen-velden', { query: { object }, default: () => ({ velden: [], voorstellen: [] }) })
const SECTIES: Record<string, string[]> = { account: ['Adres', 'Bereik', 'Stamgegevens', 'Kwalificatie', 'Contract en order'], contact: ['Stamgegevens', 'Bereik'], campagne: ['Stamgegevens'], afspraak: ['Stamgegevens'] }
const OBJECT_LABEL: Record<string, string> = { account: 'Account', contact: 'Contact', campagne: 'Campagne', afspraak: 'Afspraak' }
const secties = computed(() => {
  const namen = [...new Set([...SECTIES[object.value]!, ...data.value.velden.map((v: any) => v.sectie)])]
  return namen.map((n) => ({ naam: n, velden: data.value.velden.filter((v: any) => v.sectie === n) }))
})
const leeg = () => ({ id: '', naam: '', sleutel: '', type: 'tekst', sectie: SECTIES[object.value]![0], volgorde: 0, data: { opties: [] as any[], verplicht: 'nee', hulp: '', zichtbaarVanaf: 'beginner', bewerkbaarDoor: 'iedereen', filterbaar: false, bron: 'handmatig', toonInKop: false, datakwaliteit: false } })
const veld = ref<any>(null)
const nieuweSectie = ref('')
function open(v?: any) { veld.value = v ? JSON.parse(JSON.stringify({ ...v, data: { opties: [], ...v.data } })) : leeg() }
const sleutelVoorbeeld = computed(() => veld.value && !veld.value.id ? sleutelUitNaam(veld.value.naam || 'veld', data.value.velden.map((v: any) => v.sleutel)) : veld.value?.sleutel)
async function bewaar() {
  const v = veld.value
  try {
    if (v.id) await $fetch(`/api/eigen-velden/${v.id}`, { method: 'PUT', body: v })
    else await $fetch('/api/eigen-velden', { method: 'POST', body: { ...v, object: object.value } })
    toast.toon(`${v.naam} is opgeslagen.`); veld.value = null; await refresh()
  } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const archiveer = ref<any>(null)
async function doeArchiveer() {
  const v = archiveer.value; archiveer.value = null
  try { await $fetch(`/api/eigen-velden/${v.id}/archiveer`, { method: 'POST', body: { gearchiveerd: !v.gearchiveerd } }); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
function overnemen(vs: any) { open(); veld.value.naam = vs.data.naam; veld.value.type = vs.data.type }
useHead({ title: 'Eigen velden · Instellingen · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Instellingen · Eigen velden" titel="Eigen velden" uitleg="Velden die jullie zelf nodig hebben, bovenop de standaard." helpartikel="eigen-velden">
      <template #acties><button type="button" class="dd-actie dd-actie--primair" data-test="veld-nieuw" @click="open()"><Icoon naam="Plus" class="dd-actie-icoon" />Veld</button></template>
    </PaginaKop>
    <section class="section section--laatste">
      <div class="container">
        <p class="alleen-groot-melding kaart kaart--geel">Beter op een groot scherm.</p>
        <nav class="tabbalk" aria-label="Objecten"><button v-for="o in VELD_OBJECTEN" :key="o" type="button" class="tab" :class="{ 'tab--actief': object === o }" @click="object = o">{{ OBJECT_LABEL[o] }}</button></nav>
        <div v-if="data.voorstellen.length" class="kaart kaart--geel mt-16"><span class="veld-label">Voorstellen</span>
          <ul class="schakel-lijst"><li v-for="vs in data.voorstellen" :key="vs.id" class="schakel-rij"><span>{{ vs.data.naam }} ({{ VELDTYPE_LABEL[vs.data.type as keyof typeof VELDTYPE_LABEL] }}) · {{ vs.data.doorNaam }}: {{ vs.data.reden }}</span><button type="button" class="dd-act" @click="overnemen(vs)">Overnemen</button></li></ul>
        </div>
        <div v-for="s in secties" :key="s.naam" class="mt-16 kaart">
          <header class="kaart-kop"><h2 class="kaart-titel">{{ s.naam }}</h2><span class="meta">{{ s.velden.length }} velden</span></header>
          <p v-if="!s.velden.length" class="kaart-meta">Nog geen eigen velden in deze sectie.</p>
          <table v-else class="tabel tabel--kaarten" data-test="velden-tabel">
            <thead><tr><th>Naam</th><th>Type</th><th>Zichtbaar voor</th><th>Filterbaar</th><th v-if="object === 'account' || object === 'contact'">Datakwaliteit</th><th>Ingevuld</th><th><span class="sr-only">Acties</span></th></tr></thead>
            <tbody><tr v-for="v in s.velden" :key="v.id" :class="{ 'contact-vertrokken': v.gearchiveerd }">
              <td><strong>{{ v.naam }}</strong><br><span class="meta">{{ cfVariabele(v.sleutel) }}</span></td>
              <td>{{ VELDTYPE_LABEL[v.type as keyof typeof VELDTYPE_LABEL] }}</td>
              <td>{{ v.data.zichtbaarVanaf === 'beginner' ? 'Alle niveaus' : `Vanaf ${NIVEAU_LABEL[v.data.zichtbaarVanaf as Niveau]}` }}</td>
              <td>{{ v.data.filterbaar ? 'Ja' : 'Nee' }}</td>
              <td v-if="object === 'account' || object === 'contact'" data-test="ev-dk-kolom">{{ v.data.datakwaliteit ? 'Telt mee' : 'Nee' }}</td>
              <td class="tnum">{{ v.ingevuld }}</td>
              <td><div class="dd-acties"><button type="button" class="dd-act" @click="open(v)">Wijzigen</button><button type="button" class="dd-act" @click="archiveer = v">{{ v.gearchiveerd ? 'Terugzetten' : 'Archiveren' }}</button></div></td>
            </tr></tbody>
          </table>
        </div>
        <form class="kaart mt-16 formulier-raster" @submit.prevent="SECTIES[object]!.push(nieuweSectie); nieuweSectie = ''">
          <label class="veld"><span class="veld-label">Nieuwe sectie</span><input v-model="nieuweSectie" class="invoer"></label>
          <button type="submit" class="dd-act" :disabled="!nieuweSectie.trim()">+ Sectie</button>
        </form>
      </div>
    </section>

    <FlyoutShell v-if="veld" open titel-id="ev-titel" breedte="smal" data-test="veld-flyout" @sluit="veld = null">
        <template #kop><span class="fo-kicker">{{ OBJECT_LABEL[object] }}</span><h2 id="ev-titel" class="fo-titel">{{ veld.id ? veld.naam : 'Nieuw veld' }}</h2></template>
        <form id="ev-form" class="fs-form" @submit.prevent="bewaar">
          <div class="fo-body fo-body--formulier"><article class="fo-blok">
            <label class="veld"><span class="veld-label">Naam <span class="veld-verplicht">*</span></span><input v-model="veld.naam" class="invoer" required data-test="ev-naam"><span class="veld-uitleg">Sleutel: {{ sleutelVoorbeeld }}{{ veld.id ? ' (vast)' : '' }}</span></label>
            <div class="formulier-raster mt-16">
              <label class="veld"><span class="veld-label">Type</span><select v-model="veld.type" class="invoer" data-test="ev-type"><option v-for="t in VELDTYPEN" :key="t" :value="t">{{ VELDTYPE_LABEL[t] }}</option></select></label>
              <label class="veld"><span class="veld-label">Sectie</span><select v-model="veld.sectie" class="invoer"><option v-for="s in secties" :key="s.naam" :value="s.naam">{{ s.naam }}</option></select></label>
              <label class="veld"><span class="veld-label">Zichtbaar voor</span><select v-model="veld.data.zichtbaarVanaf" class="invoer" data-test="ev-zichtbaar"><option value="beginner">Alle niveaus</option><option value="gevorderd">Vanaf Gevorderd</option><option value="expert">Vanaf Expert</option></select></label>
              <label class="veld"><span class="veld-label">Bewerkbaar door</span><select v-model="veld.data.bewerkbaarDoor" class="invoer"><option value="iedereen">Iedereen</option><option value="eigenaarEnManager">Eigenaar en manager</option><option value="beheerder">Alleen beheerder</option></select></label>
              <label class="veld"><span class="veld-label">Verplicht</span><select v-model="veld.data.verplicht" class="invoer"><option value="nee">Nee</option><option value="bijAanmaken">Bij aanmaken</option><option value="bijFase">Bij een fase</option></select></label>
              <label class="veld"><span class="veld-label">Bron</span><select v-model="veld.data.bron" class="invoer"><option value="handmatig">Handmatig</option><option value="import">Import</option><option value="kvk">KvK</option><option value="datacollectief">Datacollectief</option><option value="crm">CRM-veld</option></select></label>
            </div>
            <div v-if="['keuzelijst', 'meerkeuze'].includes(veld.type)" class="mt-16"><span class="veld-label">Opties</span>
              <div v-for="(o, i) in veld.data.opties" :key="i" class="formulier-raster"><input v-model="o.label" class="invoer" placeholder="Label" @input="o.waarde = o.waarde || sleutelUitNaam(o.label)"><button type="button" class="dd-act" @click="veld.data.opties.splice(i, 1)">Weg</button></div>
              <button type="button" class="dd-act mt-8" data-test="ev-optie" @click="veld.data.opties.push({ waarde: '', label: '' })">+ Optie</button>
            </div>
            <label class="veld mt-16"><span class="veld-label">Hulptekst</span><input v-model="veld.data.hulp" class="invoer"></label>
            <div class="schakel-rij mt-16"><span class="schakel-naam">Filterbaar</span><Schakelaar :aan="veld.data.filterbaar" label="Filterbaar" data-test="ev-filterbaar" @wissel="veld.data.filterbaar = $event" /></div>
            <div class="schakel-rij"><span class="schakel-naam">Toon in kop</span><Schakelaar :aan="veld.data.toonInKop" label="Toon in kop" @wissel="veld.data.toonInKop = $event" /></div>
            <div v-if="object === 'account' || object === 'contact'" class="schakel-rij">
              <span class="ev-dk-tekst"><span class="schakel-naam">Meenemen in Datakwaliteit</span><span class="veld-uitleg">Een leeg veld telt als gat: op Datakwaliteit komt de controle "Zonder {{ veld.naam || 'dit veld' }}" voor de {{ object === 'contact' ? 'contacten' : 'prospects' }}.</span></span>
              <Schakelaar :aan="!!veld.data.datakwaliteit" label="Meenemen in Datakwaliteit" data-test="ev-datakwaliteit" @wissel="veld.data.datakwaliteit = $event" />
            </div>
          </article></div>
        </form>
        <template #voet>
          <footer class="fo-foot fs-voet">
          <button type="submit" form="ev-form" class="dd-actie dd-actie--zwart fs-hoofdactie" data-test="ev-bewaar"><Icoon naam="Check" :grootte="16" />Veld opslaan</button>
          <span class="fo-foot-vul" />
        </footer>
        </template>
      </FlyoutShell>
    <BevestigVenster :open="!!archiveer" :titel="archiveer?.gearchiveerd ? 'Veld terugzetten' : 'Veld archiveren'" :tekst="archiveer?.gearchiveerd ? 'Het veld is weer zichtbaar.' : `Archiveren verbergt het veld; de ${archiveer?.ingevuld ?? 0} ingevulde waarden blijven bewaard.`" :bevestig="archiveer?.gearchiveerd ? 'Terugzetten' : 'Archiveren'" @geannuleerd="archiveer = null" @bevestigd="doeArchiveer" />
  </div>
</template>

<style scoped>
.ev-dk-tekst { display: flex; flex: 1; flex-direction: column; gap: 2px; min-width: 0; }
</style>
