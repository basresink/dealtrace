<script setup lang="ts">
// Prospectplanning, tabblad Hercontactritme (F13, vanaf Gevorderd lezen). Per ritme de
// stappen als ritmestrook, parkeerduur, gebruik en rapport. De salesmanager past de
// stappen aan; anderen stellen een wijziging voor. Jaarplanning en Terugkomregels volgen (P12).
import { KANAAL_LABEL_RITME } from '~~/shared/hercontact'
const { functie } = useMe()
const aan = !!functie('ritme.lezen')?.beschikbaar
const toast = useToast()
const { data, refresh } = await useFetch<any>('/api/ritmes', { immediate: aan, default: () => ({ ritmes: [], kan: {} }) })
const bewerk = ref<any>(null)
function start(r: any) { bewerk.value = JSON.parse(JSON.stringify({ id: r.id, naam: r.naam, stappen: r.stappen, parkeerDagen: r.parkeerDagen })) }
async function bewaar() {
  try { await $fetch(`/api/ritmes/${bewerk.value.id}`, { method: 'PUT', body: bewerk.value }); toast.toon('Ritme bewaard.'); bewerk.value = null; await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const voorstel = reactive<Record<string, string>>({})
async function stelVoor(id: string) {
  try { await $fetch(`/api/ritmes/${id}/voorstel`, { method: 'POST', body: { tekst: voorstel[id] } }); voorstel[id] = ''; toast.toon('Je voorstel staat bij je salesmanager.') } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const BRON: Record<string, string> = { koud: 'Koud', warm: 'Warm', winback: 'Winback' }
useHead({ title: 'Prospectplanning · Dealtrace' })
</script>

<template>
  <div>
    <NietAangezetKop v-if="!aan" sleutel="ritme.lezen" />
    <template v-else>
      <PaginaKop kicker="Prospectplanning" titel="Hercontactritme" uitleg="De reeks pogingen tot een afspraak. Na de laatste poging zonder reactie wordt het account geparkeerd." helpartikel="hercontactritme" />
      <section class="section section--laatste">
        <div class="container">
          <nav class="tabbalk" aria-label="Tabbladen"><button type="button" class="tab tab--actief">Hercontactritme</button></nav>
          <div class="ak-blokken mt-16" data-test="ritmes">
            <article v-for="r in data.ritmes" :key="r.id" class="kaart" :data-test="`ritme-${r.naam}`">
              <header class="kaart-kop"><h2 class="kaart-titel">{{ r.naam }}</h2><span class="pil pil--leeg">{{ BRON[r.bron] }}</span></header>
              <div class="ritmestrook mt-8">
                <span v-for="s in r.stappen" :key="s.volgnummer" class="ritmevak"><strong>dag {{ s.dagOffset }}</strong><br>{{ KANAAL_LABEL_RITME[s.kanaal] }}</span>
                <span class="ritmevak ritmevak--park"><strong>parkeren</strong><br>{{ r.parkeerDagen }} dagen</span>
              </div>
              <p class="kaart-meta mt-8">{{ r.inGebruik }} accounts in dit ritme · {{ r.werkplek === 'buitendienst' ? 'buitendienst' : r.werkplek === 'binnendienst' ? 'binnendienst' : 'iedereen' }}</p>
              <dl class="gegevens mt-8" data-test="rapport">
                <dt>Afspraken</dt><dd>{{ r.rapport.afspraken }}<template v-if="Object.keys(r.rapport.perPoging).length"> ({{ Object.entries(r.rapport.perPoging).map(([p, n]) => `poging ${p}: ${n}`).join(', ') }})</template></dd>
                <dt>Geparkeerd</dt><dd>{{ r.rapport.geparkeerdProcent }} procent</dd>
                <dt>Gemiddeld tot afspraak</dt><dd>{{ r.rapport.gemiddeldePogingen ?? 'nog geen' }} pogingen</dd>
              </dl>
              <button v-if="data.kan.beheer" type="button" class="dd-act mt-8" :data-test="`ritme-bewerk-${r.naam}`" @click="start(r)">Stappen aanpassen</button>
              <div v-else class="mt-8">
                <label class="veld"><span class="veld-label">Stel wijziging voor</span><input v-model="voorstel[r.id]" class="invoer"></label>
                <button type="button" class="dd-act mt-8" :disabled="!voorstel[r.id]?.trim()" @click="stelVoor(r.id)">Stel wijziging voor</button>
              </div>
            </article>
          </div>
        </div>
      </section>
      <div v-if="bewerk" class="fo-overlay" @click.self="bewerk = null">
        <form class="fo-panel fo-panel--smal fo-panel--schuif" role="dialog" aria-modal="true" data-test="ritme-flyout" @submit.prevent="bewaar">
          <header class="fo-head"><div class="fo-head-tekst"><span class="fo-kicker">Hercontactritme</span><h2 class="fo-titel">{{ bewerk.naam }}</h2></div><button type="button" class="fo-sluit" aria-label="Sluiten" @click="bewerk = null"><Icoon naam="X" /></button></header>
          <div class="fo-body fo-body--formulier">
            <article class="fo-blok">
              <div v-for="(s, i) in bewerk.stappen" :key="i" class="formulier-raster">
                <label class="veld"><span class="veld-label">Stap {{ Number(i) + 1 }}: dag</span><input v-model.number="s.dagOffset" type="number" min="0" class="invoer"></label>
                <label class="veld"><span class="veld-label">Kanaal</span><select v-model="s.kanaal" class="invoer"><option v-for="(l, k) in KANAAL_LABEL_RITME" :key="k" :value="k">{{ l }}</option></select></label>
              </div>
              <div class="reis-knoppen mt-8"><button type="button" class="dd-act" @click="bewerk.stappen.push({ dagOffset: Number(bewerk.stappen.at(-1)?.dagOffset ?? 0) + 7, kanaal: 'bellen' })">+ Stap</button><button v-if="bewerk.stappen.length > 1" type="button" class="dd-act" @click="bewerk.stappen.pop()">Laatste stap weg</button></div>
              <label class="veld mt-16"><span class="veld-label">Parkeren (dagen)</span><input v-model.number="bewerk.parkeerDagen" type="number" min="1" class="invoer"></label>
            </article>
          </div>
          <footer class="fo-foot dd-acties"><button type="button" class="dd-act" @click="bewerk = null">Annuleren</button><span class="dd-acties-vul fo-foot-vul" /><button type="submit" class="dd-act dd-act--primair">Bewaren</button></footer>
        </form>
      </div>
    </template>
  </div>
</template>
