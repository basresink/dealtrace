<script setup lang="ts">
// Contacten van een account in de opzet van DealDrive (ContactenFlyout): kicker "Contactpersonen · N", de
// accountnaam en een uitleg; per contact een rij met avatar (foto of initialen), naam met rolpil, functie en
// e-mail, klik opent de contactkaart. Per rij blijven rol wijzigen en bellen bereikbaar. Onderaan
// "+ Snel contactpersoon aanmaken" (uitklapbaar, met dubbelcheck op de server) en de voet "Alle contacten".
import { CONTACTROL_LABEL, ROLLEN_CONTACT } from '~~/shared/contactgegevens'
import { telLink, toonTelefoon } from '~/utils/accountWeergave'
const props = defineProps<{ open: boolean; account: { id: string; naam: string }; contacten: any[] }>()
const emit = defineEmits<{ sluit: []; gewijzigd: [] }>()
const toast = useToast()
const leeg = () => ({ voornaam: '', achternaam: '', functie: '', email: '', telefoon: '', mobiel: '', rol: 'onbekend' })
const f = reactive(leeg())
const snel = ref(false)
const bezig = ref(false)
const voornaamVeld = ref<HTMLInputElement | null>(null)
async function openSnel() { snel.value = true; await nextTick(); voornaamVeld.value?.focus() }
function annuleer() { Object.assign(f, leeg()); snel.value = false }
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
// Werkende contacten eerst (de API sorteert al op rol), vertrokken onderaan.
const gesorteerd = computed(() => [...props.contacten].sort((a, b) => Number(a.status === 'vertrokken') - Number(b.status === 'vertrokken')))
const nummer = (c: any) => c.mobiel ?? c.telefoon ?? null
</script>

<template>
  <FlyoutShell v-if="open" open titel-id="cf-titel" breedte="smal" data-test="contacten-flyout" :ai="{ accountId: account.id, label: account.naam, voorstellen: ['Wie is de beslisser?', 'Welke rol ontbreekt er nog?', 'Wie benader ik als eerste?'] }" @sluit="emit('sluit')">
      <template #kop>
            <span class="fo-kicker" data-test="cf-kicker">Contactpersonen · {{ contacten.length }}</span>
            <h2 id="cf-titel" class="fo-titel">{{ account.naam }}</h2>
            <p class="fo-meta cf-uitleg">Alle contacten gekoppeld aan dit account. Klik een naam voor de contactpersoonkaart.</p></template>
        <div class="fo-body cf-body">
          <p v-if="!contacten.length" class="cf-leeg">Nog geen contactpersonen aan dit account gekoppeld.</p>
          <ul v-else class="cf-lijst">
            <li v-for="c in gesorteerd" :key="c.id" class="cf-rij" :class="{ 'cf-rij--vertrokken': c.status === 'vertrokken' }" :data-contact="c.id">
              <NuxtLink :to="`/contacten/${c.id}`" class="cf-kaart" data-test="cf-contact" @click="emit('sluit')">
                <ContactFoto :naam="c.naam" :foto-url="c.fotoUrl" :grootte="44" />
                <span class="cf-info">
                  <span class="cf-regel">
                    <span class="cf-naam">{{ c.naam }}</span>
                    <Label soort="rol" :waarde="c.rol || 'onbekend'" />
                    <Label v-if="c.status === 'vertrokken'" soort="status" waarde="vertrokken" />
                  </span>
                  <span v-if="c.functie" class="cf-functie">{{ c.functie }}</span>
                  <span v-if="c.email" class="cf-meta">{{ c.email }}</span>
                </span>
              </NuxtLink>
              <div class="cf-acties">
                <select class="invoer invoer--klein cf-rolkeuze" :value="c.rol" :aria-label="`Rol van ${c.naam}`" data-test="cf-rol" @change="wijzig(c, { rol: ($event.target as HTMLSelectElement).value })">
                  <option v-for="r in ROLLEN_CONTACT" :key="r" :value="r">{{ CONTACTROL_LABEL[r] }}</option>
                </select>
                <a v-if="nummer(c)" class="dd-act" :class="{ 'dd-act--uit': c.belMeNiet }" :href="c.belMeNiet ? undefined : telLink(nummer(c))" :aria-disabled="c.belMeNiet" :title="c.belMeNiet ? 'Bel me niet' : undefined" :aria-label="`Bel ${c.naam}`"><Icoon naam="Phone" class="dd-act-icoon" /><span class="tnum">{{ toonTelefoon(nummer(c)) }}</span></a>
              </div>
            </li>
          </ul>

          <div class="cf-nieuw">
            <button v-if="!snel" type="button" class="cf-nieuw-link" data-test="snel-contact" @click="openSnel">+ Snel contactpersoon aanmaken</button>
            <form v-else class="cf-form" data-test="snel-formulier" @submit.prevent="voegToe">
              <div class="cf-form-kop"><span class="cf-form-kicker">Nieuwe contactpersoon</span><button type="button" class="cf-form-annuleer" @click="annuleer">Annuleren</button></div>
              <div class="cf-raster">
                <label class="veld"><span class="veld-label">Voornaam</span><input ref="voornaamVeld" v-model="f.voornaam" class="invoer" autocomplete="off"></label>
                <label class="veld"><span class="veld-label">Achternaam <span class="veld-verplicht">*</span></span><input v-model="f.achternaam" class="invoer" required autocomplete="off" data-test="sc-achternaam"></label>
              </div>
              <label class="veld"><span class="veld-label">Functie</span><input v-model="f.functie" class="invoer" placeholder="Bijvoorbeeld inkoopmanager"></label>
              <label class="veld"><span class="veld-label">E-mail</span><input v-model="f.email" class="invoer" type="email" placeholder="naam@bedrijf.test"></label>
              <div class="cf-raster">
                <label class="veld"><span class="veld-label">Telefoon</span><input v-model="f.telefoon" class="invoer tnum" type="tel"></label>
                <label class="veld"><span class="veld-label">Mobiel</span><input v-model="f.mobiel" class="invoer tnum" type="tel"></label>
              </div>
              <label class="veld"><span class="veld-label">Rol</span><select v-model="f.rol" class="invoer" data-test="sc-rol"><option v-for="r in ROLLEN_CONTACT" :key="r" :value="r">{{ CONTACTROL_LABEL[r] }}</option></select></label>
              <button type="submit" class="dd-actie dd-actie--primair" :disabled="bezig || !f.achternaam.trim()" data-test="sc-toevoegen">{{ bezig ? 'Opslaan…' : 'Contactpersoon toevoegen' }}</button>
            </form>
          </div>
        </div>
      <template #voet>
        <footer class="fo-foot fs-voet cf-voet">
          <NuxtLink to="/contacten/alle" class="dd-actie dd-actie--zwart fs-hoofdactie cf-alle" data-test="cf-alle" @click="emit('sluit')"><Icoon naam="Users" :grootte="16" />Alle contacten</NuxtLink>
          <span class="fo-foot-vul" />
        </footer>
      </template>
    </FlyoutShell>
