<script setup lang="ts">
// Prospectplanning, tabblad Hercontactritme (F13, P07). Per ritme de stappen als ritmestrook,
// parkeerduur, gebruik en rapport. De salesmanager past de stappen aan; anderen stellen een
// wijziging voor.
import { KANAAL_LABEL_RITME } from '~~/shared/hercontact'
const { functie } = useMe()
const aan = !!functie('ritme.lezen')?.beschikbaar
const toast = useToast()
const { data, refresh } = await useFetch<any>('/api/ritmes', { immediate: aan, default: () => ({ ritmes: [], kan: {} }) })
const bewerk = ref<any>(null)
function start(r: any) { bewerk.value = JSON.parse(JSON.stringify({ id: r.id, naam: r.naam, stappen: r.stappen, parkeerDagen: r.parkeerDagen })) }
async function bewaar() {
  try { await opslag.bewaar(() => $fetch(`/api/ritmes/${bewerk.value.id}`, { method: 'PUT', body: bewerk.value })); toast.toon('Ritme bewaard.'); bewerk.value = null; await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const voorstel = reactive<Record<string, string>>({})
async function stelVoor(id: string) {
  try { await $fetch(`/api/ritmes/${id}/voorstel`, { method: 'POST', body: { tekst: voorstel[id] } }); voorstel[id] = ''; toast.toon('Je voorstel staat bij je salesmanager.') } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
const BRON: Record<string, string> = { koud: 'Koud', warm: 'Warm', winback: 'Winback' }
// Opslaan-status in de kop (FlyoutShell): Gewijzigd tot de hoofdactie opslaat; sluiten met wijzigingen vraagt eerst.
const opslag = useFlyoutOpslag()
opslag.volg(() => [bewerk.value])
</script>

<template>
  <div>
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
                <div class="veld"><label class="veld-label" :for="`ritme-voorstel-${r.id}`">Jouw voorstel voor dit ritme</label><textarea :id="`ritme-voorstel-${r.id}`" v-model="voorstel[r.id]" class="invoer" rows="2" :aria-label="`Jouw voorstel voor ${r.naam}`" placeholder="Bijvoorbeeld: poging 3 een dag later" :data-test="`ritme-voorstel-${r.naam}`" /></div>
                <button type="button" class="dd-act mt-8" :disabled="!voorstel[r.id]?.trim()" @click="stelVoor(r.id)">Stel wijziging voor</button>
              </div>
            </article>
          </div>
      <FlyoutShell v-if="bewerk" open titel-id="fs-planningritme0" breedte="smal" data-test="ritme-flyout" :opslag="opslag" @sluit="bewerk = null" @bewaar="bewaar">
        <template #kop><span class="fo-kicker">Hercontactritme</span><h2 id="fs-planningritme0" class="fo-titel">{{ bewerk.naam }}</h2></template>
        <form id="pr-form" class="fs-form" @submit.prevent="bewaar">
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
        </form>
        <template #voet>
          <footer class="fo-foot fs-voet">
          <button type="submit" form="pr-form" class="dd-actie dd-actie--zwart fs-hoofdactie"><Icoon naam="Check" :grootte="16" />Bewaren</button>
          <span class="fo-foot-vul" />
        </footer>
        </template>
      </FlyoutShell>
  </div>
</template>
