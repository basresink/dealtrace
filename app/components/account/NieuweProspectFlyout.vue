<script setup lang="ts">
// "Wie ga je erbij zetten?" (F03): bedrijfsnaam met directe dubbelcheck. Een
// Beginner ziet alleen naam, plaats, telefoon en website. "Zoek in KvK" komt met P11.
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ sluit: []; aangemaakt: [id: string]; bestaand: [id: string] }>()
const { me, functie } = useMe()
const toast = useToast()
const leeg = () => ({ naam: '', plaats: '', postcode: '', adres: '', telefoon: '', website: '', linkedin: '', klasse: '', customFields: {} as Record<string, unknown> })
const f = reactive(leeg())
const dubbel = ref<any>(null)
const bezig = ref(false)
const uitgebreid = computed(() => me.value?.gebruiker.niveau !== 'beginner' || me.value?.organisatie?.iedereenAlles)
const { data: velden } = await useFetch<any>('/api/eigen-velden', { query: { object: 'account' }, default: () => ({ velden: [] }), immediate: true })
const { data: klassenData } = await useFetch<any>('/api/settings', { default: () => ({}) })
const klassen = computed(() => ((klassenData.value?.klassen ?? []) as any[]).filter((k) => k.tabblad !== 'Klanten'))
watch(() => props.open, (o) => { if (o) { Object.assign(f, leeg()); dubbel.value = null } })
let t: any
watch(() => [f.naam, f.website], () => {
  clearTimeout(t)
  t = setTimeout(async () => {
    if (f.naam.trim().length < 3) { dubbel.value = null; return }
    const d = await $fetch<any>('/api/accounts/dubbelcheck', { query: { naam: f.naam, domein: f.website } })
    dubbel.value = d.soort === 'geen' ? null : d
  }, 300)
})
async function maak() {
  bezig.value = true
  try {
    const res = await $fetch<any>('/api/accounts', { method: 'POST', body: { ...f, klasse: f.klasse || undefined } })
    toast.toon(`${res.naam} staat erbij.`)
    emit('aangemaakt', res.id)
  } catch (e: any) {
    if (e?.statusCode === 409 && e?.data?.data?.match) dubbel.value = e.data.data
    else toast.toon(foutTekst(e), 'fout')
  } finally { bezig.value = false }
}
const kanKlasse = computed(() => functie('prospects.klasseZetten')?.beschikbaar)
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
            <div v-if="dubbel" class="kaart kaart--geel mt-16" role="status" data-test="dubbelcheck">
              <p>Bedoel je <strong>{{ dubbel.match.name }}</strong><template v-if="dubbel.match.city"> in {{ dubbel.match.city }}</template>? {{ dubbel.soort === 'zeker' ? 'Al in je bestand.' : 'Lijkt erop.' }}</p>
              <button type="button" class="dd-act mt-16" data-test="np-bestaand" @click="emit('bestaand', dubbel.match.id)">Open {{ dubbel.match.name }}</button>
            </div>
            <div class="formulier-raster mt-16">
              <label class="veld"><span class="veld-label">Plaats</span><input v-model="f.plaats" class="invoer"></label>
              <label class="veld"><span class="veld-label">Telefoon</span><input v-model="f.telefoon" class="invoer" type="tel"></label>
              <label class="veld"><span class="veld-label">Website</span><input v-model="f.website" class="invoer" placeholder="https://"></label>
            </div>
          </article>
          <article v-if="uitgebreid" class="fo-blok">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Meer gegevens</h3></header>
            <div class="formulier-raster">
              <label class="veld"><span class="veld-label">Adres</span><input v-model="f.adres" class="invoer"></label>
              <label class="veld"><span class="veld-label">Postcode</span><input v-model="f.postcode" class="invoer" placeholder="1234 AB"></label>
              <label class="veld"><span class="veld-label">LinkedIn</span><input v-model="f.linkedin" class="invoer"></label>
              <label v-if="kanKlasse" class="veld"><span class="veld-label">Klasse</span><select v-model="f.klasse" class="invoer"><option value="">Geen</option><option v-for="k in klassen" :key="k.id" :value="k.id">{{ k.naam }}</option></select></label>
            </div>
            <div v-if="velden.velden.length" class="formulier-raster mt-16">
              <EigenVeldInvoer v-for="v in velden.velden" :key="v.sleutel" v-model="f.customFields[v.sleutel]" :veld="v" />
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
