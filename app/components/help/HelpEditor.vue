<script setup lang="ts">
// Editor voor een helpartikel (F21): titel, collectie, categorie, niveau, samenvatting, inhoud in Markdown
// (met afbeeldingen en een videolink), het scherm voor "Probeer het", controlevragen en de status. Voor de
// beheerder een eigen artikel, voor de founder een platformartikel. Op de telefoon "Beter op een groot scherm".
import { CATEGORIEEN_NEWBUSINESS, CATEGORIEEN_PRODUCT, NB_ONDERDELEN, controleerArtikel, type Controlevraag } from '~~/shared/help'
import { markdownNaarHtml } from '~~/shared/markdown'
import { NIVEAU_LABEL, NIVEAUS } from '~~/shared/types'
const props = defineProps<{ artikel?: any; bewaarUrl: string; methode: 'POST' | 'PUT'; platform?: boolean }>()
const emit = defineEmits<{ bewaard: [r: any]; sluit: [] }>()
const toast = useToast()
const f = reactive({
  titel: props.artikel?.titel ?? '', collectie: props.artikel?.collectie ?? 'newbusiness', categorie: props.artikel?.categorie ?? '', niveau: props.artikel?.niveau ?? '',
  samenvatting: props.artikel?.samenvatting ?? '', inhoud: props.artikel?.inhoud ?? NB_ONDERDELEN.map((k) => `## ${k}\n\n`).join(''),
  route: (props.artikel?.routes ?? [])[0] ?? '', vragen: structuredClone(toRaw(props.artikel?.vragen ?? [])) as Controlevraag[],
})
const categorieen = computed(() => (f.collectie === 'newbusiness' ? CATEGORIEEN_NEWBUSINESS : CATEGORIEEN_PRODUCT))
const voorbeeld = ref(false)
const html = computed(() => markdownNaarHtml(f.inhoud))
function nieuweVraag() { f.vragen.push({ vraag: '', opties: ['', '', ''], goed: 0 }) }
async function bewaar(status: 'concept' | 'gepubliceerd') {
  const body = { titel: f.titel, collectie: f.collectie, categorie: f.categorie, niveau: f.niveau || null, samenvatting: f.samenvatting, inhoud: f.inhoud, routes: f.route ? [f.route] : [], vragen: f.vragen.filter((v) => v.vraag.trim()).map((v) => ({ ...v, opties: v.opties.filter((o) => o.trim()) })), status }
  const fouten = controleerArtikel(body as any)
  if (fouten.length) { toast.toon(fouten[0]!, 'fout'); return }
  try { const r: any = await $fetch(props.bewaarUrl, { method: props.methode, body }); toast.toon(r.tekst); emit('bewaard', r) } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
</script>

<template>
  <article class="kaart" data-test="help-editor">
    <p class="alleen-groot-melding kaart kaart--geel">Beter op een groot scherm.</p>
    <div class="formulier-raster">
      <label class="veld"><span class="veld-label">Titel</span><input v-model="f.titel" class="invoer" data-test="he-titel"></label>
      <label class="veld"><span class="veld-label">Collectie</span><select v-model="f.collectie" class="invoer"><option value="product">Hoe werkt Dealtrace</option><option value="newbusiness">New business</option></select></label>
      <label class="veld"><span class="veld-label">Categorie</span><select v-model="f.categorie" class="invoer" data-test="he-categorie"><option value="" disabled>Kies</option><option v-for="c in categorieen" :key="c" :value="c">{{ c }}</option></select></label>
      <label class="veld"><span class="veld-label">Niveau</span><select v-model="f.niveau" class="invoer"><option value="">Iedereen</option><option v-for="n in NIVEAUS" :key="n" :value="n">{{ NIVEAU_LABEL[n] }}</option></select></label>
      <label class="veld"><span class="veld-label">Probeer het (scherm)</span><input v-model="f.route" class="invoer" placeholder="/belblokken"></label>
      <label class="veld"><span class="veld-label">Samenvatting</span><input v-model="f.samenvatting" class="invoer"></label>
    </div>
    <div class="dd-acties mt-16"><button type="button" class="filter-pil" :class="{ 'filter-pil--aan': !voorbeeld }" @click="voorbeeld = false">Schrijven</button><button type="button" class="filter-pil" :class="{ 'filter-pil--aan': voorbeeld }" @click="voorbeeld = true">Voorbeeld</button></div>
    <textarea v-if="!voorbeeld" v-model="f.inhoud" class="invoer he-inhoud mt-8" rows="16" aria-label="Inhoud in Markdown" data-test="he-inhoud" />
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div v-else class="help-tekst mt-8" v-html="html" />
    <p class="veld-uitleg">Markdown: ## voor een kop, - voor een opsomming, ![tekst](url) voor een afbeelding, een losse link naar een video. New business-artikelen hebben de koppen {{ NB_ONDERDELEN.join(', ') }}.</p>
    <h3 class="fo-blok-titel mt-16">Controlevragen</h3>
    <div v-for="(v, i) in f.vragen" :key="i" class="he-vraag mt-8">
      <input v-model="v.vraag" class="invoer" :placeholder="`Vraag ${i + 1}`">
      <label v-for="(_, j) in v.opties" :key="j" class="he-optie"><input v-model="v.goed" type="radio" :name="`he-goed-${i}`" :value="j" :aria-label="`Antwoord ${j + 1} is goed`"><input v-model="v.opties[j]" class="invoer" :placeholder="`Antwoord ${j + 1}`"></label>
      <button type="button" class="tekst-link" @click="f.vragen.splice(i, 1)">Weg</button>
    </div>
    <button v-if="f.vragen.length < 3" type="button" class="dd-act mt-8" @click="nieuweVraag">Vraag toevoegen</button>
    <div class="dd-acties mt-16">
      <button type="button" class="dd-act" data-test="he-concept" @click="bewaar('concept')">Opslaan als concept</button>
      <button type="button" class="dd-act dd-act--geel" data-test="he-publiceer" @click="bewaar('gepubliceerd')">Publiceer</button>
      <button type="button" class="dd-act" @click="emit('sluit')">Sluit</button>
    </div>
  </article>
</template>

<style scoped>
.he-inhoud { font-family: ui-monospace, monospace; font-size: 13px; }
.he-vraag { display: grid; gap: 6px; padding: 10px; border: 1px solid var(--border); border-radius: 8px; }
.he-optie { display: flex; gap: 8px; align-items: center; }
</style>
