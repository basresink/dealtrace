<script setup lang="ts">
// Nieuwe klant (F23): naam, pakket of proef, contact en adres, eerste beheerder.
import { PAKKETTEN, PAKKET_LABEL } from '~~/shared/types'
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ sluit: []; aangemaakt: [id: string] }>()
const toast = useToast()
const leeg = () => ({ naam: '', pakket: 'starter', proef: false, proefTot: '', seats: 5, contact: { naam: '', email: '', telefoon: '', adres: '' }, beheerder: { naam: '', email: '' } })
const f = reactive(leeg())
const bezig = ref(false)
watch(() => props.open, (o) => { if (o) Object.assign(f, leeg()) })

async function maak() {
  bezig.value = true
  try {
    const res = await $fetch<{ id: string; naam: string }>('/api/platform/klanten', {
      method: 'POST',
      body: { naam: f.naam, pakket: f.pakket, proefTot: f.proef ? f.proefTot : null, seats: f.seats, contact: f.contact, beheerder: f.beheerder },
    })
    toast.toon(`${res.naam} is aangemaakt. De eerste beheerder staat klaar als uitgenodigd.`)
    emit('aangemaakt', res.id)
  } catch (e) {
    toast.toon(foutTekst(e), 'fout')
  } finally {
    bezig.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fo-overlay" @click.self="emit('sluit')">
      <form class="fo-panel" role="dialog" aria-modal="true" aria-labelledby="nk-titel" data-test="nieuwe-klant" @submit.prevent="maak">
        <header class="fo-head">
          <div class="fo-head-tekst"><span class="fo-kicker">Platformbeheer</span><h2 id="nk-titel" class="fo-titel">Nieuwe klant</h2></div>
          <button type="button" class="fo-sluit" aria-label="Sluiten" @click="emit('sluit')"><Icoon naam="X" /></button>
        </header>
        <div class="fo-body fo-body--formulier">
          <article class="fo-blok">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Organisatie</h3></header>
            <label class="veld"><span class="veld-label">Organisatienaam <span class="veld-verplicht">*</span></span><input v-model="f.naam" class="invoer" required data-test="nk-naam"></label>
            <div class="formulier-raster mt-16">
              <label class="veld"><span class="veld-label">Pakket</span><select v-model="f.pakket" class="invoer"><option v-for="p in PAKKETTEN" :key="p" :value="p">{{ PAKKET_LABEL[p] }}</option></select></label>
              <label class="veld"><span class="veld-label">Seats</span><input v-model.number="f.seats" class="invoer" type="number" min="1"></label>
            </div>
            <label class="veld veld--rij mt-16"><input v-model="f.proef" type="checkbox"> <span>Proefperiode</span></label>
            <label v-if="f.proef" class="veld"><span class="veld-label">Proef tot</span><input v-model="f.proefTot" class="invoer" type="date" required></label>
          </article>
          <article class="fo-blok">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Contact en adres</h3></header>
            <div class="formulier-raster">
              <label class="veld"><span class="veld-label">Contactpersoon</span><input v-model="f.contact.naam" class="invoer"></label>
              <label class="veld"><span class="veld-label">E-mail</span><input v-model="f.contact.email" class="invoer" type="email"></label>
              <label class="veld"><span class="veld-label">Telefoon</span><input v-model="f.contact.telefoon" class="invoer" type="tel"></label>
              <label class="veld"><span class="veld-label">Adres</span><input v-model="f.contact.adres" class="invoer"></label>
            </div>
          </article>
          <article class="fo-blok fo-blok--accent">
            <header class="fo-blok-kop"><h3 class="fo-blok-titel">Eerste beheerder</h3></header>
            <div class="formulier-raster">
              <label class="veld"><span class="veld-label">Naam <span class="veld-verplicht">*</span></span><input v-model="f.beheerder.naam" class="invoer" required data-test="nk-beheerder-naam"></label>
              <label class="veld"><span class="veld-label">E-mail <span class="veld-verplicht">*</span></span><input v-model="f.beheerder.email" class="invoer" type="email" required data-test="nk-beheerder-email"></label>
            </div>
            <p class="veld-uitleg">De uitnodiging met inlogcode volgt zodra inloggen met code er is (P27).</p>
          </article>
        </div>
        <footer class="fo-foot dd-acties">
          <button type="submit" class="dd-act dd-act--primair" :disabled="bezig" data-test="nk-maak">Klant aanmaken</button>
          <span class="dd-acties-vul fo-foot-vul" />
          <button type="button" class="dd-act" @click="emit('sluit')">Annuleren</button>
        </footer>
      </form>
    </div>
  </Teleport>
</template>
