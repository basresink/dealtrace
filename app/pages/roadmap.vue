<script setup lang="ts">
// Roadmap voor iedereen (F23): wensen indienen en stemmen binnen de eigen organisatie, met de status van de
// leverancier. Op de telefoon met één duim te gebruiken (tikdoelen van 44 px).
import { WENS_LABEL, type WensStatus } from '~~/shared/platform'
const toast = useToast()
const { data, refresh } = await useFetch<any>('/api/roadmap', { default: () => ({ wensen: [], magSamenvoegen: false }) })
const nieuw = reactive({ titel: '', omschrijving: '' })
const open = ref(false)
async function dien() { try { const r: any = await $fetch('/api/roadmap', { method: 'POST', body: nieuw }); toast.toon(r.tekst); Object.assign(nieuw, { titel: '', omschrijving: '' }); open.value = false; await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') } }
async function stem(w: any) { try { await $fetch(`/api/roadmap/${w.id}/stem`, { method: 'POST' }); await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') } }
const voeg = ref<{ id: string; met: string } | null>(null)
async function samenvoegen() { try { await $fetch(`/api/roadmap/${voeg.value!.id}/samenvoegen`, { method: 'POST', body: { met: voeg.value!.met } }); toast.toon('De wensen zijn samengevoegd.'); voeg.value = null; await refresh() } catch (e) { toast.toon(foutTekst(e), 'fout') } }
useHead({ title: 'Roadmap · Dealtrace' })
</script>

<template>
  <div>
    <PaginaKop kicker="Roadmap" :titel="data.wensen.length ? `${data.wensen.length} ${data.wensen.length === 1 ? 'wens' : 'wensen'} van jullie organisatie` : 'Nog geen wensen'" uitleg="Wat mist er in Dealtrace? Dien een wens in of stem op die van een collega. Je ziet wat er met elke wens gebeurt." helpartikel="je-eerste-dag-in-dealtrace">
      <template #acties><button type="button" class="dd-actie dd-actie--primair" data-test="wens-nieuw" @click="open = !open"><Icoon naam="Plus" class="dd-actie-icoon" />Nieuwe wens</button></template>
    </PaginaKop>
    <section class="section section--laatste">
      <div class="container stapel">
        <article v-if="open" class="kaart" data-test="wens-formulier">
          <label class="veld"><span class="veld-label">Wat wil je kunnen?</span><input v-model="nieuw.titel" class="invoer" maxlength="120" data-test="wens-titel"></label>
          <label class="veld mt-8"><span class="veld-label">Toelichting</span><textarea v-model="nieuw.omschrijving" class="invoer" rows="3" /></label>
          <button type="button" class="dd-act dd-act--primair mt-8 rm-knop" data-test="wens-indienen" @click="dien">Dien in</button>
        </article>
        <article v-for="w in data.wensen" :key="w.id" class="kaart rm-wens" :data-test="`wens-${w.id}`">
          <button type="button" class="rm-stem" :class="{ 'rm-stem--aan': w.gestemd }" :aria-pressed="w.gestemd" :aria-label="w.gestemd ? 'Stem intrekken' : 'Stem'" @click="stem(w)"><Icoon naam="Star" /><span class="tnum">{{ w.stemmen }}</span></button>
          <div class="rm-inhoud">
            <h2 class="kaart-titel">{{ w.titel }}</h2>
            <p v-if="w.omschrijving" class="kaart-meta">{{ w.omschrijving }}</p>
            <p class="kaart-meta"><span class="pil" :class="w.status === 'opgeleverd' ? 'pil--groen' : 'pil--leeg'">{{ WENS_LABEL[w.status as WensStatus] }}</span> · {{ w.door }}<template v-if="w.samengevoegd.length"> · samen met {{ w.samengevoegd.join(', ') }}</template></p>
            <button v-if="data.magSamenvoegen && data.wensen.length > 1" type="button" class="tekst-link" @click="voeg = { id: w.id, met: '' }">Samenvoegen met…</button>
          </div>
        </article>
      </div>
    </section>
    <BevestigVenster :open="!!voeg" titel="Samenvoegen met welke wens?" tekst="De stemmen tellen samen; de wens blijft zichtbaar onder de andere." bevestig="Voeg samen" @bevestigd="samenvoegen" @geannuleerd="voeg = null">
      <select v-if="voeg" v-model="voeg.met" class="invoer" aria-label="Wens"><option value="" disabled>Kies een wens</option><option v-for="x in data.wensen.filter((x: any) => x.id !== voeg?.id)" :key="x.id" :value="x.id">{{ x.titel }}</option></select>
    </BevestigVenster>
  </div>
</template>

<style scoped>
.rm-wens { display: flex; gap: 16px; align-items: flex-start; }
.rm-stem { all: unset; cursor: pointer; display: grid; place-items: center; min-width: 52px; min-height: 52px; border: 1px solid var(--border); border-radius: 10px; gap: 2px; }
.rm-stem--aan { background: var(--yellow); border-color: var(--yellow); }
.rm-inhoud { flex: 1; min-width: 0; display: grid; gap: 4px; }
.rm-knop { min-height: 44px; }
</style>
