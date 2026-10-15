<script setup lang="ts">
// Contacten van een account (F04): rolvolgorde, en onderaan "+ Snel contactpersoon"
// met dubbelcheck. Per contact rol, toestemming, "Bel me niet" en vertrokken.
import { CONTACTROL_LABEL, ROLLEN_CONTACT } from '~~/shared/contactgegevens'
import { telLink } from '~/utils/accountWeergave'
const props = defineProps<{ open: boolean; account: { id: string; naam: string }; contacten: any[] }>()
const emit = defineEmits<{ sluit: []; gewijzigd: [] }>()
const toast = useToast()
const leeg = () => ({ voornaam: '', achternaam: '', functie: '', email: '', telefoon: '', mobiel: '', rol: 'onbekend' })
const f = reactive(leeg())
const snel = ref(false)
const bezig = ref(false)
async function voegToe() {
  bezig.value = true
  try {
    await $fetch('/api/contacten', { method: 'POST', body: { ...f, accountId: props.account.id } })
    toast.toon(`${f.voornaam} ${f.achternaam} is toegevoegd.`.replace(/\s+/g, ' '))
    Object.assign(f, leeg()); snel.value = false
    emit('gewijzigd')
  } catch (e) { toast.toon(foutTekst(e), 'fout') } finally { bezig.value = false }
}
async function wijzig(c: any, patch: Record<string, unknown>) {
  try { await $fetch(`/api/contacten/${c.id}`, { method: 'PUT', body: patch }); emit('gewijzigd') } catch (e) { toast.toon(foutTekst(e), 'fout') }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fo-overlay" @click.self="emit('sluit')">
      <aside class="fo-panel" role="dialog" aria-modal="true" aria-labelledby="cf-titel" data-test="contacten-flyout">
        <header class="fo-head">
          <div class="fo-head-tekst"><span class="fo-kicker">Contacten</span><h2 id="cf-titel" class="fo-titel">{{ account.naam }}</h2><p class="fo-meta">{{ contacten.length }} contactpersonen</p></div>
          <button type="button" class="fo-sluit" aria-label="Sluiten" @click="emit('sluit')"><Icoon naam="X" /></button>
        </header>
        <div class="fo-body">
          <article v-for="c in contacten" :key="c.id" class="fo-blok" :class="{ 'contact-vertrokken': c.status === 'vertrokken' }" :data-contact="c.id">
            <header class="fo-blok-kop">
              <h3 class="fo-blok-titel"><NuxtLink :to="`/contacten/${c.id}`">{{ c.naam }}</NuxtLink></h3>
              <select class="invoer invoer--klein" :value="c.rol" :aria-label="`Rol van ${c.naam}`" @change="wijzig(c, { rol: ($event.target as HTMLSelectElement).value })">
                <option v-for="r in ROLLEN_CONTACT" :key="r" :value="r">{{ CONTACTROL_LABEL[r] }}</option>
              </select>
            </header>
            <p class="fo-tekst">{{ [c.functie, c.email].filter(Boolean).join(' · ') }}<template v-if="c.status === 'vertrokken'"> · vertrokken {{ c.vertrokkenOp }}</template></p>
            <div class="dd-acties mt-16">
              <a v-for="n in [c.mobiel, c.telefoon].filter(Boolean)" :key="n" class="dd-act" :class="{ 'dd-act--uit': c.belMeNiet }" :href="c.belMeNiet ? undefined : telLink(n)" :aria-disabled="c.belMeNiet" :title="c.belMeNiet ? 'Bel me niet' : undefined"><Icoon naam="Phone" class="dd-act-icoon" />{{ n }}</a>
              <button type="button" class="dd-act" @click="wijzig(c, { belMeNiet: !c.belMeNiet })">{{ c.belMeNiet ? 'Bel me niet uitzetten' : 'Bel me niet' }}</button>
              <button type="button" class="dd-act" @click="wijzig(c, { status: c.status === 'vertrokken' ? 'actief' : 'vertrokken' })">{{ c.status === 'vertrokken' ? 'Weer actief' : 'Vertrokken' }}</button>
            </div>
          </article>
          <article class="fo-blok fo-blok--accent">
            <button v-if="!snel" type="button" class="dd-act dd-act--primair" data-test="snel-contact" @click="snel = true"><Icoon naam="Plus" class="dd-act-icoon" />Snel contactpersoon</button>
            <form v-else class="formulier-raster" data-test="snel-formulier" @submit.prevent="voegToe">
              <label class="veld"><span class="veld-label">Voornaam</span><input v-model="f.voornaam" class="invoer"></label>
              <label class="veld"><span class="veld-label">Achternaam <span class="veld-verplicht">*</span></span><input v-model="f.achternaam" class="invoer" required data-test="sc-achternaam"></label>
              <label class="veld"><span class="veld-label">Functie</span><input v-model="f.functie" class="invoer"></label>
              <label class="veld"><span class="veld-label">E-mail</span><input v-model="f.email" class="invoer" type="email"></label>
              <label class="veld"><span class="veld-label">Telefoon</span><input v-model="f.telefoon" class="invoer" type="tel"></label>
              <label class="veld"><span class="veld-label">Mobiel</span><input v-model="f.mobiel" class="invoer" type="tel"></label>
              <label class="veld"><span class="veld-label">Rol</span><select v-model="f.rol" class="invoer" data-test="sc-rol"><option v-for="r in ROLLEN_CONTACT" :key="r" :value="r">{{ CONTACTROL_LABEL[r] }}</option></select></label>
              <button type="submit" class="dd-actie dd-actie--primair" :disabled="bezig || !f.achternaam.trim()" data-test="sc-toevoegen">Contactpersoon toevoegen</button>
            </form>
          </article>
        </div>
      </aside>
    </div>
  </Teleport>
</template>