</template>

<style scoped>
.cf-uitleg { color: var(--ink-soft); line-height: 1.45; }
.cf-body { padding: 0; }
.cf-leeg { margin: 0; padding: 28px; font-size: 13px; color: var(--ink-soft); }
.cf-lijst { margin: 0; padding: 0; list-style: none; }
.cf-rij { border-bottom: 1px solid var(--border); }
.cf-rij--vertrokken { opacity: 0.6; }
.cf-kaart { display: flex; align-items: center; gap: 14px; padding: 14px 24px 6px; color: var(--ink); text-decoration: none; }
.cf-kaart:hover { background: var(--bg); }
.cf-kaart:hover .cf-naam { text-decoration: underline; text-decoration-color: var(--yellow); text-decoration-thickness: 2px; }
.cf-info { display: flex; flex: 1; flex-direction: column; min-width: 0; }
.cf-regel { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.cf-naam { font-family: var(--font-serif); font-size: 15px; font-weight: 700; color: var(--ink); }
.cf-functie { margin-top: 2px; font-size: 12px; color: var(--muted); }
.cf-meta { font-size: 11px; color: var(--ink-soft); overflow-wrap: anywhere; }
.cf-acties { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 4px 24px 12px 82px; }
.cf-rolkeuze { width: auto; }
.cf-nieuw { padding: 14px 24px 24px; }
.cf-nieuw-link { padding: 6px 0; border: 0; border-bottom: 1px dashed var(--muted); background: none; font: inherit; font-size: 13px; font-weight: 600; letter-spacing: 0.02em; color: var(--muted); cursor: pointer; }
.cf-nieuw-link:hover { color: var(--ink); border-bottom-style: solid; border-bottom-color: var(--yellow); }
.cf-form { display: flex; flex-direction: column; gap: 10px; padding: 16px; background: var(--bg); border-left: 3px solid var(--yellow); }
.cf-form-kop { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.cf-form-kicker { font-size: 11px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.cf-form-annuleer { padding: 0; border: 0; background: none; font: inherit; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); cursor: pointer; }
.cf-form-annuleer:hover { color: var(--red); }
.cf-raster { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.cf-alle { text-decoration: none; }
@media (max-width: 767px) {
  .cf-kaart { padding: 12px 16px 4px; min-height: 44px; }
  .cf-acties { padding: 4px 16px 12px 74px; }
  .cf-acties .dd-act, .cf-rolkeuze { min-height: 44px; }
  .cf-nieuw { padding: 12px 16px 20px; }
  .cf-nieuw-link, .cf-form-annuleer { min-height: 44px; }
  .cf-raster { grid-template-columns: 1fr; }
}
</style>
