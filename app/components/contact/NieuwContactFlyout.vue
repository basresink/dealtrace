<script setup lang="ts">
// "+ Contact" vanaf de contactlijst: een contact hoort altijd bij een bedrijf, dus eerst het
// account kiezen (of meegegeven), dan naam, functie, rol en contactgegevens. De server doet de
// dubbelcheck op e-mail en op naam binnen het bedrijf; een dubbel toont de bestaande persoon.
import { CONTACTROL_LABEL, ROLLEN_CONTACT } from '~~/shared/contactgegevens'

const props = defineProps<{ open: boolean; account?: { id: string; naam: string } | null }>()
const emit = defineEmits<{ sluit: []; aangemaakt: [id: string] }>()
const toast = useToast()
const leeg = () => ({ voornaam: '', achternaam: '', functie: '', email: '', telefoon: '', mobiel: '', rol: 'onbekend', linkedin: '' })
const f = reactive(leeg())
const klant = ref<{ id: string; naam: string } | null>(null)
const zoek = ref('')
const treffers = ref<{ id: string; naam: string; plaats: string | null }[]>([])
const dubbel = ref<{ id: string; naam: string } | null>(null)
const bezig = ref(false)
watch(() => props.open, (o) => {
  if (!o) return
  Object.assign(f, leeg()); klant.value = props.account ?? null; zoek.value = ''; treffers.value = []; dubbel.value = null
})
let timer: any
watch(zoek, (q) => { clearTimeout(timer); timer = setTimeout(async () => { treffers.value = q.trim().length >= 2 ? await $fetch<any[]>('/api/accounts/kies', { query: { q } }) : [] }, 250) })
async function maak() {
  if (!klant.value) return
  bezig.value = true; dubbel.value = null
  try {
    const c = await $fetch<{ id: string; naam: string }>('/api/contacten', { method: 'POST', body: { ...f, accountId: klant.value.id } })
    toast.toon(`${c.naam} staat erbij.`)
    emit('aangemaakt', c.id)
  } catch (e: any) {
    const m = e?.data?.data?.match
    if (e?.statusCode === 409 && m) dubbel.value = { id: m.id, naam: `${m.firstName ?? ''} ${m.lastName}`.trim() }
    else toast.toon(foutTekst(e), 'fout')
  } finally { bezig.value = false }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fo-overlay" @click.self="emit('sluit')">
      <form class="fo-panel fo-panel--smal fo-panel--schuif" role="dialog" aria-modal="true" aria-labelledby="nc-titel" data-test="nieuw-contact" @submit.prevent="maak">
        <header class="fo-head">
          <div class="fo-head-tekst"><span class="fo-kicker">Nieuw contact</span><h2 id="nc-titel" class="fo-titel">Wie ga je erbij zetten?</h2></div>
          <button type="button" class="fo-sluit" aria-label="Sluiten" @click="emit('sluit')"><Icoon naam="X" /></button>
        </header>
        <div class="fo-body fo-body--formulier">
          <article class="fo-blok">
            <div class="veld"><span class="veld-label">Bedrijf <span class="veld-verplicht">*</span></span>
              <p v-if="klant" class="schakel-rij"><strong data-test="nc-gekozen">{{ klant.naam }}</strong><button type="button" class="dd-act" @click="klant = null">Wijzig</button></p>
              <template v-else>
                <input v-model="zoek" class="invoer" placeholder="Zoek een bedrijf" aria-label="Zoek een bedrijf" data-test="nc-account">
                <span class="veld-uitleg">Een contact hoort altijd bij een bedrijf.</span>
                <ul v-if="treffers.length" class="schakel-lijst"><li v-for="a in treffers" :key="a.id" class="schakel-rij"><button type="button" class="taak-titel" :data-test="`nc-kies-${a.id}`" @click="klant = { id: a.id, naam: a.naam }; treffers = []">{{ a.naam }} <span class="meta">{{ a.plaats }}</span></button></li></ul>
              </template>
            </div>
            <div class="formulier-raster mt-16">
              <label class="veld"><span class="veld-label">Voornaam</span><input v-model="f.voornaam" class="invoer" autocomplete="off" data-test="nc-voornaam"></label>
              <label class="veld"><span class="veld-label">Achternaam <span class="veld-verplicht">*</span></span><input v-model="f.achternaam" class="invoer" required autocomplete="off" data-test="nc-achternaam"></label>
              <label class="veld"><span class="veld-label">Functie</span><input v-model="f.functie" class="invoer" data-test="nc-functie"></label>
              <label class="veld"><span class="veld-label">Rol</span><select v-model="f.rol" class="invoer" data-test="nc-rol"><option v-for="r in ROLLEN_CONTACT" :key="r" :value="r">{{ CONTACTROL_LABEL[r] }}</option></select></label>
              <label class="veld"><span class="veld-label">E-mail</span><input v-model="f.email" class="invoer" type="email" autocomplete="off"></label>
              <label class="veld"><span class="veld-label">Telefoon</span><input v-model="f.telefoon" class="invoer" type="tel"></label>
              <label class="veld"><span class="veld-label">Mobiel</span><input v-model="f.mobiel" class="invoer" type="tel"></label>
              <label class="veld"><span class="veld-label">LinkedIn</span><input v-model="f.linkedin" class="invoer" type="url" placeholder="linkedin.com/in/..."></label>
            </div>
            <p v-if="dubbel" class="fo-tekst mt-16" role="alert" data-test="nc-dubbel">{{ dubbel.naam }} staat al in je bestand. <NuxtLink :to="`/contacten/${dubbel.id}`" class="tekst-link" @click="emit('sluit')">Open contact →</NuxtLink></p>
          </article>
        </div>
        <footer class="fo-foot dd-acties">
          <button type="button" class="dd-act" @click="emit('sluit')">Annuleren</button>
          <span class="dd-acties-vul fo-foot-vul" />
          <button type="submit" class="dd-act dd-act--primair" :disabled="bezig || !klant || !f.achternaam.trim()" data-test="nc-maak">Contact toevoegen</button>
        </footer>
      </form>
    </div>
  </Teleport>
</template>
